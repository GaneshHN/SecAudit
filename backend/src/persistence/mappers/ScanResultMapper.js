class ScanResultMapper {
  static toDomain(persistenceData) {
    if (!persistenceData) return null;
    // Assuming result is just an object for now
    return { ...persistenceData };
  }

  static toPersistence(domainModel) {
    if (!domainModel) return null;
    // Assuming result is just an object for now
    return { ...domainModel };
  }
}

module.exports = ScanResultMapper;
