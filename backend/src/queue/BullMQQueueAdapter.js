const QueueInterface = require('./QueueInterface');
const { jobEvents } = require('../events/JobEventEmitter');

/**
 * BullMQ / Redis Queue Adapter.
 * Wraps BullMQ `Queue` and `Worker` instances while presenting the uniform `QueueInterface`.
 */
class BullMQQueueAdapter extends QueueInterface {
  constructor(name = 'scan-queue', redisOptions = {}) {
    super();
    this.name = name;
    this.redisOptions = redisOptions;
    this.queue = null;
    this.worker = null;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      const { Queue, Worker } = require('bullmq');
      this.queue = new Queue(this.name, { connection: this.redisOptions });
      this.isInitialized = true;
    } catch (err) {
      console.warn(`[BullMQQueueAdapter] Redis/BullMQ unavailable (${err.message}). Queue adapter disabled.`);
      this.isInitialized = false;
    }
  }

  async add(name, data, options = {}) {
    if (!this.isInitialized || !this.queue) {
      throw new Error('BullMQ queue is not initialized or Redis is unreachable');
    }
    const job = await this.queue.add(name, data, options);
    jobEvents.emitJobQueued({ id: job.id, name, data, opts: options });
    return { id: job.id, name, data, opts: options, status: 'queued' };
  }

  process(handler, options = {}) {
    if (!this.isInitialized) return;
    const { Worker } = require('bullmq');
    this.worker = new Worker(this.name, async (job) => {
      jobEvents.emitJobStarted({ id: job.id, name: job.name, data: job.data });
      return await handler({ id: job.id, name: job.name, data: job.data, attemptsMade: job.attemptsMade });
    }, { connection: this.redisOptions, concurrency: options.concurrency || 4 });

    this.worker.on('completed', (job, result) => {
      jobEvents.emitJobCompleted({ id: job.id }, result);
    });

    this.worker.on('failed', (job, err) => {
      jobEvents.emitJobFailed({ id: job.id }, err);
    });
  }

  async getJob(jobId) {
    if (!this.queue) return null;
    const job = await this.queue.getJob(jobId);
    if (!job) return null;
    const state = await job.getState();
    return {
      id: job.id,
      name: job.name,
      data: job.data,
      status: state,
      progress: job.progress,
      failedReason: job.failedReason,
    };
  }

  async removeJob(jobId) {
    if (!this.queue) return false;
    const job = await this.queue.getJob(jobId);
    if (job) {
      await job.remove();
      return true;
    }
    return false;
  }

  async getStats() {
    if (!this.queue) return { name: this.name, status: 'disabled' };
    const counts = await this.queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
    return {
      name: this.name,
      queued: counts.waiting,
      running: counts.active,
      completed: counts.completed,
      failed: counts.failed,
      delayed: counts.delayed,
    };
  }

  async close() {
    if (this.worker) await this.worker.close();
    if (this.queue) await this.queue.close();
  }
}

module.exports = BullMQQueueAdapter;
