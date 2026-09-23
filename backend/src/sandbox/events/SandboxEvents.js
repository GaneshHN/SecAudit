const BaseEvent = require('../../events/BaseEvent');
const { EventCategory } = require('../../events/EventCategory');

const SANDBOX_EVENTS = {
  CREATED: 'SandboxCreated',
  STARTED: 'SandboxStarted',
  COMPLETED: 'SandboxCompleted',
  FAILED: 'SandboxFailed',
  DESTROYED: 'SandboxDestroyed',
  RESOURCE_WARNING: 'ResourceLimitWarning',
  RESOURCE_EXCEEDED: 'ResourceLimitExceeded',
  TIMEOUT: 'SandboxTimeout',
  TERMINATED: 'SandboxTerminated'
};

function createSandboxEvent(eventAction, context, details = {}) {
  return new BaseEvent({
    eventType: eventAction,
    category: EventCategory.SYSTEM,
    sourceComponent: 'SandboxProvider',
    jobId: context.job.id,
    correlationId: context.correlationId,
    payload: {
      workspace: context.workspace,
      ...details
    }
  });
}

module.exports = {
  SANDBOX_EVENTS,
  createSandboxEvent
};
