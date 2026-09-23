/**
 * MonitoringSnapshot Model
 * Standardizes the data structure representing the observability state
 * at any given point in time.
 */
class MonitoringSnapshot {
  constructor({ queue, scanner, worker, repository }) {
    this.timestamp = new Date().toISOString();
    this.queue = queue;
    this.scanner = scanner;
    this.worker = worker;
    this.repository = repository;
  }

  toJSON() {
    return {
      timestamp: this.timestamp,
      queue: this.queue,
      scanner: this.scanner,
      worker: this.worker,
      repository: this.repository
    };
  }
}

module.exports = MonitoringSnapshot;
