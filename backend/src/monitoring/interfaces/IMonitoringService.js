/**
 * IMonitoringService
 * Interface for the passive observability layer.
 * Collects metrics and exposes health and statistics without 
 * executing or interfering with business logic.
 */
class IMonitoringService {
  /**
   * Initializes the monitoring service (e.g., subscribing to the event bus)
   */
  start() {
    throw new Error('Method not implemented.');
  }

  /**
   * Stops the monitoring service (e.g., unsubscribing)
   */
  stop() {
    throw new Error('Method not implemented.');
  }

  /**
   * Returns aggregated queue statistics
   * @returns {Object}
   */
  getQueueMetrics() {
    throw new Error('Method not implemented.');
  }

  /**
   * Returns aggregated worker statistics
   * @returns {Object}
   */
  getWorkerMetrics() {
    throw new Error('Method not implemented.');
  }

  /**
   * Returns aggregated scanner/domain statistics
   * @returns {Object}
   */
  getScannerMetrics() {
    throw new Error('Method not implemented.');
  }

  /**
   * Returns aggregated repository/database metrics
   * @returns {Object}
   */
  getRepositoryMetrics() {
    throw new Error('Method not implemented.');
  }
}

module.exports = IMonitoringService;
