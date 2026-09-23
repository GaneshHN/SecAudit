const EventEmitter = require('events');

/**
 * Global Typed Event Emitter for Job Lifecycle Events.
 */
class JobEventEmitter extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);
  }

  emitJobQueued(job) {
    this.emit('job:queued', job);
  }

  emitJobStarted(job) {
    this.emit('job:started', job);
  }

  emitJobProgress(job, progress, step) {
    this.emit('job:progress', { jobId: job.id || job.jobId, progress, step });
  }

  emitJobCompleted(job, result) {
    this.emit('job:completed', { job, result });
  }

  emitJobFailed(job, error) {
    this.emit('job:failed', { job, error: error?.message || String(error) });
  }

  emitJobRetrying(job, attempt, error) {
    this.emit('job:retrying', { job, attempt, error: error?.message || String(error) });
  }

  emitJobCancelled(job) {
    this.emit('job:cancelled', job);
  }
}

// Global Singleton Instance
const jobEvents = new JobEventEmitter();

module.exports = { JobEventEmitter, jobEvents };
