const IScanJobRepository = require('../../interfaces/IScanJobRepository');
const { RepositoryHealthState } = require('../../interfaces/IRepositoryHealth');

class RedisScanJobRepository extends IScanJobRepository {
  constructor(redisClient) {
    super();
    this.redisClient = redisClient;
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

module.exports = RedisScanJobRepository;
