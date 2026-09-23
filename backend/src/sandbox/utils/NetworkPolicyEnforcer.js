const SandboxNetworkPolicy = require('../models/SandboxNetworkPolicy');

class NetworkPolicyEnforcer {
  constructor(policy) {
    this.policy = policy || SandboxNetworkPolicy.NONE;
  }

  validate() {
    const validPolicies = Object.values(SandboxNetworkPolicy);
    if (!validPolicies.includes(this.policy)) {
      throw this._createError('NETWORK_CONFIGURATION_ERROR', `Invalid network policy '${this.policy}'`);
    }

    if (this.policy === SandboxNetworkPolicy.ALLOWLIST || this.policy === SandboxNetworkPolicy.WHITELIST) {
      throw this._createError('NETWORK_CONFIGURATION_ERROR', 'True allowlist enforcement cannot safely be implemented in the current environment without introducing a custom network architecture.');
    }

    if (this.policy === SandboxNetworkPolicy.INTERNAL || this.policy === SandboxNetworkPolicy.REPOSITORY_ONLY) {
      throw this._createError('NETWORK_CONFIGURATION_ERROR', 'Internal network mode cannot safely be implemented in the current environment.');
    }
  }

  getDockerArgs() {
    this.validate();

    const args = [];

    if (this.policy === SandboxNetworkPolicy.NONE || this.policy === SandboxNetworkPolicy.OFFLINE) {
      args.push('--network=none');
    } else if (this.policy === SandboxNetworkPolicy.FULL) {
      // FULL mode relies on default bridge.
      // We block known metadata hostnames as a best-effort defense via /etc/hosts,
      // but true IP blocking for 169.254.169.254, 127.0.0.1, and private ranges
      // requires a custom Docker network with iptables rules, which is an architectural limitation here.
      args.push('--add-host=metadata.google.internal:0.0.0.0');
      args.push('--add-host=169.254.169.254:0.0.0.0'); // some tools might try this as hostname
    }

    return args;
  }

  _createError(reason, message) {
    const err = new Error(message);
    err.reason = reason;
    return err;
  }
}

module.exports = NetworkPolicyEnforcer;
