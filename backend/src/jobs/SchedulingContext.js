const { normalizePriority } = require('./JobPriority');

/**
 * Encapsulates scheduling metadata for a job.
 */
class SchedulingContext {
  constructor({
    jobId,
    basePriority = 'Normal',
    effectivePriorityWeight = null,
    queueTimeMs = 0,
    retryCount = 0,
    failureCount = 0,
    estimatedRuntimeMs = 0,
    history = []
  } = {}) {
    this.jobId = jobId;
    
    const priorityObj = normalizePriority(basePriority);
    this.basePriorityName = priorityObj.name;
    this.basePriorityWeight = priorityObj.weight;
    
    // Effective priority can grow to prevent starvation
    this.effectivePriorityWeight = effectivePriorityWeight !== null ? effectivePriorityWeight : this.basePriorityWeight;
    
    this.queueTimeMs = queueTimeMs; // Cumulative time spent in queue
    this.retryCount = retryCount;
    this.failureCount = failureCount;
    this.estimatedRuntimeMs = estimatedRuntimeMs;
    this.history = Array.isArray(history) ? history : [];
    this.lastEnqueuedTime = null;
  }

  recordEnqueue() {
    this.lastEnqueuedTime = Date.now();
  }

  recordDequeue() {
    if (this.lastEnqueuedTime) {
      const waitTime = Date.now() - this.lastEnqueuedTime;
      this.queueTimeMs += waitTime;
      this.lastEnqueuedTime = null;
    }
  }

  recordSchedulingDecision(decisionType, oldWeight, newWeight, reason) {
    this.history.push({
      timestamp: new Date().toISOString(),
      decisionType,
      oldWeight,
      newWeight,
      reason
    });
  }

  toJSON() {
    return {
      jobId: this.jobId,
      basePriorityName: this.basePriorityName,
      basePriorityWeight: this.basePriorityWeight,
      effectivePriorityWeight: this.effectivePriorityWeight,
      queueTimeMs: this.queueTimeMs,
      retryCount: this.retryCount,
      failureCount: this.failureCount,
      estimatedRuntimeMs: this.estimatedRuntimeMs,
      history: this.history,
    };
  }

  static fromJSON(data) {
    if (!data) return null;
    return new SchedulingContext({
      jobId: data.jobId,
      basePriority: data.basePriorityName,
      effectivePriorityWeight: data.effectivePriorityWeight,
      queueTimeMs: data.queueTimeMs,
      retryCount: data.retryCount,
      failureCount: data.failureCount,
      estimatedRuntimeMs: data.estimatedRuntimeMs,
      history: data.history,
    });
  }
}

module.exports = SchedulingContext;
