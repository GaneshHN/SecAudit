class IWorker {
  /**
   * Start listening for jobs.
   */
  start() {
    throw new Error('IWorker subclass must implement start()');
  }

  /**
   * Process a single job.
   * @param {ScanJob} job
   */
  async processJob(job) {
    throw new Error('IWorker subclass must implement processJob()');
  }
}

module.exports = IWorker;
