/**
 * Event Categories
 * Extensible categories for domain events.
 */
const EventCategory = {
  JOB: 'JobEvents',
  QUEUE: 'QueueEvents',
  WORKER: 'WorkerEvents',
  SCHEDULER: 'SchedulerEvents',
  SCANNER: 'ScannerEvents',
  PERSISTENCE: 'PersistenceEvents',
  SYSTEM: 'SystemEvents',
};

module.exports = { EventCategory };
