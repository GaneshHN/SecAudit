const { IRepositoryHealth } = require('./IRepositoryHealth');

class IEventRepository extends IRepositoryHealth {
  /**
   * @param {BaseEvent} event 
   * @returns {Promise<void>}
   * @throws {PersistenceException}
   */
  async saveEvent(event) {
    throw new Error('Not implemented');
  }

  /**
   * @param {string} jobId 
   * @returns {Promise<Array<BaseEvent>>}
   */
  async getEventsForJob(jobId) {
    throw new Error('Not implemented');
  }

  /**
   * Soft-deletes events associated with a job ID.
   * @param {string} jobId 
   * @returns {Promise<void>}
   */
  async deleteEventsForJob(jobId) {
    throw new Error('Not implemented');
  }
}

module.exports = IEventRepository;
