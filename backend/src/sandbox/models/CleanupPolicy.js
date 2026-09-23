/**
 * Determines when the sandbox workspace should be cleaned up.
 */
const CleanupPolicy = {
  ALWAYS: 'ALWAYS',
  ON_SUCCESS: 'ON_SUCCESS',
  NEVER: 'NEVER',
  DEBUG: 'DEBUG'
};

module.exports = CleanupPolicy;
