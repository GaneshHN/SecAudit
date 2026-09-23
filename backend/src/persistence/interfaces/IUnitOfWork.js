/**
 * Unit of Work interface to coordinate transactions and repository access.
 */
class IUnitOfWork {
  /**
   * @returns {IScanJobRepository}
   */
  get scanJobs() {
    throw new Error('Not implemented');
  }

  /**
   * @returns {IScanResultRepository}
   */
  get scanResults() {
    throw new Error('Not implemented');
  }

  /**
   * @returns {IEventRepository}
   */
  get events() {
    throw new Error('Not implemented');
  }

  /**
   * Commits the current transaction.
   * @returns {Promise<void>}
   */
  async commit() {
    throw new Error('Not implemented');
  }

  /**
   * Rolls back the current transaction.
   * @returns {Promise<void>}
   */
  async rollback() {
    throw new Error('Not implemented');
  }
}

module.exports = IUnitOfWork;
