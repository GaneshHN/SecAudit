const { ScanJob } = require('../../jobs/ScanJob');

class ScanJobMapper {
  static toDomain(persistenceData) {
    if (!persistenceData) return null;
    return ScanJob.fromJSON(persistenceData);
  }

  static toPersistence(domainModel) {
    if (!domainModel) return null;
    return domainModel.toJSON();
  }
}

module.exports = ScanJobMapper;
