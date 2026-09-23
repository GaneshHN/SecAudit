const QueueInterface = require('./QueueInterface');
const { jobEvents } = require('../events/JobEventEmitter');

/**
 * Production-grade In-Memory Queue Engine with BullMQ-compatible interface.
 * Supports:
 * - Priority-based job scheduling
 * - Configurable retries & exponential backoff
 * - Delayed job execution
 * - Concurrency bounds
 * - Granular status metrics
 */
class InMemoryQueue extends QueueInterface {
  constructor(name = 'scan-queue', options = {}) {
    super();
    this.name = name;
    this.concurrency = options.concurrency || 4;
    this.jobs = new Map(); // jobId -> job state object
    this.waitingQueue = []; // Array of jobIds sorted by priority & creation time
    this.activeJobs = new Set(); // Currently running jobIds
    this.handler = null;
    this.isProcessing = false;
    this.delayedTimers = new Map();
    this.metrics = {
      completedCount: 0,
      failedCount: 0,
      totalDurationMs: 0,
    };
  }

  /**
   * Add a job to the queue.
   */
  async add(name, data, options = {}) {
    const jobId = options.jobId || data.jobId || `job_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const priority = options.priority !== undefined ? options.priority : 0; // Higher number = higher priority
    const maxRetries = options.attempts !== undefined ? options.attempts : 3;
    const backoffMs = options.backoff !== undefined ? (typeof options.backoff === 'number' ? options.backoff : 1000) : 1000;
    const delayMs = options.delay || 0;

    const jobRecord = {
      id: jobId,
      name,
      data,
      opts: { priority, attempts: maxRetries, backoff: backoffMs, delay: delayMs, ...options },
      status: delayMs > 0 ? 'delayed' : 'queued',
      progress: 0,
      attemptsMade: 0,
      failedReason: null,
      timestamp: Date.now(),
      processedOn: null,
      finishedOn: null,
    };

    this.jobs.set(jobId, jobRecord);
    jobEvents.emitJobQueued(jobRecord);

    if (delayMs > 0) {
      const timer = setTimeout(() => {
        this.delayedTimers.delete(jobId);
        if (this.jobs.has(jobId) && this.jobs.get(jobId).status === 'delayed') {
          this.jobs.get(jobId).status = 'queued';
          this._enqueueWaiting(jobId);
          this._triggerProcess();
        }
      }, delayMs);
      this.delayedTimers.set(jobId, timer);
    } else {
      this._enqueueWaiting(jobId);
      this._triggerProcess();
    }

    return jobRecord;
  }

  _enqueueWaiting(jobId) {
    if (!this.waitingQueue.includes(jobId)) {
      this.waitingQueue.push(jobId);
      // Sort waiting queue by priority descending, then timestamp ascending
      this.waitingQueue.sort((a, b) => {
        const jobA = this.jobs.get(a);
        const jobB = this.jobs.get(b);
        if (!jobA || !jobB) return 0;
        if (jobA.opts.priority !== jobB.opts.priority) {
          return jobB.opts.priority - jobA.opts.priority;
        }
        return jobA.timestamp - jobB.timestamp;
      });
    }
  }

  /**
   * Register a worker processing handler for jobs.
   */
  process(handler, options = {}) {
    if (options.concurrency) {
      this.concurrency = options.concurrency;
    }
    this.handler = handler;
    this.isProcessing = true;
    this._triggerProcess();
  }

  async _triggerProcess() {
    if (!this.isProcessing || !this.handler) return;

    while (this.activeJobs.size < this.concurrency && this.waitingQueue.length > 0) {
      const jobId = this.waitingQueue.shift();
      const job = this.jobs.get(jobId);

      if (!job || job.status === 'cancelled') continue;

      this.activeJobs.add(jobId);
      job.status = 'running';
      job.processedOn = Date.now();
      jobEvents.emitJobStarted(job);

      // Execute worker asynchronously
      this._runJobWorker(job).finally(() => {
        this.activeJobs.delete(jobId);
        this._triggerProcess();
      });
    }
  }

  async _runJobWorker(job) {
    job.attemptsMade++;
    try {
      const result = await this.handler(job);
      job.status = 'completed';
      job.progress = 100;
      job.finishedOn = Date.now();
      job.result = result;

      const duration = job.finishedOn - job.processedOn;
      this.metrics.completedCount++;
      this.metrics.totalDurationMs += duration;

      jobEvents.emitJobCompleted(job, result);
      return result;
    } catch (err) {
      const errorMsg = err?.message || String(err);
      job.failedReason = errorMsg;

      if (job.attemptsMade < job.opts.attempts) {
        job.status = 'retrying';
        const backoffDelay = Math.pow(2, job.attemptsMade - 1) * job.opts.backoff;
        jobEvents.emitJobRetrying(job, job.attemptsMade, err);

        setTimeout(() => {
          if (this.jobs.has(job.id) && this.jobs.get(job.id).status === 'retrying') {
            job.status = 'queued';
            this._enqueueWaiting(job.id);
            this._triggerProcess();
          }
        }, backoffDelay);
      } else {
        job.status = 'failed';
        job.finishedOn = Date.now();
        this.metrics.failedCount++;
        jobEvents.emitJobFailed(job, err);
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
      job.status = 'cancelled';
      jobEvents.emitJobCancelled(job);
    }
    return true;
  }

  async getStats() {
    let queued = 0;
    let running = this.activeJobs.size;
    let delayed = this.delayedTimers.size;
    let completed = this.metrics.completedCount;
    let failed = this.metrics.failedCount;

    for (const job of this.jobs.values()) {
      if (job.status === 'queued') queued++;
    }

    const avgDurationSeconds = completed > 0 ? (this.metrics.totalDurationMs / completed / 1000).toFixed(2) : 0;

    return {
      name: this.name,
      concurrency: this.concurrency,
      totalJobs: this.jobs.size,
      queued,
      running,
      delayed,
      completed,
      failed,
      avgDurationSeconds: parseFloat(avgDurationSeconds),
      utilization: `${Math.round((running / this.concurrency) * 100)}%`,
    };
  }

  async close() {
    this.isProcessing = false;
    for (const timer of this.delayedTimers.values()) {
      clearTimeout(timer);
    }
    this.delayedTimers.clear();
  }
}

module.exports = InMemoryQueue;
