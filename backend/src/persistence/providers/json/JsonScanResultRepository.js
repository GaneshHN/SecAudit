const fs = require('fs');
const IScanResultRepository = require('../../interfaces/IScanResultRepository');
const ScanResultMapper = require('../../mappers/ScanResultMapper');
const { EntityNotFoundException, PersistenceException } = require('../../exceptions/RepositoryExceptions');
const { RepositoryHealthState } = require('../../interfaces/IRepositoryHealth');

class JsonScanResultRepository extends IScanResultRepository {
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
        console.error(`[JsonScanResultRepository] Failed to initialize file: ${err.message}`);
      }
    }
  }

  _readAll() {
    try {
      if (!fs.existsSync(this.filePath)) return {};
      const raw = fs.readFileSync(this.filePath, 'utf8');
      return JSON.parse(raw || '{}');
    } catch (err) {
      throw new PersistenceException('Failed to read results JSON file', err);
    }
  }

  _writeAll(data) {
    try {
      const tempPath = `${this.filePath}.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
      fs.renameSync(tempPath, this.filePath);
    } catch (err) {
      throw new PersistenceException('Failed to write results JSON file', err);
    }
  }

  async save(jobId, result) {
    if (!jobId || !result) throw new PersistenceException('Job ID or Result is missing');
    const store = this._readAll();
    
    // Result persistence structure mapping
    store[jobId] = ScanResultMapper.toPersistence(result);
    this._writeAll(store);
  }

  async getByJobId(jobId) {
    const store = this._readAll();
    const data = store[jobId];
    if (!data || data.deletedAt) {
      throw new EntityNotFoundException('ScanResult', jobId);
    }
    return ScanResultMapper.toDomain(data);
  }

  async delete(jobId) {
    const store = this._readAll();
    if (store[jobId] && !store[jobId].deletedAt) {
      store[jobId].deletedAt = new Date().toISOString();
      this._writeAll(store);
      return;
    }
    throw new EntityNotFoundException('ScanResult', jobId);
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

module.exports = JsonScanResultRepository;
