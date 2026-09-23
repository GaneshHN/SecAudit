/**
 * Abstract Queue Interface Contract.
 * Ensures the core engine and workers stay completely decoupled from specific queue implementations.
 */
class QueueInterface {
  /**
   * Add a job to the queue.
   * @param {string} name - Job type/name
   * @param {Object} data - Payload
   * @param {Object} options - Job options (priority, delay, retries, etc.)
   * @returns {Promise<Object>} The enqueued job reference
   */
  async add(name, data, options = {}) {
    throw new Error('QueueInterface subclass must implement add()');
  }

  /**
   * Register a worker processing handler for jobs.
   * @param {Function} handler - Async worker handler function
   * @param {Object} options - Worker options (concurrency, etc.)
   */
  process(handler, options = {}) {
    throw new Error('QueueInterface subclass must implement process()');
  }

  /**
   * Retrieve job by ID.
   * @param {string} jobId 
   */
  async getJob(jobId) {
    throw new Error('QueueInterface subclass must implement getJob()');
  }

  /**
   * Remove/cancel a job by ID.
   * @param {string} jobId 
   */
  async removeJob(jobId) {
    throw new Error('QueueInterface subclass must implement removeJob()');
  }

  /**
   * Get queue statistics & utilization metrics.
   */
  async getStats() {
    throw new Error('QueueInterface subclass must implement getStats()');
  }

  /**
   * Graceful shutdown of queue.
   */
  async close() {
    throw new Error('QueueInterface subclass must implement close()');
  }
}

module.exports = QueueInterface;
