const os = require('os');
const IWorker = require('../interfaces/IWorker');
const SandboxedScanExecutor = require('../executors/SandboxedScanExecutor');
const ExecutionContext = require('../executors/ExecutionContext');
const CancellationToken = require('../executors/CancellationToken');
const { JOB_STATES } = require('../jobs/ScanJobStateMachine');
const { JobStage } = require('../jobs/JobStage');
const { jobEvents } = require('../events/JobEvents');
const crypto = require('crypto');

/**
 * Dedicated Background Scan Worker.
 * Receives jobs from queue, assigns worker metadata, validates jobs,
 * delegates processing to ScanExecutor, and manages lifecycle.
 * Does not expose HTTP endpoints. Independently scalable.
 */
class ScanWorker extends IWorker {
  constructor(options = {}) {
    super();
    this.workerId = options.workerId || `worker_${os.hostname()}_${process.pid}_${Math.random().toString(36).substr(2, 4)}`;
    this.executor = options.executor || new SandboxedScanExecutor();
    this.queueProvider = options.queueProvider;
    this.unitOfWork = options.unitOfWork || require('../persistence/unitOfWorkInstance');
    this.jobType = options.jobType || 'scan';
    
    // Worker Metadata Tracking
    this.currentJob = null;
    this.currentState = 'idle';
    this.startTime = null;
    this.lastHeartbeat = null;
    this.heartbeatIntervalId = null;
    this.activeJobs = new Map(); // jobId -> cancellationToken
  }

  /**
   * Start listening for jobs on the queue.
   */
  start() {
    if (!this.queueProvider) {
      throw new Error('ScanWorker requires a valid queueProvider instance');
    }

    console.log(`[ScanWorker] Worker '${this.workerId}' listening for '${this.jobType}' jobs...`);
    this._startHeartbeat();

    this.queueProvider.process(this.jobType, async (job) => {
      return await this.processJob(job);
    });
  }

  _startHeartbeat() {
    this.heartbeatIntervalId = setInterval(() => {
      this.lastHeartbeat = Date.now();
    }, 5000); // 5 second heartbeat
    // We keep interval unref'd so it doesn't block process exit
    if (this.heartbeatIntervalId.unref) this.heartbeatIntervalId.unref();
  }

  /**
   * Receive, validate, update state, execute, handle retries and cleanup.
   */
  async processJob(jobData) {
    // Construct the job domain object from the queue payload
    let job = typeof jobData.updateProgress === 'function' ? jobData : require('../jobs/ScanJob').ScanJob.fromJSON(jobData);
    
    // Idempotency Check: Fetch latest state from DB to prevent duplicate terminal execution
    if (this.unitOfWork && this.unitOfWork.scanJobs) {
      const latestJob = await this.unitOfWork.scanJobs.getById(job.id);
      if (latestJob) {
        if ([JOB_STATES.COMPLETED, JOB_STATES.FAILED, JOB_STATES.CANCELLED].includes(latestJob.status)) {
          console.warn(`[ScanWorker] Idempotency check: Job ${job.id} is already ${latestJob.status}. Ignoring duplicate delivery.`);
          return latestJob.result || { message: 'Duplicate terminal job ignored' };
        }
        // Use the latest database state (e.g. for retries where progress was reset)
        job = latestJob;
      }
    }

    const cancellationToken = new CancellationToken();
    const correlationId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(7);

    const context = new ExecutionContext({
      job,
      workerId: this.workerId,
      correlationId,
      logger: console,
      config: {},
      cancellationToken,
      repository: job.repository,
      progressReporter: (snapshot, stageObj) => {
        job.updateProgress(snapshot, stageObj);
        this.lastHeartbeat = Date.now();
      }
    });

    try {
      this.activeJobs.set(job.id, cancellationToken);
      this.currentJob = job.id;
      this.currentState = 'processing';
      this.startTime = Date.now();
      
      await this.onBeforeJob(context);

      job.workerId = this.workerId;

      this._validateJob(job);
      
      if (job.status !== JOB_STATES.RUNNING) {
        job.transitionTo(JOB_STATES.RUNNING, 'Worker processing started');
      }

      await this.onBeforeExecution(context);

      // Execute actual scanning logic strictly via executor
      const result = await this.executor.execute(context);
      
      await this.onAfterExecution(context, result);
      
      return result;
    } catch (error) {
      console.error(`[ScanWorker] Error processing job ${job.id}:`, error.message);
      
      if (this._isValidationError(error)) {
        error.isTransient = false;
        error.isValidation = true;
      } else if (error.isCancellation) {
        // Queue handles cancellation if we rethrow, or we transition it here
        error.isTransient = false;
      } else {
        error.isTransient = true;
      }

      throw error;
    } finally {
      this.activeJobs.delete(job.id);
      await this._cleanupResources(context);
    }
  }

  _validateJob(job) {
    if (!job.repository) {
      const error = new Error('Validation Failed: Job is missing repository target');
      error.isValidation = true;
      throw error;
    }
    // Validation is almost instantaneous, no progress jump needed here since JobStage enum is for the scan lifecycle.
  }

  _isValidationError(error) {
    return error.isValidation === true || error.message.includes('Validation Failed');
  }

  async _cleanupResources(context) {
    this.currentState = 'cleaning';
    await this.onAfterCleanup(context);
    
    this.currentJob = null;
    this.currentState = 'idle';
  }

  // Lifecycle Hooks for auditing/monitoring extensions
  async onBeforeJob(context) { }
  async onBeforeExecution(context) { }
  async onAfterExecution(context, result) { }
  async onAfterCleanup(context) { }

  getActiveJobCount() {
    return this.activeJobs.size;
  }

  cancelAllActiveJobs(reason) {
    for (const token of this.activeJobs.values()) {
      token.cancel(reason);
    }
  }
}

module.exports = ScanWorker;

