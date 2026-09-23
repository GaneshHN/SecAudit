const IScanJobRepository = require('../../interfaces/IScanJobRepository');
const { RepositoryHealthState } = require('../../interfaces/IRepositoryHealth');

class PostgreSqlScanJobRepository extends IScanJobRepository {
  constructor(pool) {
    super();
    this.pool = pool;
  }

  async getById(id) {
    throw new Error('Not implemented');
  }

  async save(job) {
    throw new Error('Not implemented');
  }

  async delete(id) {
    throw new Error('Not implemented');
  }

  async query(filter = {}) {
    throw new Error('Not implemented');
  }

  async checkHealth() {
    return RepositoryHealthState.UNAVAILABLE;
  }
}

module.exports = PostgreSqlScanJobRepository;
