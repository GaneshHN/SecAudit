const mongoose = require('mongoose');
const IScanJobRepository = require('../../interfaces/IScanJobRepository');
const { RepositoryHealthState } = require('../../interfaces/IRepositoryHealth');
const { ScanJob } = require('../../../jobs/ScanJob');

const scanJobSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  jobId: { type: String },
  repository: { type: String },
  userId: { type: String },
  status: { type: String },
  currentStage: { type: mongoose.Schema.Types.Mixed },
  progressPercentage: { type: Number },
  progressSnapshot: { type: mongoose.Schema.Types.Mixed },
  priority: { type: String },
  priorityValue: { type: Number },
  schedulingContext: { type: mongoose.Schema.Types.Mixed },
  retryCount: { type: Number },
  maxRetries: { type: Number },
  retryContext: { type: mongoose.Schema.Types.Mixed },
  retryBehavior: { type: String },
  isDeadLetter: { type: Boolean },
  workerId: { type: String },
  scannerVersion: { type: String },
  createdTime: { type: String },
  startedTime: { type: String },
  completedTime: { type: String },
  queueTimeMs: { type: Number },
  executionTimeMs: { type: Number },
  durationSeconds: { type: Number },
  resultRef: { type: String },
  error: { type: mongoose.Schema.Types.Mixed },
  metadata: { type: mongoose.Schema.Types.Mixed },
  result: { type: mongoose.Schema.Types.Mixed },
  transitionHistory: { type: Array },
  version: { type: Number }
}, { strict: false, collection: 'scanjobs' });

let ScanJobModel;
try {
  ScanJobModel = mongoose.model('ScanJob');
} catch (e) {
  ScanJobModel = mongoose.model('ScanJob', scanJobSchema);
}

class MongoScanJobRepository extends IScanJobRepository {
  constructor(connection) {
    super();
    this.connection = connection;
    this.model = ScanJobModel;
  }

  async getById(id) {
    const doc = await this.model.findOne({ id }).lean();
    if (!doc) return null;
    return ScanJob.fromJSON(doc);
  }

  async save(job) {
    const data = job.toJSON();
    await this.model.findOneAndUpdate(
      { id: data.id },
      { $set: data },
      { upsert: true, new: true, runValidators: true }
    );
  }

  async delete(id) {
    const result = await this.model.deleteOne({ id });
    return result.deletedCount > 0;
  }

  async query(filter = {}) {
    const docs = await this.model.find(filter).lean();
    return docs.map(doc => ScanJob.fromJSON(doc));
  }

  async checkHealth() {
    try {
      if (mongoose.connection.readyState === 1) {
        return RepositoryHealthState.HEALTHY;
      }
      return RepositoryHealthState.DEGRADED;
    } catch (err) {
      return RepositoryHealthState.UNAVAILABLE;
    }
  }
}

module.exports = MongoScanJobRepository;
