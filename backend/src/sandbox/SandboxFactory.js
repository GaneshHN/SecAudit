const LocalSandboxProvider = require('./providers/LocalSandboxProvider');
const DockerSandboxProvider = require('./providers/DockerSandboxProvider');
const WorkspaceManager = require('./WorkspaceManager');

/**
 * Factory to determine and instantiate the appropriate Sandbox Provider based on configuration.
 */
class SandboxFactory {
  /**
   * Creates the appropriate SandboxProvider.
   * @param {SandboxConfiguration} config 
   * @returns {ISandboxProvider}
   */
  static createProvider(config) {
    const workspaceManager = new WorkspaceManager(config);

    if (config.dockerEnabled) {
      return new DockerSandboxProvider(workspaceManager);
    }
    
    // Default to Local execution
    return new LocalSandboxProvider(workspaceManager);
  }
}

module.exports = SandboxFactory;
