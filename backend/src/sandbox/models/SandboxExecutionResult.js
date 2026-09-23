class SandboxExecutionResult {
  constructor({ report, logs, metadata, exitCode, error }) {
    this.report = report;
    this.logs = logs || [];
    this.metadata = metadata || {};
    this.exitCode = exitCode || 0;
    this.error = error || null;
  }
}

module.exports = SandboxExecutionResult;
