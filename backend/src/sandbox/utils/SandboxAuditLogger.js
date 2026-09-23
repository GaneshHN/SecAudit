const { defaultEventBus } = require('../../events/LocalEventBus');
const { logger } = require('../../logging/logger');
const { SANDBOX_EVENTS } = require('../events/SandboxEvents');

/**
 * SandboxAuditLogger
 * Passively subscribes to sandbox events and produces structured audit records.
 * Ensures credentials, raw data, and findings are never logged.
 */
class SandboxAuditLogger {
  constructor() {
    this._handleEvent = this._handleEvent.bind(this);
  }

  start() {
    defaultEventBus.subscribe('*', this._handleEvent);
    logger.info('SandboxAuditLogger started. Listening for sandbox audit events.');
  }

  stop() {
    defaultEventBus.unsubscribe('*', this._handleEvent);
  }

  _handleEvent(event) {
    if (!event || !event.eventType) return;

    try {
      const type = event.eventType;
      
      // Determine if this is a relevant sandbox or security event
      const isSandboxEvent = Object.values(SANDBOX_EVENTS).includes(type);
      const isSecurityEvent = [
        'NetworkIsolationFailure', 'SecurityProfileInvalid', 'ArtifactValidationFailed',
        'PrivilegeEscalationBlocked', 'IPCProtocolViolation', 'SecurityIsolationFailure',
        'CapabilityConfigurationError', 'SeccompConfigurationError', 'AppArmorConfigurationError'
      ].includes(type);

      if (!isSandboxEvent && !isSecurityEvent) {
        return; // Not an audit-worthy sandbox event
      }

      const auditRecord = this._createAuditRecord(event);
      
      const level = this._determineLogLevel(type);
      logger[level](`Sandbox Audit: ${type}`, auditRecord);
    } catch (err) {
      // Do not crash the application on audit logging failure
      logger.error('Failed to process sandbox audit event', { error: err.message });
    }
  }

  _createAuditRecord(event) {
    const payload = event.payload || {};
    
    // Core identity and correlation
    const record = {
      timestamp: new Date().toISOString(),
      jobId: this._sanitizeString(event.jobId || payload.jobId),
      correlationId: this._sanitizeString(event.correlationId || payload.correlationId),
      eventType: this._sanitizeString(event.eventType),
      sandboxType: 'docker'
    };

    // Safe operational metadata
    if (payload.state) record.lifecycleState = this._sanitizeString(payload.state);
    if (payload.reason) record.failureCategory = this._sanitizeString(payload.reason);
    if (payload.duration) record.durationMs = Number(payload.duration) || 0;
    
    if (event.eventType === SANDBOX_EVENTS.RESOURCE_WARNING || event.eventType === SANDBOX_EVENTS.RESOURCE_EXCEEDED) {
      record.resourceType = this._sanitizeString(payload.resource);
      record.usage = Number(payload.usageMb) || 0;
      record.limit = Number(payload.limitMb) || 0;
    }

    if (payload.workspace) {
      // Only log the basename or safe path representation, not full paths that might contain secrets
      record.workspaceId = this._sanitizeString(payload.workspace.split(/[\\/]/).pop());
    }

    // Capture scrubbed error details if present
    if (payload.error) {
      record.errorSummary = this._truncateString(this._sanitizeString(payload.error), 200);
    }

    return record;
  }

  _sanitizeString(str) {
    if (!str) return undefined;
    if (typeof str !== 'string') return undefined;
    
    // Strip common secret patterns roughly, and remove control characters
    let sanitized = str.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
    
    // Redact potential passwords/tokens heuristically (basic safeguard)
    sanitized = sanitized.replace(/(password|secret|token|key|credentials)["':=]+[^\s,;&]+/gi, '$1=***');
    sanitized = sanitized.replace(/mongodb(?:\+srv)?:\/\/[^@]+@/gi, 'mongodb://***:***@');
    
    return sanitized;
  }

  _truncateString(str, maxLength) {
    if (!str) return undefined;
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength) + '...[TRUNCATED]';
  }

  _determineLogLevel(eventType) {
    if (eventType === SANDBOX_EVENTS.FAILED || eventType === SANDBOX_EVENTS.RESOURCE_EXCEEDED || eventType === SANDBOX_EVENTS.TIMEOUT || eventType.includes('Failure') || eventType.includes('Violation') || eventType.includes('Error')) {
      return 'error';
    }
    if (eventType === SANDBOX_EVENTS.RESOURCE_WARNING || eventType === SANDBOX_EVENTS.TERMINATED || eventType.includes('Blocked')) {
      return 'warn';
    }
    return 'info';
  }
}

const sandboxAuditLogger = new SandboxAuditLogger();
module.exports = { SandboxAuditLogger, sandboxAuditLogger };
