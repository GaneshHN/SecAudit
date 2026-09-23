class SecureExecutionProfile {
  constructor(options = {}) {
    this.capabilities = options.capabilities || { drop: ['ALL'], add: [] };
    this.seccompProfile = options.seccompProfile || 'default';
    this.appArmorProfile = options.appArmorProfile || 'unconfined';
    this.noNewPrivileges = options.noNewPrivileges !== false; // Default true
    this.user = options.user || '1000:1000';
    this.readOnlyRootFs = options.readOnlyRootFs === true; // Default false to prevent breaking node.js /tmp writes unless explicitly supported
    this.privileged = false; // Hardcoded to false for security
  }
}

module.exports = SecureExecutionProfile;
