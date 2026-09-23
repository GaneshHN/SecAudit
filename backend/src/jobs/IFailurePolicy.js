/**
 * IFailurePolicy Abstraction
 * Separates retry decision logic from retry scheduling.
 */
class IFailurePolicy {
  /**
   * Determines if a job is eligible for a retry.
   * @param {RetryContext} retryContext 
   * @returns {boolean} true if retry is permitted, false otherwise
   */
  canRetry(retryContext) {
    throw new Error('Method not implemented.');
  }
}

module.exports = IFailurePolicy;
