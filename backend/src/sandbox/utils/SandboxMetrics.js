const { defaultEventBus } = require('../../events/LocalEventBus');
const { SANDBOX_EVENTS } = require('../events/SandboxEvents');

/**
 * SandboxMetrics
 * Passively aggregates sandbox operational metrics.
 */
class SandboxMetrics {
  constructor() {
    this._handleEvent = this._handleEvent.bind(this);
    this.reset();
  }

  reset() {
    this.metrics = {
      starts: 0,
      completions: 0,
      failures: 0,
      timeouts: 0,
      cancellations: 0,
      memoryLimitFailures: 0,
      diskLimitFailures: 0,
      ipcViolations: 0,
      networkIsolationFailures: 0,
      securityIsolationFailures: 0,
      terminationEvents: 0,
      orphanWorkspacesReaped: 0,
      
      executionTimeMsTotal: 0,
      executionCount: 0,
      
      queueToStartTimeMsTotal: 0,
      queueToStartCount: 0
    };
    
    this.activeJobTimestamps = new Map(); // jobId -> { enqueuedAt, startedAt }
  }

  start() {
    defaultEventBus.subscribe('*', this._handleEvent);
  }

  stop() {
    defaultEventBus.unsubscribe('*', this._handleEvent);
  }

  getMetrics() {
    const avgExecutionTimeMs = this.metrics.executionCount > 0 
      ? Math.round(this.metrics.executionTimeMsTotal / this.metrics.executionCount) 
      : 0;
      
    const avgQueueToStartTimeMs = this.metrics.queueToStartCount > 0
      ? Math.round(this.metrics.queueToStartTimeMsTotal / this.metrics.queueToStartCount)
      : 0;

    return {
      starts: this.metrics.starts,
      completions: this.metrics.completions,
      failures: this.metrics.failures,
      timeouts: this.metrics.timeouts,
      cancellations: this.metrics.cancellations,
      memoryLimitFailures: this.metrics.memoryLimitFailures,
      diskLimitFailures: this.metrics.diskLimitFailures,
      ipcViolations: this.metrics.ipcViolations,
      networkIsolationFailures: this.metrics.networkIsolationFailures,
      securityIsolationFailures: this.metrics.securityIsolationFailures,
      terminationEvents: this.metrics.terminationEvents,
      orphanWorkspacesReaped: this.metrics.orphanWorkspacesReaped,
      
      averageExecutionTimeMs: avgExecutionTimeMs,
      averageQueueToStartTimeMs: avgQueueToStartTimeMs,
      activeSandboxes: this.activeJobTimestamps.size
    };
  }

  _handleEvent(event) {
    if (!event || !event.eventType) return;

    try {
      const type = event.eventType;
      const jobId = event.jobId || event.payload?.jobId;

      // Track timings
      if (type === 'JobCreated' && jobId) {
        this.activeJobTimestamps.set(jobId, { enqueuedAt: Date.now() });
      }

      if (type === SANDBOX_EVENTS.STARTED) {
        this.metrics.starts++;
        if (jobId) {
          const timestamps = this.activeJobTimestamps.get(jobId) || {};
          timestamps.startedAt = Date.now();
          if (timestamps.enqueuedAt) {
            const queueTime = timestamps.startedAt - timestamps.enqueuedAt;
            this.metrics.queueToStartTimeMsTotal += queueTime;
            this.metrics.queueToStartCount++;
          }
          this.activeJobTimestamps.set(jobId, timestamps);
        }
      }

      if (type === SANDBOX_EVENTS.COMPLETED) {
        this.metrics.completions++;
        this._recordExecutionDuration(jobId);
      }

      if (type === SANDBOX_EVENTS.FAILED) {
        this.metrics.failures++;
        this._recordExecutionDuration(jobId);
        
        const reason = event.payload?.reason;
        if (reason === 'TIMEOUT') this.metrics.timeouts++;
        else if (reason === 'CANCELLED') this.metrics.cancellations++;
        else if (reason === 'MEMORY_LIMIT') this.metrics.memoryLimitFailures++;
        else if (reason === 'DISK_LIMIT') this.metrics.diskLimitFailures++;
        else if (reason === 'IPCProtocolViolation') this.metrics.ipcViolations++;
        else if (reason === 'NetworkIsolationFailure') this.metrics.networkIsolationFailures++;
        else if (reason === 'SecurityProfileInvalid' || reason === 'PrivilegeEscalationBlocked' || reason === 'CapabilityConfigurationError' || reason === 'SeccompConfigurationError' || reason === 'AppArmorConfigurationError') {
          this.metrics.securityIsolationFailures++;
        }
      }

      // Explicit standalone events
      if (type === SANDBOX_EVENTS.TIMEOUT) this.metrics.timeouts++;
      if (type === SANDBOX_EVENTS.TERMINATED) this.metrics.terminationEvents++;
      if (type === 'IPCProtocolViolation') this.metrics.ipcViolations++;
      if (type === 'NetworkIsolationFailure') this.metrics.networkIsolationFailures++;
      if (type === 'SecurityIsolationFailure' || type === 'SecurityProfileInvalid') this.metrics.securityIsolationFailures++;
      if (type === 'OrphanWorkspaceReaped') this.metrics.orphanWorkspacesReaped++;
      
      // Secondary limits triggers
      if (type === SANDBOX_EVENTS.RESOURCE_EXCEEDED) {
        if (event.payload?.resource === 'memory') this.metrics.memoryLimitFailures++;
        if (event.payload?.resource === 'disk') this.metrics.diskLimitFailures++;
      }

    } catch (err) {
      // Ignore processing errors to avoid crashing
    }
  }

  _recordExecutionDuration(jobId) {
    if (!jobId) return;
    const timestamps = this.activeJobTimestamps.get(jobId);
    if (timestamps && timestamps.startedAt) {
      const duration = Date.now() - timestamps.startedAt;
      this.metrics.executionTimeMsTotal += duration;
      this.metrics.executionCount++;
    }
    this.activeJobTimestamps.delete(jobId);
  }
}

const sandboxMetrics = new SandboxMetrics();
module.exports = { SandboxMetrics, sandboxMetrics };
