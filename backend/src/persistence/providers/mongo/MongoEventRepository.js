const mongoose = require('mongoose');
const IEventRepository = require('../../interfaces/IEventRepository');
const { RepositoryHealthState } = require('../../interfaces/IRepositoryHealth');

const eventSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  jobId: { type: String, required: true },
  type: { type: String, required: true },
  timestamp: { type: String },
  payload: { type: mongoose.Schema.Types.Mixed },
  workerId: { type: String },
  correlationId: { type: String }
}, { strict: false, collection: 'events' });

let EventModel;
try {
  EventModel = mongoose.model('Event');
} catch (e) {
  EventModel = mongoose.model('Event', eventSchema);
}

class MongoEventRepository extends IEventRepository {
  constructor(connection) {
    super();
    this.connection = connection;
    this.model = EventModel;
  }

  async save(event) {
    await this.model.create(event);
  }

  async getByJobId(jobId) {
    return await this.model.find({ jobId }).sort({ timestamp: 1 }).lean();
  }

  async query(filter = {}) {
    return await this.model.find(filter).sort({ timestamp: 1 }).lean();
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

module.exports = MongoEventRepository;
