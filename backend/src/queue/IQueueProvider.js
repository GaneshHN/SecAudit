/**
 * Abstract IQueueProvider Interface Contract.
 * All Queue Providers (InMemory, BullMQ, Redis, RabbitMQ, SQS, etc.) must implement this interface.
 */
class IQueueProvider {
  /**
   * Enqueue a job into the queue.
   * @param {string} jobType 
   * @param {Object} payload 
   * @param {Object} options 
   * @returns {Promise<Object>} Enqueued job object
   */
  async enqueue(jobType, payload, options = {}) {
    throw new Error('IQueueProvider subclass must implement enqueue()');
  }

  /**
   * Register a worker processing handler for jobs.
   * @param {string} jobType 
   * @param {Function} handler 
   * @param {Object} options 
   */
  process(jobType, handler, options = {}) {
    throw new Error('IQueueProvider subclass must implement process()');
  }

  /**
   * Get job status and details by ID.
   * @param {string} jobId 
   */
  async getJob(jobId) {
    throw new Error('IQueueProvider subclass must implement getJob()');
  }

  /**
   * Remove/cancel job by ID.
   * @param {string} jobId 
   */
  async removeJob(jobId) {
    throw new Error('IQueueProvider subclass must implement removeJob()');
  }

  /**
   * Retrieve queue metrics and statistics.
   */
  async getStats() {
    throw new Error('IQueueProvider subclass must implement getStats()');
  }

  /**
   * Gracefully close queue connection.
   */
  async close() {
    throw new Error('IQueueProvider subclass must implement close()');
  }
}

module.exports = IQueueProvider;
