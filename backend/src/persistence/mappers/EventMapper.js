const BaseEvent = require('../../events/BaseEvent');

class EventMapper {
  static toDomain(persistenceData) {
    if (!persistenceData) return null;
    return BaseEvent.fromJSON(persistenceData);
  }

  static toPersistence(domainModel) {
    if (!domainModel) return null;
    return domainModel.toJSON();
  }
}

module.exports = EventMapper;
