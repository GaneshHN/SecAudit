const RepositoryFactory = require('./factory/RepositoryFactory');

// We create a singleton UnitOfWork utilizing the repository factory
// This config object can later be populated from environment variables
const config = {
  type: process.env.PERSISTENCE_PROVIDER || 'json',
  logging: process.env.DB_LOGGING === 'true'
};

const unitOfWork = RepositoryFactory.createUnitOfWork(config);

module.exports = unitOfWork;
