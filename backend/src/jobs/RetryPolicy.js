const IFailurePolicy = require('./IFailurePolicy');
const { FailureCategory } = require('./FailureCategory');

/**
 * Standard Retry Policy
 * Permits retries unless max attempts are exhausted or the error is non-transient.
 */
class RetryPolicy extends IFailurePolicy {
  canRetry(retryContext) {
    if (!retryContext) return false;
    
    // Non-retryable categories (Non-transient)
    const nonRetryableCategories = [
      FailureCategory.VALIDATION,
      FailureCategory.AUTHENTICATION,
      FailureCategory.AUTHORIZATION,
      FailureCategory.REPOSITORY // e.g. Repository not found won't magically appear
    ];

    if (nonRetryableCategories.includes(retryContext.failureCategory)) {
      return false;
    }

    // Exhausted attempts
    if (retryContext.currentAttempt >= retryContext.maxAttempts) {
      return false;
    }

    return true;
  }
}

module.exports = RetryPolicy;
