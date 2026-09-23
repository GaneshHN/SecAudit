const IQueueProvider = require('./IQueueProvider');
const { ScanJob } = require('../jobs/ScanJob');
const { JOB_STATES } = require('../jobs/ScanJobStateMachine');
const { jobEvents } = require('../events/JobEvents');
const { categorizeError } = require('../jobs/FailureCategory');
const RetryPolicy = require('../jobs/RetryPolicy');
const PrioritySchedulingStrategy = require('../jobs/PrioritySchedulingStrategy');

class InMemoryQueueProvider extends IQueueProvider {
  constructor(queueName = 'default-queue', options = {}) {
    super();
    this.name = queueName;
    this.concurrency = options.concurrency || 4;
    this.jobs = new Map(); // jobId -> ScanJob
    this.waitingQueue = []; // Array of jobIds
    this.activeJobs = new Set(); // Currently executing jobIds
    this.handlers = new Map(); // jobType -> handler function
    this.isProcessing = false;
    this.delayedTimers = new Map();
    this.metrics = { completedCount: 0, failedCount: 0, totalDurationMs: 0 };
    
    // DLQ
    this.deadLetterQueue = new Map(); // jobId -> ScanJob

    // Failure Policy
    this.failurePolicy = options.failurePolicy || new RetryPolicy();

    // Scheduling Strategy
    this.schedulingStrategy = options.schedulingStrategy || new PrioritySchedulingStrategy();
    this.agingIntervalId = setInterval(() => {
      if (this.schedulingStrategy && this.jobs.size > 0) {
        const priorityChanged = this.schedulingStrategy.applyAging(this.jobs);
        if (priorityChanged && this.waitingQueue.length > 1) {
          this.waitingQueue = this.schedulingStrategy.sort(this.waitingQueue, this.jobs);
        }
      }
    }, options.agingIntervalMs || 60000);
    if (this.agingIntervalId.unref) this.agingIntervalId.unref();
  }

  async enqueue(jobType, payload, options = {}) {
    let job;
    if (payload instanceof ScanJob) {
      job = payload;
    } else {
      job = new ScanJob({
        jobId: options.jobId || payload.jobId,
        repository: payload.repository || payload.target,
        userId: payload.userId,
        priority: options.priority || payload.priority || 'Normal',
        maxRetries: options.attempts !== undefined ? options.attempts : 3,
      });
    }

    this.jobs.set(job.id, job);
    jobEvents.emitCreated(job);
    jobEvents.emitJobScheduled(job);

    const delayMs = options.delay || 0;
    if (delayMs > 0) {
      const timer = setTimeout(() => {
        this.delayedTimers.delete(job.id);
        if (this.jobs.has(job.id) && job.status === JOB_STATES.QUEUED) {
          this._enqueueWaiting(job.id);
          this._triggerProcess(jobType);
        }
      }, delayMs);
      this.delayedTimers.set(job.id, timer);
    } else {
      this._enqueueWaiting(job.id);
      this._triggerProcess(jobType);
    }

    return job;
  }

  _enqueueWaiting(jobId) {
    if (!this.waitingQueue.includes(jobId)) {
      this.waitingQueue.push(jobId);
      const job = this.jobs.get(jobId);
      if (job && job.schedulingContext) {
        job.schedulingContext.recordEnqueue();
      }
      this.waitingQueue = this.schedulingStrategy.sort(this.waitingQueue, this.jobs);
    }
  }

  process(jobType, handler, options = {}) {
    if (options.concurrency) {
      this.concurrency = options.concurrency;
    }
    this.handlers.set(jobType, handler);
    this.isProcessing = true;
    this._triggerProcess(jobType);
  }

  async _triggerProcess(jobType) {
    if (!this.isProcessing || !this.handlers.has(jobType)) return;
    const handler = this.handlers.get(jobType);

    while (this.activeJobs.size < this.concurrency && this.waitingQueue.length > 0) {
      const jobId = this.waitingQueue.shift();
      const job = this.jobs.get(jobId);

      if (!job || [JOB_STATES.COMPLETED, JOB_STATES.FAILED, JOB_STATES.CANCELLED].includes(job.status)) continue;

      if (job.schedulingContext) {
        job.schedulingContext.recordDequeue();
        jobEvents.emitJobDequeued(job, job.schedulingContext.queueTimeMs);
      }

      this.activeJobs.add(jobId);

      // Execute worker asynchronously
      this._runJobWorker(job, handler, jobType).finally(() => {
        this.activeJobs.delete(jobId);
        this._triggerProcess(jobType);
      });
    }
  }

