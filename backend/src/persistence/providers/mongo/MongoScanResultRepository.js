const mongoose = require('mongoose');
const IScanResultRepository = require('../../interfaces/IScanResultRepository');
const { RepositoryHealthState } = require('../../interfaces/IRepositoryHealth');

const scanResultSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  jobId: { type: String, required: true },
  repository: { type: String },
  findings: { type: Array },
  metrics: { type: mongoose.Schema.Types.Mixed },
  summary: { type: mongoose.Schema.Types.Mixed },
  timestamp: { type: String }
}, { strict: false, collection: 'scanresults' });

let ScanResultModel;
try {
  ScanResultModel = mongoose.model('ScanResult');
} catch (e) {
  ScanResultModel = mongoose.model('ScanResult', scanResultSchema);
}

class MongoScanResultRepository extends IScanResultRepository {
  constructor(connection) {
    super();
    this.connection = connection;
    this.model = ScanResultModel;
  }

  async getById(id) {
    const doc = await this.model.findOne({ id }).lean();
    return doc || null;
  }

  async save(result) {
    await this.model.findOneAndUpdate(
      { id: result.id },
      { $set: result },
      { upsert: true, new: true, runValidators: true }
    );
  }

  async delete(id) {
    const res = await this.model.deleteOne({ id });
    return res.deletedCount > 0;
  }

  async query(filter = {}) {
    return await this.model.find(filter).lean();
  }

  async getByJobId(jobId) {
    const doc = await this.model.findOne({ jobId }).lean();
    return doc || null;
  }

  async checkHealth() {
    try {
      if (mongoose.connection.readyState === 1) return RepositoryHealthState.HEALTHY;
      return RepositoryHealthState.DEGRADED;
    } catch (err) {
      return RepositoryHealthState.UNAVAILABLE;
    }
  }
}

module.exports = MongoScanResultRepository;
