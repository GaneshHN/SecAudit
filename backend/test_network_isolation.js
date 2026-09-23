const assert = require('assert');
const SandboxNetworkPolicy = require('./src/sandbox/models/SandboxNetworkPolicy');
const SandboxConfiguration = require('./src/sandbox/SandboxConfiguration');
const NetworkPolicyEnforcer = require('./src/sandbox/utils/NetworkPolicyEnforcer');

async function testNetworkIsolation() {
  console.log('Running Network Isolation tests...');

  // 1. Default policy is secure (NONE)
  const config = new SandboxConfiguration({ workspaceRoot: '/tmp/test' });
  assert.strictEqual(config.networkMode, SandboxNetworkPolicy.NONE, 'Default network mode should be NONE');
  console.log('✅ Default policy is secure (NONE)');

  // 2. NONE generates --network=none
  const enforcerNone = new NetworkPolicyEnforcer(SandboxNetworkPolicy.NONE);
  const argsNone = enforcerNone.getDockerArgs();
  assert(argsNone.includes('--network=none'), 'NONE policy should generate --network=none');
  console.log('✅ NONE policy generates --network=none');

  // 3. Invalid network modes are rejected
  try {
    const enforcerInvalid = new NetworkPolicyEnforcer('INVALID_MODE');
    enforcerInvalid.getDockerArgs();
    assert.fail('Should reject invalid network mode');
  } catch (err) {
    assert.strictEqual(err.reason, 'NETWORK_CONFIGURATION_ERROR');
    console.log('✅ Invalid network modes are rejected');
  }

  // 4. Invalid allowlists are rejected (and true allowlist unsupported)
  try {
    const enforcerAllowlist = new NetworkPolicyEnforcer(SandboxNetworkPolicy.ALLOWLIST);
    enforcerAllowlist.getDockerArgs();
    assert.fail('Should reject ALLOWLIST in current environment');
  } catch (err) {
    assert.strictEqual(err.reason, 'NETWORK_CONFIGURATION_ERROR');
    console.log('✅ ALLOWLIST mode is rejected safely');
  }

  // 5. Internal is rejected safely
  try {
    const enforcerInternal = new NetworkPolicyEnforcer(SandboxNetworkPolicy.INTERNAL);
    enforcerInternal.getDockerArgs();
    assert.fail('Should reject INTERNAL in current environment');
  } catch (err) {
    assert.strictEqual(err.reason, 'NETWORK_CONFIGURATION_ERROR');
    console.log('✅ INTERNAL mode is rejected safely');
  }

  // 6. FULL mode blocks known metadata and localhost via /etc/hosts as best effort
  const enforcerFull = new NetworkPolicyEnforcer(SandboxNetworkPolicy.FULL);
  const argsFull = enforcerFull.getDockerArgs();
  assert(!argsFull.includes('--network=none'), 'FULL mode should not have --network=none');
  assert(argsFull.includes('--add-host=metadata.google.internal:0.0.0.0'), 'FULL mode should block metadata endpoint');
  assert(argsFull.includes('--add-host=169.254.169.254:0.0.0.0'), 'FULL mode should block 169.254.169.254');
  console.log('✅ FULL mode includes best-effort metadata blocking');

  console.log('\nAll network isolation tests passed!');
}

testNetworkIsolation().catch(console.error);
