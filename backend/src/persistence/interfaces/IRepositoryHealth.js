/**
 * Defines health states for a repository.
 */
const RepositoryHealthState = {
  HEALTHY: 'Healthy',
  DEGRADED: 'Degraded',
  UNAVAILABLE: 'Unavailable'
};

/**
 * Interface for checking repository health.
 */
class IRepositoryHealth {
  /**
   * Returns the current health state of the repository.
   * @returns {Promise<string>} RepositoryHealthState
   */
  async checkHealth() {
    throw new Error('Not implemented');
  }
}

module.exports = {
  RepositoryHealthState,
  IRepositoryHealth
};
