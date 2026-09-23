const IRetryStrategy = require('./IRetryStrategy');

/**
 * Exponential Backoff Strategy with Jitter
 */
class ExponentialBackoffStrategy extends IRetryStrategy {
  constructor(initialDelayMs = 1000, maxDelayMs = 60000, multiplier = 2, jitterFactor = 0.2) {
    super();
    this.initialDelayMs = initialDelayMs;
    this.maxDelayMs = maxDelayMs;
    this.multiplier = multiplier;
    this.jitterFactor = jitterFactor; // 0.2 means +/- 20%
  }

  calculateDelay(attempt) {
    if (attempt <= 0) return 0;

    let delay = this.initialDelayMs * Math.pow(this.multiplier, attempt - 1);
    
    // Apply jitter
    if (this.jitterFactor > 0) {
      const jitterRange = delay * this.jitterFactor;
      const jitter = (Math.random() * (jitterRange * 2)) - jitterRange;
      delay += jitter;
    }

    // Clamp
    delay = Math.min(delay, this.maxDelayMs);
    delay = Math.max(delay, 0);

    return Math.round(delay);
  }
}

module.exports = ExponentialBackoffStrategy;
