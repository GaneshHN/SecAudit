const IUnitOfWork = require('../../interfaces/IUnitOfWork');

class JsonUnitOfWork extends IUnitOfWork {
  constructor(scanJobRepo, scanResultRepo, eventRepo) {
    super();
    this._scanJobRepo = scanJobRepo;
    this._scanResultRepo = scanResultRepo;
    this._eventRepo = eventRepo;
    this._committed = false;
  }

  get scanJobs() {
    return this._scanJobRepo;
  }

  get scanResults() {
    return this._scanResultRepo;
  }

  get events() {
    return this._eventRepo;
  }

  async commit() {
    // In JSON file storage, operations write synchronously to the file directly right now.
    // In a real database Unit of Work, here is where we would call session.commitTransaction().
    this._committed = true;
  }

  async rollback() {
    // In JSON file storage without memory snapshots, rollback is a no-op if files are written synchronously.
    // In a real Unit of Work, session.abortTransaction().
    if (!this._committed) {
      console.warn('[JsonUnitOfWork] Rollback requested, but JSON implementation lacks in-memory transactional snapshot isolation.');
    }
  }
}

module.exports = JsonUnitOfWork;
