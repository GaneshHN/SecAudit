const InMemoryQueueProvider = require('./InMemoryQueueProvider');
const BullMQQueueProvider = require('./BullMQQueueProvider');

/**
 * Queue Service Registry & Facade.
 */
class QueueService {
  constructor() {
    this.queues = new Map();
  }

  /**
   * Get or instantiate an IQueueProvider queue.
   * @param {string} queueName 
   * @param {Object} options 
   * @returns {IQueueProvider}
   */
  getQueue(queueName = 'scan-queue', options = {}) {
    if (this.queues.has(queueName)) {
      return this.queues.get(queueName);
    }

    const useBullMQ = process.env.REDIS_HOST || process.env.REDIS_URL;
    let provider;

    if (useBullMQ) {
      const redisOptions = process.env.REDIS_URL
        ? { url: process.env.REDIS_URL }
        : { host: process.env.REDIS_HOST || 'localhost', port: parseInt(process.env.REDIS_PORT || '6379', 10) };
      provider = new BullMQQueueProvider(queueName, redisOptions);
    } else {
      provider = new InMemoryQueueProvider(queueName, options);
    }

    this.queues.set(queueName, provider);
    return provider;
  }

  async closeAll() {
    for (const queue of this.queues.values()) {
      await queue.close();
    }
    this.queues.clear();
  }
}

const queueService = new QueueService();

module.exports = { QueueService, queueService };
