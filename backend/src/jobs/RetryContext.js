const ExponentialBackoffStrategy = require('./ExponentialBackoffStrategy');

/**
 * Encapsulates retry metadata for a job to avoid scattering state.
 */
class RetryContext {
  constructor({
    jobId,
    currentAttempt = 0,
    maxAttempts = 3,
    failureCategory = 'Unknown',
    retryStrategy = new ExponentialBackoffStrategy(),
    previousDelayMs = 0,
    history = []
  } = {}) {
    this.jobId = jobId;
    this.currentAttempt = currentAttempt;
    this.maxAttempts = maxAttempts;
    this.failureCategory = failureCategory;
    this.retryStrategy = retryStrategy; // E.g., an instance of ExponentialBackoffStrategy
    this.previousDelayMs = previousDelayMs;
    this.history = Array.isArray(history) ? history : [];
  }

  /**
   * Prepares context for the next attempt.
   * @param {string} category 
   * @param {string} workerId 
   * @param {string} correlationId 
   */
  recordAttempt(category, workerId, correlationId) {
    this.currentAttempt += 1;
    this.failureCategory = category;
    const delay = this.retryStrategy.calculateDelay(this.currentAttempt);
    
    this.history.push({
      attemptNumber: this.currentAttempt,
      timestamp: new Date().toISOString(),
      failureCategory: category,
      delayAppliedMs: delay,
      workerId: workerId || 'unknown',
      correlationId: correlationId || 'unknown',
    });

    this.previousDelayMs = delay;
    return delay;
  }

  toJSON() {
    return {
      jobId: this.jobId,
      currentAttempt: this.currentAttempt,
      maxAttempts: this.maxAttempts,
      failureCategory: this.failureCategory,
      previousDelayMs: this.previousDelayMs,
      history: this.history,
    };
  }

  static fromJSON(data) {
    if (!data) return null;
    return new RetryContext({
      jobId: data.jobId,
      currentAttempt: data.currentAttempt,
      maxAttempts: data.maxAttempts,
      failureCategory: data.failureCategory,
      previousDelayMs: data.previousDelayMs,
      history: data.history,
    });
  }
}

module.exports = RetryContext;
