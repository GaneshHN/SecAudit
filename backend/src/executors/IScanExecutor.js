/**
 * Abstract ScanExecutor Interface Contract.
 * Sits between background workers and the Scanner Engine.
 * Workers execute jobs; Executors determine HOW jobs are processed (e.g. Local vs Docker vs Remote).
 */
class IScanExecutor {
  /**
   * Execute a scan job within an ExecutionContext.
   * @param {ExecutionContext} context - The execution context
   * @returns {Promise<Object>} Final scan report JSON
   */
  async execute(context) {
    throw new Error('IScanExecutor subclass must implement execute(context)');
  }
}

module.exports = IScanExecutor;
