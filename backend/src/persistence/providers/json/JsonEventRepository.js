const fs = require('fs');
const IEventRepository = require('../../interfaces/IEventRepository');
const EventMapper = require('../../mappers/EventMapper');
const { PersistenceException } = require('../../exceptions/RepositoryExceptions');
const { RepositoryHealthState } = require('../../interfaces/IRepositoryHealth');

class JsonEventRepository extends IEventRepository {
  constructor(filePath) {
    super();
    this.filePath = filePath;
    this._ensureFileExists();
  }

  _ensureFileExists() {
    if (!fs.existsSync(this.filePath)) {
      try {
        fs.writeFileSync(this.filePath, JSON.stringify([]));
      } catch (err) {
        console.error(`[JsonEventRepository] Failed to initialize file: ${err.message}`);
      }
    }
  }

  _readAll() {
    try {
      if (!fs.existsSync(this.filePath)) return [];
      const raw = fs.readFileSync(this.filePath, 'utf8');
      return JSON.parse(raw || '[]');
    } catch (err) {
      throw new PersistenceException('Failed to read events JSON file', err);
    }
  }

  _writeAll(data) {
    try {
      const tempPath = `${this.filePath}.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
      fs.renameSync(tempPath, this.filePath);
    } catch (err) {
      throw new PersistenceException('Failed to write events JSON file', err);
    }
  }

  async saveEvent(event) {
    if (!event) return;
    const store = this._readAll();
    store.push(EventMapper.toPersistence(event));
    this._writeAll(store);
  }

  async getEventsForJob(jobId) {
    const store = this._readAll();
    return store
      .filter(e => e.jobId === jobId && !e.deletedAt)
      .map(e => EventMapper.toDomain(e));
  }

  async deleteEventsForJob(jobId) {
    const store = this._readAll();
    let updated = false;
    store.forEach(e => {
      if (e.jobId === jobId && !e.deletedAt) {
        e.deletedAt = new Date().toISOString();
        updated = true;
      }
    });
    if (updated) {
      this._writeAll(store);
    }
  }

  async checkHealth() {
    try {
      fs.accessSync(this.filePath, fs.constants.R_OK | fs.constants.W_OK);
      return RepositoryHealthState.HEALTHY;
    } catch {
      return RepositoryHealthState.UNAVAILABLE;
    }
  }
}

module.exports = JsonEventRepository;
