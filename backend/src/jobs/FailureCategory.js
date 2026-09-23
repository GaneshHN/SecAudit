/**
 * Enumeration of Failure Categories
 * Influences retry eligibility and metrics tracking.
 */
const FailureCategory = {
  VALIDATION: 'Validation',
  AUTHENTICATION: 'Authentication',
  AUTHORIZATION: 'Authorization',
  NETWORK: 'Network',
  REPOSITORY: 'Repository',
  STORAGE: 'Storage',
  SCANNER: 'Scanner',
  INTERNAL: 'Internal',
  UNKNOWN: 'Unknown',
};

/**
 * Maps common error types or messages to a FailureCategory.
 * @param {Error} error 
 * @returns {string} FailureCategory
 */
function categorizeError(error) {
  if (!error) return FailureCategory.UNKNOWN;

  const msg = (error.message || '').toLowerCase();
  
  if (error.isValidation || msg.includes('validation')) {
    return FailureCategory.VALIDATION;
  }
  
  if (msg.includes('network') || msg.includes('econnrefused') || msg.includes('timeout')) {
    return FailureCategory.NETWORK;
  }
  
  if (msg.includes('auth') || msg.includes('credentials') || msg.includes('forbidden') || msg.includes('401') || msg.includes('403')) {
    return FailureCategory.AUTHENTICATION; // Simplification, could split 403 to AuthZ
  }
  
  if (msg.includes('repository') || msg.includes('git') || msg.includes('not found') || msg.includes('404')) {
    return FailureCategory.REPOSITORY;
  }

  if (msg.includes('storage') || msg.includes('disk') || msg.includes('enoent') || msg.includes('enospc')) {
    return FailureCategory.STORAGE;
  }

  if (msg.includes('scanner') || msg.includes('plugin') || msg.includes('engine')) {
    return FailureCategory.SCANNER;
  }

  if (error.isInternal || msg.includes('internal')) {
    return FailureCategory.INTERNAL;
  }

  return FailureCategory.UNKNOWN;
}

module.exports = { FailureCategory, categorizeError };