  async _runJobWorker(job, handler, jobType) {
    try {
      if (job.status !== JOB_STATES.RUNNING) {
        job.transitionTo(JOB_STATES.RUNNING);
      }
      const result = await handler(job);
      job.result = result;
      
      // If we got here, it's a success
      if (job.retryContext && job.retryContext.currentAttempt > 0) {
        jobEvents.emitRetrySucceeded(job, job.retryContext);
      }

      job.transitionTo(JOB_STATES.COMPLETED);

      if (job.startedTime && job.completedTime) {
        const duration = new Date(job.completedTime).getTime() - new Date(job.startedTime).getTime();
        this.metrics.completedCount++;
        this.metrics.totalDurationMs += duration;
        
        if (job.schedulingContext) {
          job.schedulingContext.estimatedRuntimeMs = duration;
        }
      }
      return result;
    } catch (err) {
      const errorMsg = err?.message || String(err);
      job.error = errorMsg;

      // Ensure failure category is identified
      const category = categorizeError(err);
      job.retryContext.failureCategory = category;

      if (job.schedulingContext) {
        job.schedulingContext.failureCount++;
      }

      if (this.failurePolicy.canRetry(job.retryContext)) {
        job.transitionTo(JOB_STATES.RETRYING);

        // Record the attempt which updates delay
        const delay = job.retryContext.recordAttempt(category, job.workerId, job.metadata?.correlationId);

        if (job.schedulingContext) {
           job.schedulingContext.retryCount = job.retryContext.currentAttempt;
        }

        jobEvents.emitRetryScheduled(job, job.retryContext);
        jobEvents.emitRetrying(job, job.retryContext.currentAttempt, err); // Backward compatibility

        const timer = setTimeout(() => {
          this.delayedTimers.delete(job.id);
          if (this.jobs.has(job.id) && job.status === JOB_STATES.RETRYING) {
            jobEvents.emitRetryStarted(job, job.retryContext);
            job.transitionTo(JOB_STATES.QUEUED);
            this._enqueueWaiting(job.id);
            this._triggerProcess(jobType);
          }
        }, delay);
        this.delayedTimers.set(job.id, timer);

      } else {
        // Retries exhausted or non-transient error
        if (job.retryContext.currentAttempt >= job.maxRetries) {
          jobEvents.emitRetriesExhausted(job, job.retryContext, err);
        } else {
          jobEvents.emitRetryFailed(job, job.retryContext, err);
        }

        job.transitionTo(JOB_STATES.FAILED);
        this.metrics.failedCount++;
        
        // Push to Dead Letter Queue
        job.isDeadLetter = true;
        this.deadLetterQueue.set(job.id, job);
      }
    }
  }

  async getJob(jobId) {
    return this.jobs.get(jobId) || null;
  }

  async removeJob(jobId) {
    if (this.delayedTimers.has(jobId)) {
      clearTimeout(this.delayedTimers.get(jobId));
      this.delayedTimers.delete(jobId);
    }
    const idx = this.waitingQueue.indexOf(jobId);
    if (idx !== -1) {
      this.waitingQueue.splice(idx, 1);
    }
    const job = this.jobs.get(jobId);
    if (job) {
      job.transitionTo(JOB_STATES.CANCELLED);
    }
    return true;
  }

  async getStats() {
    let queued = 0;
    let running = this.activeJobs.size;
    let delayed = this.delayedTimers.size;
    let completed = this.metrics.completedCount;
    let failed = this.metrics.failedCount;
    let totalWaitTime = 0;

    for (const job of this.jobs.values()) {
      if (job.status === JOB_STATES.QUEUED) queued++;
      if (job.schedulingContext) {
         totalWaitTime += job.schedulingContext.queueTimeMs;
      }
    }

    const avgDurationSeconds = completed > 0 ? (this.metrics.totalDurationMs / completed / 1000).toFixed(2) : 0;
    const avgWaitTimeMs = this.jobs.size > 0 ? (totalWaitTime / this.jobs.size).toFixed(0) : 0;

    let retryAttemptsTotal = 0;
    let retriedJobs = 0;
    for (const job of this.jobs.values()) {
      if (job.retryContext && job.retryContext.currentAttempt > 0) {
        retriedJobs++;
        retryAttemptsTotal += job.retryContext.currentAttempt;
      }
    }
    const averageAttempts = retriedJobs > 0 ? (retryAttemptsTotal / retriedJobs).toFixed(2) : 0;

    return {
      name: this.name,
      concurrency: this.concurrency,
      totalJobs: this.jobs.size,
      queued,
      running,
      delayed,
      completed,
      failed,
      dlqSize: this.deadLetterQueue.size,
      averageAttempts: parseFloat(averageAttempts),
      avgDurationSeconds: parseFloat(avgDurationSeconds),
      avgWaitTimeMs: parseFloat(avgWaitTimeMs),
      utilization: `${Math.round((running / this.concurrency) * 100)}%`,
    };
  }

  async close() {
    this.isProcessing = false;
    for (const timer of this.delayedTimers.values()) {
      clearTimeout(timer);
    }
    this.delayedTimers.clear();
    
    if (this.agingIntervalId) {
      clearInterval(this.agingIntervalId);
    }
  }
}

module.exports = InMemoryQueueProvider;
