const { defaultEventBus } = require('../events/LocalEventBus');
const { logger } = require('./logger');

/**
 * EventLogger
 * Passively listens to the Event Bus and writes structured logs.
 * Replaces ad-hoc console.logs throughout the system for important lifecycle events.
 */
class EventLogger {
  constructor() {
    this._handleEvent = this._handleEvent.bind(this);
  }

  start() {
    defaultEventBus.subscribe('*', this._handleEvent);
    logger.info('EventLogger started. Structured logging active.');
  }

  stop() {
    defaultEventBus.unsubscribe('*', this._handleEvent);
  }

  _handleEvent(event) {
    if (!event || !event.eventType) return;
    
    const type = event.eventType;
    const level = this._determineLogLevel(type);
    
    logger[level](`Event: ${type}`, {
      eventId: event.eventId,
      jobId: event.jobId || event.payload?.jobId,
      workerId: event.workerId || event.payload?.workerId,
      category: event.category,
      source: event.sourceComponent,
      payload: event.payload
    });
  }

  _determineLogLevel(eventType) {
    if (eventType.includes('Failed') || eventType.includes('Error') || eventType === 'RetriesExhausted') {
      return 'error';
    }
    if (eventType.includes('Retry') || eventType === 'QueueStarvationDetected' || eventType === 'OptimisticLockFailed') {
      return 'warn';
    }
    if (eventType === 'WorkerHeartbeat' || eventType === 'RepositoryOperationCompleted') {
      return 'debug'; // Too noisy for info
    }
    return 'info';
  }
}

const eventLogger = new EventLogger();
module.exports = { EventLogger, eventLogger };
