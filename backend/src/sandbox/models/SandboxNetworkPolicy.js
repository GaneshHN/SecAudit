/**
 * Network isolation policies for the sandbox.
 */
const SandboxNetworkPolicy = {
  NONE: 'NONE',
  OFFLINE: 'OFFLINE',
  ALLOWLIST: 'ALLOWLIST',
  WHITELIST: 'WHITELIST',
  INTERNAL: 'INTERNAL',
  REPOSITORY_ONLY: 'REPOSITORY_ONLY',
  FULL: 'FULL'
};

module.exports = SandboxNetworkPolicy;
