const { IRepositoryHealth } = require('./IRepositoryHealth');

class IScanResultRepository extends IRepositoryHealth {
  /**
   * @param {string} jobId 
   * @param {Object} result 
   * @returns {Promise<void>}
   * @throws {PersistenceException}
   */
  async save(jobId, result) {
    throw new Error('Not implemented');
  }

  /**
   * @param {string} jobId 
   * @returns {Promise<Object|null>}
   * @throws {EntityNotFoundException}
   */
  async getByJobId(jobId) {
    throw new Error('Not implemented');
  }

  /**
   * Soft-deletes a scan result.
   * @param {string} jobId 
   * @returns {Promise<void>}
   * @throws {EntityNotFoundException}
   */
  async delete(jobId) {
    throw new Error('Not implemented');
  }
}

module.exports = IScanResultRepository;
