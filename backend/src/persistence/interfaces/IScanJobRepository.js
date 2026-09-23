const { IRepositoryHealth } = require('./IRepositoryHealth');

/**
 * Interface for ScanJob persistence.
 */
class IScanJobRepository extends IRepositoryHealth {
  /**
   * Retrieves a ScanJob by its ID (excluding soft-deleted ones by default).
   * @param {string} id 
   * @returns {Promise<ScanJob|null>}
   * @throws {EntityNotFoundException}
   */
  async getById(id) {
    throw new Error('Not implemented');
  }

  /**
   * Saves or updates a ScanJob. Should perform optimistic locking check.
   * @param {ScanJob} job 
   * @returns {Promise<void>}
   * @throws {OptimisticLockException}
   * @throws {PersistenceException}
   */
  async save(job) {
    throw new Error('Not implemented');
  }

  /**
   * Soft-deletes a ScanJob by its ID.
   * @param {string} id 
   * @returns {Promise<void>}
   * @throws {EntityNotFoundException}
   */
  async delete(id) {
    throw new Error('Not implemented');
  }

  /**
   * Queries ScanJobs based on a filter.
   * @param {Object} filter - e.g. { status, userId, limit, offset, includeDeleted }
   * @returns {Promise<Array<ScanJob>>}
   */
  async query(filter = {}) {
    throw new Error('Not implemented');
  }
}

module.exports = IScanJobRepository;
