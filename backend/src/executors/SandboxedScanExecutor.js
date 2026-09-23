const IScanExecutor = require('./IScanExecutor');
const SandboxContext = require('../sandbox/SandboxContext');
const SandboxConfiguration = require('../sandbox/SandboxConfiguration');
const SandboxFactory = require('../sandbox/SandboxFactory');

/**
 * Decorator / Wrapper that intercepts the execution path from the Worker,
 * prepares the Sandbox Environment via the SandboxProvider,
 * and seamlessly executes the underlying scan within the isolated context.
 */
class SandboxedScanExecutor extends IScanExecutor {
  constructor(options = {}) {
    super();
    // Use default configuration if not provided
    this.sandboxConfig = options.sandboxConfig || new SandboxConfiguration();
    // Instantiate provider via factory
    this.sandboxProvider = SandboxFactory.createProvider(this.sandboxConfig);
  }

  async execute(context) {
    // Transform ExecutionContext into SandboxContext
    const sandboxContext = new SandboxContext({
      job: context.job,
      configuration: this.sandboxConfig,
      cancellationToken: context.cancellationToken,
      logger: context.logger,
      correlationId: context.correlationId,
      executionContext: context
    });

    // Delegate execution to the Sandbox Provider
    // The SandboxProvider manages isolation, workspace creation, cleanup, and invoking
    // the internal scanner engine safely.
    return await this.sandboxProvider.execute(sandboxContext);
  }
}

module.exports = SandboxedScanExecutor;
