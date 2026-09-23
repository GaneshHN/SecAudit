const { JOB_STATES, ScanJobStateMachine } = require('./ScanJobStateMachine');
const { JobStage, isValidStageForState } = require('./JobStage');
const ProgressSnapshot = require('./ProgressSnapshot');
const { jobEvents } = require('../events/JobEvents');
const RetryContext = require('./RetryContext');
const SchedulingContext = require('./SchedulingContext');
const { normalizePriority } = require('./JobPriority');

class ScanJob {
  constructor({
    id = null,
    jobId = null,
    repository = '',
    userId = 'anonymous',
    priority = 'Normal',
    scannerVersion = '2.0.0',
    maxRetries = 3,
    metadata = {},
    status = JOB_STATES.QUEUED,
    currentStage = JobStage.QUEUED,
    progressPercentage = 0,
    progressSnapshot = null,
    retryContext = null,
    schedulingContext = null,
    workerId = null,
    createdTime = null,
    startedTime = null,
    completedTime = null,
    queueTime = 0,
    executionTime = 0,
    duration = 0,
    resultRef = null,
    result = null,
    error = null,
    transitionHistory = [],
    retryBehavior = 'RESET_PROGRESS',
    isDeadLetter = false,
    version = 1,
  } = {}) {
    this.id = id || jobId || `job_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    this.version = version;
    this.jobId = this.id;
    this.repository = repository;
    this.userId = userId;

    // State Machine & Progress Metadata
    this.status = status || JOB_STATES.QUEUED;
    this.currentStage = currentStage || JobStage.QUEUED;
    this.progressPercentage = typeof progressPercentage === 'number' ? progressPercentage : 0;
    this.progressSnapshot = progressSnapshot ? new ProgressSnapshot(progressSnapshot) : new ProgressSnapshot({ stageId: this.currentStage.id, stageName: this.currentStage.displayName });
    
    // Scheduling & Priority
    this.schedulingContext = schedulingContext ? SchedulingContext.fromJSON(schedulingContext) : new SchedulingContext({ jobId: this.id, basePriority: priority });
    
    // Legacy fields maintained for backward compatibility tests
    this.priorityName = this.schedulingContext.basePriorityName;
    this.priority = this.schedulingContext.basePriorityWeight;

    // Retry & DLQ
    this.retryContext = retryContext ? RetryContext.fromJSON(retryContext) : new RetryContext({ jobId: this.id, maxAttempts: maxRetries });
    this.maxRetries = typeof maxRetries === 'number' ? maxRetries : 3;
    this.retryBehavior = retryBehavior;
    this.isDeadLetter = isDeadLetter;

    this.workerId = workerId || null;
    this.scannerVersion = scannerVersion || '2.0.0';
    this.metadata = metadata || {};
    this.transitionHistory = Array.isArray(transitionHistory) ? transitionHistory : [];

    // Timing metrics
    this.createdTime = createdTime || new Date().toISOString();
    this.startedTime = startedTime || null;
    this.completedTime = completedTime || null;
    this.queueTime = queueTime || 0;
    this.executionTime = executionTime || 0;
    this.duration = duration || 0;

    // Result & Errors
    this.resultRef = resultRef || null;
    this.result = result || null;
    this.error = error || null;
  }

  // Deprecated: maintain for backward compatibility in some tests if needed
  get retryCount() {
    return this.retryContext ? this.retryContext.currentAttempt : 0;
  }

  set retryCount(val) {
    if (this.retryContext) this.retryContext.currentAttempt = val;
  }

  /**
   * Transition job status using formal state machine.
   * @param {string} nextState 
   * @param {string} reason 
   */
  transitionTo(nextState, reason = 'State transition requested') {
    const oldStatus = this.status;
    const oldStage = this.currentStage;
    
    this.status = ScanJobStateMachine.transition(this.status, nextState);

    // Compute transition duration if not queued
    let transitionDuration = 0;
    if (this.transitionHistory.length > 0) {
      const lastTransition = this.transitionHistory[this.transitionHistory.length - 1];
      transitionDuration = new Date().getTime() - new Date(lastTransition.timestamp).getTime();
    }

    // Handle Retry Behavior
    if (this.status === JOB_STATES.RETRYING && this.retryBehavior === 'RESET_PROGRESS') {
      this.progressPercentage = 0;
      this.currentStage = JobStage.QUEUED;
      this.progressSnapshot = new ProgressSnapshot({ stageId: this.currentStage.id, stageName: this.currentStage.displayName });
    }

    // Record immutable history
    this.transitionHistory.push({
      previousState: oldStatus,
      newState: this.status,
      timestamp: new Date().toISOString(),
      workerId: this.workerId,
      correlationId: this.metadata.correlationId || null,
      reason,
      error: this.error ? String(this.error) : null,
      stage: this.currentStage.id,
      progress: this.progressPercentage,
      retryAttempt: this.retryCount,
      transitionDuration,
    });

    if (this.status === JOB_STATES.RUNNING && !this.startedTime) {
      this.startedTime = new Date().toISOString();
      if (this.createdTime) {
        this.queueTime = new Date(this.startedTime).getTime() - new Date(this.createdTime).getTime();
      }
      jobEvents.emitStarted(this);
    }

    if ([JOB_STATES.COMPLETED, JOB_STATES.FAILED, JOB_STATES.CANCELLED, JOB_STATES.TIMEOUT].includes(this.status)) {
      this.completedTime = new Date().toISOString();
      if (this.startedTime) {
        this.executionTime = new Date(this.completedTime).getTime() - new Date(this.startedTime).getTime();
        this.duration = parseFloat((this.executionTime / 1000).toFixed(2));
      }
    }

    if (this.status === JOB_STATES.COMPLETED) {
      if (this.progressPercentage !== 100) {
        // Enforce 100% on complete without throwing error for strategy
        this.progressPercentage = 100;
        this.currentStage = JobStage.COMPLETE;
        this.progressSnapshot = new ProgressSnapshot({ stageId: JobStage.COMPLETE.id, stageName: JobStage.COMPLETE.displayName, progressPercentage: 100 });
      }
      jobEvents.emitCompleted(this, this.result);
    } else if (this.status === JOB_STATES.FAILED) {
      jobEvents.emitFailed(this, this.error);
    } else if (this.status === JOB_STATES.CANCELLED) {
      jobEvents.emitCancelled(this);
    } else if (this.status === JOB_STATES.RETRYING) {
      jobEvents.emitRetrying(this, this.retryCount, this.error);
    }

    return this;
  }

  /**
   * Update job progress via a snapshot strategy.
   * @param {ProgressSnapshot} snapshot
   * @param {Object} stageObj
   */
  updateProgress(snapshot, stageObj) {
    if (!snapshot || typeof snapshot.progressPercentage !== 'number') return this;
    
    if (stageObj && !isValidStageForState(stageObj, this.status)) {
       throw new Error(`Invalid Stage Validation: Stage '${stageObj.id}' is not allowed in JobState '${this.status}'`);
    }

    const boundedPercentage = Math.min(100, Math.max(0, snapshot.progressPercentage));

    // Rule: Progress must never decrease unless we are retrying and reset progress.
    // The state transition logic handles resetting progress. Here we enforce non-decreasing during normal run.
    if (boundedPercentage < this.progressPercentage && this.status !== JOB_STATES.QUEUED && this.status !== JOB_STATES.RETRYING) {
      throw new Error(`Progress Validation Failed: Progress cannot decrease (from ${this.progressPercentage} to ${boundedPercentage})`);
    }

    const previousStage = this.currentStage;
    this.progressPercentage = boundedPercentage;
    this.progressSnapshot = snapshot;
    
    if (stageObj) {
      this.currentStage = stageObj;
      if (previousStage.id !== stageObj.id) {
        jobEvents.emitStageChanged(this, previousStage, stageObj);
      }
    }

    jobEvents.emitProgressUpdated(this, this.progressSnapshot);
    if (snapshot.estimatedRemainingTime !== undefined) {
      jobEvents.emitEstimatedTimeUpdated(this, snapshot.estimatedRemainingTime);
    }

    return this;
  }

  toJSON() {
    return {
      id: this.id,
      jobId: this.jobId,
      repository: this.repository,
      userId: this.userId,
      status: this.status,
      currentStage: this.currentStage,
      progressPercentage: this.progressPercentage,
      progressSnapshot: this.progressSnapshot,
      priority: this.priorityName,
      priorityValue: this.priority,
      schedulingContext: this.schedulingContext ? this.schedulingContext.toJSON() : null,
      retryCount: this.retryCount,
      maxRetries: this.maxRetries,
      retryContext: this.retryContext ? this.retryContext.toJSON() : null,
      retryBehavior: this.retryBehavior,
      isDeadLetter: this.isDeadLetter,
      workerId: this.workerId,
      scannerVersion: this.scannerVersion,
      createdTime: this.createdTime,
      startedTime: this.startedTime,
      completedTime: this.completedTime,
      queueTimeMs: this.queueTime,
      executionTimeMs: this.executionTime,
      durationSeconds: this.duration,
      resultRef: this.resultRef,
      error: this.error,
      metadata: this.metadata,
      result: this.result,
      transitionHistory: this.transitionHistory,
      version: this.version,
    };
  }

  static fromJSON(data) {
    if (!data) return null;
    return new ScanJob({
      id: data.id || data.jobId,
      jobId: data.jobId || data.id,
      repository: data.repository,
      userId: data.userId,
      priority: data.priority,
      scannerVersion: data.scannerVersion,
      maxRetries: data.maxRetries,
      retryBehavior: data.retryBehavior,
      isDeadLetter: data.isDeadLetter,
      metadata: data.metadata,
      status: data.status,
      currentStage: data.currentStage,
      progressPercentage: data.progressPercentage,
      progressSnapshot: data.progressSnapshot,
      schedulingContext: data.schedulingContext,
      retryContext: data.retryContext,
      workerId: data.workerId,
      createdTime: data.createdTime,
      startedTime: data.startedTime,
      completedTime: data.completedTime,
      queueTime: data.queueTimeMs || data.queueTime,
      executionTime: data.executionTimeMs || data.executionTime,
      duration: data.durationSeconds || data.duration,
      resultRef: data.resultRef,
      result: data.result,
      error: data.error,
      transitionHistory: data.transitionHistory,
      version: data.version || 1,
    });
  }
}

module.exports = { ScanJob };
