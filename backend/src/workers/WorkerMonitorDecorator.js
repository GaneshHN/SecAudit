const IWorker = require('../interfaces/IWorker');
const { defaultEventBus } = require('../events/LocalEventBus');
const BaseEvent = require('../events/BaseEvent');
const { EventCategory } = require('../events/EventCategory');

/**
 * WorkerMonitorDecorator
 * Wraps an IWorker instance to emit worker lifecycle metrics passively.
 * This ensures the worker logic remains completely stateless and focused on execution.
 */
class WorkerMonitorDecorator extends IWorker {
  constructor(worker) {
    super();
    this.worker = worker;
    this.workerId = worker.workerId;
    
    // Wire up original heartbeats or create our own if it doesn't exist
    if (this.worker.heartbeatIntervalId) {
      clearInterval(this.worker.heartbeatIntervalId);
    }
    
    this._startMonitoringHeartbeat();
  }

  _startMonitoringHeartbeat() {
    this.heartbeatIntervalId = setInterval(() => {
      this._publishWorkerEvent('WorkerHeartbeat', {
        currentJob: this.worker.currentJob,
        status: this.worker.currentState
      });
    }, 5000);
    if (this.heartbeatIntervalId.unref) this.heartbeatIntervalId.unref();
  }

  _publishWorkerEvent(eventType, payload = {}) {
    defaultEventBus.publish(new BaseEvent({
      eventType,
      category: EventCategory.SYSTEM,
      sourceComponent: 'WorkerMonitorDecorator',
      workerId: this.workerId,
      payload
    })).catch(err => {
      console.error(`[WorkerMonitorDecorator] Failed to publish event ${eventType}:`, err.message);
    });
  }

  start() {
    this._publishWorkerEvent('WorkerStarted');
    // Delegate to original worker
    if (typeof this.worker.start === 'function') {
      this.worker.start();
    }
  }

  async processJob(job) {
    this._publishWorkerEvent('WorkerBusy', { jobId: job.id || job.jobId });
    const startTime = Date.now();
    let isRetry = job.attempt > 1;

    try {
      const result = await this.worker.processJob(job);
      const executionTimeMs = Date.now() - startTime;
      
      this._publishWorkerEvent('WorkerIdle', { 
        executionTimeMs,
        jobId: job.id || job.jobId
      });
      
      return result;
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      
      if (isRetry) {
        this._publishWorkerEvent('WorkerRetriedJob', { jobId: job.id || job.jobId });
      } else {
        this._publishWorkerEvent('WorkerFailedJob', { jobId: job.id || job.jobId, error: error.message });
      }

      this._publishWorkerEvent('WorkerIdle', { 
        executionTimeMs,
        jobId: job.id || job.jobId,
        error: error.message 
      });
      
      throw error;
    }
  }
  
  // Delegate all other hooks just in case
  async onBeforeJob(context) { if (this.worker.onBeforeJob) return this.worker.onBeforeJob(context); }
  async onBeforeExecution(context) { if (this.worker.onBeforeExecution) return this.worker.onBeforeExecution(context); }
  async onAfterExecution(context, result) { if (this.worker.onAfterExecution) return this.worker.onAfterExecution(context, result); }
  async onAfterCleanup(context) { if (this.worker.onAfterCleanup) return this.worker.onAfterCleanup(context); }

  getActiveJobCount() {
    return typeof this.worker.getActiveJobCount === 'function' ? this.worker.getActiveJobCount() : 0;
  }

  cancelAllActiveJobs(reason) {
    if (typeof this.worker.cancelAllActiveJobs === 'function') {
      this.worker.cancelAllActiveJobs(reason);
    }
  }

  stop() {
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
    }
    this._publishWorkerEvent('WorkerStopped');
  }
}

module.exports = WorkerMonitorDecorator;
