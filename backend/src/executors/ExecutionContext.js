const StaticProgressStrategy = require('../jobs/StaticProgressStrategy');

class ExecutionContext {
  constructor({
    job,
    workerId,
    correlationId,
    logger = console,
    config = {},
    cancellationToken,
    repository,
    progressReporter,
    progressStrategy = new StaticProgressStrategy()
  }) {
    this.job = job;
    this.workerId = workerId;
    this.correlationId = correlationId;
    this.logger = logger;
    this.config = config;
    this.cancellationToken = cancellationToken;
    this.repository = repository;
    this.progressReporter = progressReporter; // Low-level reporter for coupling to job
    this.progressStrategy = progressStrategy;
  }

  /**
   * Reports progress using the defined progress strategy.
   * @param {Object} stage 
   * @param {Object} metrics 
   */
  reportProgress(stage, metrics = {}) {
    if (!this.progressStrategy) return;
    
    // Strategy calculates snapshot
    const snapshot = this.progressStrategy.calculateProgress(stage, metrics);
    
    if (this.progressReporter) {
      this.progressReporter(snapshot, stage);
    }
  }
}

module.exports = ExecutionContext;
