/**
 * IRetryStrategy Abstraction
 * Calculates the delay for the next retry attempt.
 */
class IRetryStrategy {
  /**
   * Calculates delay in milliseconds.
   * @param {number} attempt - The current retry attempt (1-based)
   * @returns {number} delay in ms
   */
  calculateDelay(attempt) {
    throw new Error('Method not implemented.');
  }
}

module.exports = IRetryStrategy;
