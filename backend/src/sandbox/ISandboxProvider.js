/**
 * Interface defining the Sandbox Provider contract.
 * Abstraction for executing scans in isolated environments.
 */
class ISandboxProvider {
  /**
   * Prepares the isolated workspace.
   * @param {SandboxContext} context 
   */
  async prepareWorkspace(context) {
    throw new Error('Method not implemented.');
  }

  /**
   * Executes the scan within the sandbox.
   * @param {SandboxContext} context 
   * @returns {Promise<Object>} Scan Result Report
   */
  async execute(context) {
    throw new Error('Method not implemented.');
  }

  /**
   * Streams logs from the sandbox.
   * @param {SandboxContext} context 
   */
  async streamLogs(context) {
    throw new Error('Method not implemented.');
  }

  /**
   * Cleans up the sandbox and its workspace.
   * @param {SandboxContext} context 
   * @param {boolean} isSuccess 
   */
  async cleanup(context, isSuccess) {
    throw new Error('Method not implemented.');
  }
}

module.exports = ISandboxProvider;
