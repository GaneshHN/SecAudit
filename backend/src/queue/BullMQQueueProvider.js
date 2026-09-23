const IQueueProvider = require('./IQueueProvider');
const { jobEvents } = require('../events/JobEvents');

class BullMQQueueProvider extends IQueueProvider {
  constructor(name = 'scan-queue', redisOptions = {}) {
    super();
    this.name = name;
    this.redisOptions = redisOptions;
    this.queue = null;
    this.worker = null;
    this.isInitialized = false;
  }

  _createRedisConnection() {
    const IORedis = require('ioredis');
    const url = this.redisOptions.url;

    const baseOpts = {
      family: 4,
      maxRetriesPerRequest: null,
      connectTimeout: 5000,
      commandTimeout: 5000,
    };

    if (url) {
      if (url.startsWith('rediss://')) {
        baseOpts.tls = {};
      }
      return new IORedis(url, baseOpts);
    }

    if (this.redisOptions.tls === true) {
       baseOpts.tls = {};
    } else if (this.redisOptions.tls) {
       baseOpts.tls = this.redisOptions.tls;
    }

    return new IORedis({
      ...this.redisOptions,
      ...baseOpts
    });
  }

  async initialize() {
    if (this.isInitialized && this.queue) {
      return;
    }
    if (this._initPromise) {
      return this._initPromise;
    }
    this._initPromise = this._doInitialize().finally(() => {
      this._initPromise = null;
    });
    return this._initPromise;
  }

  async _doInitialize() {
    try {
      const { Queue } = require('bullmq');

      const connection = this._createRedisConnection();

      // Verify connectivity before declaring initialized
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          connection.disconnect();
          reject(new Error('Redis connection timeout after 5000ms'));
        }, 5000);

        connection.once('ready', () => {
          clearTimeout(timeout);
          resolve();
        });

        connection.once('error', (err) => {
          clearTimeout(timeout);
          connection.disconnect();
          reject(new Error(`Redis connection error: ${err.message}`));
        });
      });

      this.queue = new Queue(this.name, { connection });
      this.isInitialized = true;
    } catch (err) {
      console.warn(`[BullMQQueueProvider] Redis/BullMQ unavailable (${err.message}). Queue provider disabled.`);
      this.isInitialized = false;
      throw err;
    }
  }

  async enqueue(jobType, payload, options = {}) {
    await this.initialize();

    if (!this.isInitialized || !this.queue) {
      throw new Error('BullMQ queue provider is not initialized or Redis is unreachable');
    }
    const job = await this.queue.add(jobType, payload, options);
    jobEvents.emitCreated({ id: job.id, name: jobType, data: payload });
    return { id: job.id, jobId: job.id, name: jobType, data: payload, status: 'QUEUED' };
  }

  process(jobType, handler, options = {}) {
    console.log('[BullMQQueueProvider] process() called with jobType:', jobType, 'typeof handler:', typeof handler);
    const { Worker } = require('bullmq');

    const connection = this._createRedisConnection();

    this.worker = new Worker(this.name, async (job) => {
      jobEvents.emitStarted({ id: job.id, name: job.name, data: job.data });
      return await handler(job.data);
    }, { connection, concurrency: options.concurrency || 4 });

    this.worker.on('completed', (job, result) => {
      jobEvents.emitCompleted({ id: job.id }, result);
    });

    this.worker.on('failed', (job, err) => {
      jobEvents.emitFailed({ id: job.id }, err);
    });

    this.worker.on('error', (err) => console.error('[BullMQ Worker Error]', err));
  }

  async getJob(jobId) {
    try { await this.initialize(); } catch(e) {}
    if (!this.queue) return null;
    const job = await this.queue.getJob(jobId);
    if (!job) return null;
    const state = await job.getState();
    return { id: job.id, jobId: job.id, status: state.toUpperCase(), data: job.data };
  }

  async removeJob(jobId) {
    try { await this.initialize(); } catch(e) {}
    if (!this.queue) return false;
    const job = await this.queue.getJob(jobId);
    if (job) {
      await job.remove();
      return true;
    }
    return false;
  }

  async getStats() {
    try { await this.initialize(); } catch(e) {}
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

module.exports = BullMQQueueProvider;
