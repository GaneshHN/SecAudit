const fs = require('fs');
const IScanJobRepository = require('../../interfaces/IScanJobRepository');
const ScanJobMapper = require('../../mappers/ScanJobMapper');
const { OptimisticLockException, EntityNotFoundException, PersistenceException } = require('../../exceptions/RepositoryExceptions');
const { RepositoryHealthState } = require('../../interfaces/IRepositoryHealth');

class JsonScanJobRepository extends IScanJobRepository {
  constructor(filePath) {
    super();
    this.filePath = filePath;
    this._ensureFileExists();
  }

  _ensureFileExists() {
    if (!fs.existsSync(this.filePath)) {
      try {
        fs.writeFileSync(this.filePath, JSON.stringify({}));
      } catch (err) {
        console.error(`[JsonScanJobRepository] Failed to initialize file: ${err.message}`);
      }
    }
  }

  _readAll() {
    try {
      if (!fs.existsSync(this.filePath)) return {};
      const raw = fs.readFileSync(this.filePath, 'utf8');
      return JSON.parse(raw || '{}');
    } catch (err) {
      throw new PersistenceException('Failed to read from JSON file storage', err);
    }
  }

  _writeAll(data) {
    try {
      const tempPath = `${this.filePath}.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
      fs.renameSync(tempPath, this.filePath);
    } catch (err) {
      throw new PersistenceException('Failed to write to JSON file storage', err);
    }
  }

  async getById(id) {
    const store = this._readAll();
    const data = store[id];
    if (!data || data.deletedAt) return null; // Apply soft delete filter
    return ScanJobMapper.toDomain(data);
  }

  async save(job) {
    if (!job || !job.id) throw new PersistenceException('Job or Job ID is missing');
    
    const store = this._readAll();
    const existing = store[job.id];
    
    if (existing) {
      if (existing.version !== job.version) {
        throw new OptimisticLockException('ScanJob', job.id, existing.version, job.version);
      }
      job.version += 1;
    } else {
      job.version = 1;
    }

    store[job.id] = ScanJobMapper.toPersistence(job);
    this._writeAll(store);
  }

  async delete(id) {
    const store = this._readAll();
    if (store[id] && !store[id].deletedAt) {
      store[id].deletedAt = new Date().toISOString();
      this._writeAll(store);
      return;
    }
    throw new EntityNotFoundException('ScanJob', id);
  }

  async query(filter = {}) {
    const store = this._readAll();
    
    let rawJobs = Object.values(store);
    
    // Filter out soft-deleted items unless explicitly requested
    if (!filter.includeDeleted) {
      rawJobs = rawJobs.filter(d => !d.deletedAt);
    }

    let jobs = rawJobs.map((d) => ScanJobMapper.toDomain(d));

    if (filter.status) {
      jobs = jobs.filter((j) => j.status === filter.status);
    }
    if (filter.userId) {
      jobs = jobs.filter((j) => j.userId === filter.userId);
    }

    jobs.sort((a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime());

    if (filter.offset) {
      jobs = jobs.slice(filter.offset);
    }
    if (filter.limit) {
      jobs = jobs.slice(0, filter.limit);
    }

    return jobs;
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

module.exports = JsonScanJobRepository;
