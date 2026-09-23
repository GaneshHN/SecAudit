const { EventCategory } = require('./EventCategory');

/**
 * BaseEvent
 * Standardizes domain events across the system.
 */
class BaseEvent {
  constructor({
    eventType,
    category = EventCategory.SYSTEM,
    payload = {},
    jobId = null,
    workerId = null,
    correlationId = null,
    executionId = null,
    parentEventId = null,
    userId = null,
    sourceComponent = 'Unknown',
    version = '1.0',
    metadata = {}
  }) {
    if (!eventType) throw new Error('eventType is required');
    
    this.eventId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    this.eventType = eventType;
    this.category = category;
    this.timestamp = new Date().toISOString();
    
    // Traceability
    this.correlationId = correlationId;
    this.jobId = jobId;
    this.workerId = workerId;
    this.executionId = executionId;
    this.parentEventId = parentEventId;
    this.userId = userId;
    
    // Origin
    this.sourceComponent = sourceComponent;
    this.version = version;
    
    // Data
    this.payload = payload;
    this.metadata = metadata;
  }

  toJSON() {
    return {
      eventId: this.eventId,
      eventType: this.eventType,
      category: this.category,
      timestamp: this.timestamp,
      correlationId: this.correlationId,
      jobId: this.jobId,
      workerId: this.workerId,
      executionId: this.executionId,
      parentEventId: this.parentEventId,
      userId: this.userId,
      sourceComponent: this.sourceComponent,
      version: this.version,
      payload: this.payload,
      metadata: this.metadata,
    };
  }

  static fromJSON(data) {
    if (!data) return null;
    const event = new BaseEvent({
      eventType: data.eventType,
      category: data.category,
      payload: data.payload,
      jobId: data.jobId,
      workerId: data.workerId,
      correlationId: data.correlationId,
      executionId: data.executionId,
      parentEventId: data.parentEventId,
      userId: data.userId,
      sourceComponent: data.sourceComponent,
      version: data.version,
      metadata: data.metadata
    });
    event.eventId = data.eventId;
    event.timestamp = data.timestamp;
    return event;
  }
}

module.exports = BaseEvent;
