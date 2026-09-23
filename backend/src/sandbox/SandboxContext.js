/**
 * Context passed to the Sandbox execution, encapsulating all required objects.
 */
class SandboxContext {
  constructor(options = {}) {
    if (!options.job) throw new Error('SandboxContext requires a job');
    if (!options.configuration) throw new Error('SandboxContext requires a SandboxConfiguration');
    
    this.job = options.job;
    this.configuration = options.configuration;
    this.logger = options.logger || console;
    this.correlationId = options.correlationId || this.job.id;
    this.cancellationToken = options.cancellationToken;
    this.workspace = options.workspace; // Assigned by WorkspaceManager
    this.executionContext = options.executionContext; // Original execution context
  }
}

module.exports = SandboxContext;
