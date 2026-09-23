class RepositoryException extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

class PersistenceException extends RepositoryException {
  constructor(message, cause = null) {
    super(message);
    this.cause = cause;
  }
}

class EntityNotFoundException extends RepositoryException {
  constructor(entityName, entityId) {
    super(`Entity '${entityName}' with ID '${entityId}' was not found.`);
    this.entityName = entityName;
    this.entityId = entityId;
  }
}

class OptimisticLockException extends RepositoryException {
  constructor(entityName, entityId, expectedVersion, actualVersion) {
    super(`Optimistic lock failure for '${entityName}' with ID '${entityId}'. Expected version ${expectedVersion}, got ${actualVersion}.`);
    this.entityName = entityName;
    this.entityId = entityId;
    this.expectedVersion = expectedVersion;
    this.actualVersion = actualVersion;
  }
}

class DuplicateEntityException extends RepositoryException {
  constructor(entityName, entityId) {
    super(`Entity '${entityName}' with ID '${entityId}' already exists.`);
    this.entityName = entityName;
    this.entityId = entityId;
  }
}

module.exports = {
  RepositoryException,
  PersistenceException,
  EntityNotFoundException,
  OptimisticLockException,
  DuplicateEntityException
};
