const IFailurePolicy = require('./IFailurePolicy');

/**
 * No Retry Policy
 * Explicitly denies all retries.
 */
class NoRetryPolicy extends IFailurePolicy {
  canRetry(retryContext) {
    return false;
  }
}

module.exports = NoRetryPolicy;
