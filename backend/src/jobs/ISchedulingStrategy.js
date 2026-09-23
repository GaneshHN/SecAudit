/**
 * ISchedulingStrategy Abstraction
 * Determines the execution order of jobs in a queue.
 */
class ISchedulingStrategy {
  /**
   * Sorts the queue according to strategy rules.
   * @param {Array<string>} waitingQueue Array of job IDs
   * @param {Map<string, ScanJob>} jobs Map of job ID to job instances
   * @returns {Array<string>} The newly sorted waitingQueue
   */
  sort(waitingQueue, jobs) {
    throw new Error('Method not implemented.');
  }

  /**
   * Periodically called to apply aging or starvation prevention.
   * @param {Map<string, ScanJob>} jobs Map of job ID to job instances
   * @returns {boolean} True if any job's priority changed, false otherwise.
   */
  applyAging(jobs) {
    throw new Error('Method not implemented.');
  }
}

module.exports = ISchedulingStrategy;
