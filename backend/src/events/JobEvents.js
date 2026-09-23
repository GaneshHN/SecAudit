const EventEmitter = require('events');
const { defaultEventBus } = require('./LocalEventBus');
const BaseEvent = require('./BaseEvent');
const { EventCategory } = require('./EventCategory');

/**
 * Event Names Constants
 */
const JOB_EVENTS = {
  JOB_CREATED: 'JobCreated',
  JOB_STARTED: 'JobStarted',
  JOB_PROGRESS: 'JobProgress', // Deprecated
  JOB_COMPLETED: 'JobCompleted',
  JOB_FAILED: 'JobFailed',
  JOB_CANCELLED: 'JobCancelled',
  JOB_RETRYING: 'JobRetrying', // Deprecated, use RetryScheduled instead
  STAGE_CHANGED: 'StageChanged',
  PROGRESS_UPDATED: 'ProgressUpdated',
  ESTIMATED_TIME_UPDATED: 'EstimatedTimeUpdated',
  RETRY_SCHEDULED: 'RetryScheduled',
  RETRY_STARTED: 'RetryStarted',
  RETRY_SUCCEEDED: 'RetrySucceeded',
  RETRY_FAILED: 'RetryFailed',
  RETRIES_EXHAUSTED: 'RetriesExhausted',
  JOB_SCHEDULED: 'JobScheduled',
  PRIORITY_CHANGED: 'PriorityChanged',
  JOB_DEQUEUED: 'JobDequeued',
  QUEUE_STARVATION_DETECTED: 'QueueStarvationDetected',
  SCHEDULING_DECISION_MADE: 'SchedulingDecisionMade',
};

/**
 * Legacy JobEventEmitter adapter.
 * Instead of extending EventEmitter, it now proxies calls to the central IEventBus.
 * It still exposes `on` and `once` to maintain backward compatibility for existing tests.
 */
class JobEventEmitter extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(200);
    
    // Wire up defaultEventBus so that anything subscribing directly to this legacy emitter 
    // still receives events.
    defaultEventBus.subscribe('*', (event) => {
      this.emit(event.eventType, event.payload);
    });
  }

  _publish(eventType, category, jobId, payload, correlationId = null) {
    const event = new BaseEvent({
      eventType,
      category,
      jobId,
      payload,
      correlationId: correlationId || payload?.job?.metadata?.correlationId || payload?.metadata?.correlationId,
      sourceComponent: 'JobEventsAdapter'
    });
    
    // We intentionally don't await here because event emitters shouldn't block
    defaultEventBus.publish(event).catch(err => {
      console.error(`[JobEventEmitter] Failed to publish ${eventType}`, err);
    });
  }

  emitCreated(job) {
    this._publish(JOB_EVENTS.JOB_CREATED, EventCategory.JOB, job.id || job.jobId, job);
  }

  emitStarted(job) {
    this._publish(JOB_EVENTS.JOB_STARTED, EventCategory.JOB, job.id || job.jobId, job);
  }

  emitProgress(job, percentage, stage) {
    this._publish(JOB_EVENTS.JOB_PROGRESS, EventCategory.JOB, job.id || job.jobId, {
      jobId: job.id || job.jobId,
      progressPercentage: percentage,
      currentStage: stage,
    });
  }

  emitProgressUpdated(job, snapshot) {
    this._publish(JOB_EVENTS.PROGRESS_UPDATED, EventCategory.JOB, job.id || job.jobId, { jobId: job.id || job.jobId, snapshot });
  }

  emitStageChanged(job, previousStage, newStage) {
    this._publish(JOB_EVENTS.STAGE_CHANGED, EventCategory.JOB, job.id || job.jobId, { jobId: job.id || job.jobId, previousStage, newStage });
  }

  emitEstimatedTimeUpdated(job, estimatedRemainingTime) {
    this._publish(JOB_EVENTS.ESTIMATED_TIME_UPDATED, EventCategory.JOB, job.id || job.jobId, { jobId: job.id || job.jobId, estimatedRemainingTime });
  }

  emitCompleted(job, result) {
    this._publish(JOB_EVENTS.JOB_COMPLETED, EventCategory.JOB, job.id || job.jobId, { job, result });
  }

  emitFailed(job, error) {
    this._publish(JOB_EVENTS.JOB_FAILED, EventCategory.JOB, job.id || job.jobId, { job, error: error?.message || String(error) });
  }

  emitCancelled(job) {
    this._publish(JOB_EVENTS.JOB_CANCELLED, EventCategory.JOB, job.id || job.jobId, job);
  }

  emitRetrying(job, attempt, error) {
    this._publish(JOB_EVENTS.JOB_RETRYING, EventCategory.QUEUE, job.id || job.jobId, { job, attempt, error: error?.message || String(error) });
  }

  emitRetryScheduled(job, retryContext) {
    this._publish(JOB_EVENTS.RETRY_SCHEDULED, EventCategory.QUEUE, job.id || job.jobId, { job, retryContext });
  }

  emitRetryStarted(job, retryContext) {
    this._publish(JOB_EVENTS.RETRY_STARTED, EventCategory.QUEUE, job.id || job.jobId, { job, retryContext });
  }

  emitRetrySucceeded(job, retryContext) {
    this._publish(JOB_EVENTS.RETRY_SUCCEEDED, EventCategory.QUEUE, job.id || job.jobId, { job, retryContext });
  }

  emitRetryFailed(job, retryContext, error) {
    this._publish(JOB_EVENTS.RETRY_FAILED, EventCategory.QUEUE, job.id || job.jobId, { job, retryContext, error: error?.message || String(error) });
  }

  emitRetriesExhausted(job, retryContext, error) {
    this._publish(JOB_EVENTS.RETRIES_EXHAUSTED, EventCategory.QUEUE, job.id || job.jobId, { job, retryContext, error: error?.message || String(error) });
  }

  emitJobScheduled(job) {
    this._publish(JOB_EVENTS.JOB_SCHEDULED, EventCategory.SCHEDULER, job.id || job.jobId, { job });
  }

  emitPriorityChanged(job, oldWeight, newWeight) {
    this._publish(JOB_EVENTS.PRIORITY_CHANGED, EventCategory.SCHEDULER, job.id || job.jobId, { job, oldWeight, newWeight });
  }

  emitJobDequeued(job, queueTimeMs) {
    this._publish(JOB_EVENTS.JOB_DEQUEUED, EventCategory.SCHEDULER, job.id || job.jobId, { job, queueTimeMs });
  }

  emitQueueStarvationDetected(job, waitTimeMs) {
    this._publish(JOB_EVENTS.QUEUE_STARVATION_DETECTED, EventCategory.SCHEDULER, job.id || job.jobId, { job, waitTimeMs });
  }

  emitSchedulingDecisionMade(job, decisionType, reason) {
    this._publish(JOB_EVENTS.SCHEDULING_DECISION_MADE, EventCategory.SCHEDULER, job.id || job.jobId, { job, decisionType, reason });
  }
}

const jobEvents = new JobEventEmitter();

module.exports = { JOB_EVENTS, JobEventEmitter, jobEvents };
