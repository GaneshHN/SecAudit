const SandboxResourcePolicy = require('./models/SandboxResourcePolicy');
const SandboxNetworkPolicy = require('./models/SandboxNetworkPolicy');
const CleanupPolicy = require('./models/CleanupPolicy');
const SecureExecutionProfile = require('./SecureExecutionProfile');

/**
 * Validates and encapsulates global sandbox settings.
 */
class SandboxConfiguration {
  constructor(options = {}) {
    this.workspaceRoot = options.workspaceRoot || '/tmp/secaudit-workspaces';
    this.resourcePolicy = new SandboxResourcePolicy(options.resources || {});
    this.networkMode = options.networkMode || SandboxNetworkPolicy.NONE;
    this.cleanupPolicy = options.cleanupPolicy || CleanupPolicy.ALWAYS;
    this.dockerEnabled = options.dockerEnabled === true;
    this.securityProfile = new SecureExecutionProfile(options.security || {});
    
    this.validate();
  }

  validate() {
    if (!this.workspaceRoot || typeof this.workspaceRoot !== 'string') {
      throw new Error('SandboxConfiguration: workspaceRoot must be a valid path');
    }
    if (!Object.values(SandboxNetworkPolicy).includes(this.networkMode)) {
      throw new Error('SandboxConfiguration: Invalid networkMode');
    }
    if (!Object.values(CleanupPolicy).includes(this.cleanupPolicy)) {
      throw new Error('SandboxConfiguration: Invalid cleanupPolicy');
    }
  }
}

module.exports = SandboxConfiguration;
