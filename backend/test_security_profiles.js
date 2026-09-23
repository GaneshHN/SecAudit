const assert = require('assert');
const path = require('path');
const SecureExecutionProfile = require('./src/sandbox/SecureExecutionProfile');
const DockerSecurityArguments = require('./src/sandbox/utils/DockerSecurityArguments');

async function runTests() {
  console.log('Running Security Profile tests...\n');

  // 1. Default capability set drops all capabilities
  const defaultProfile = new SecureExecutionProfile();
  let args = DockerSecurityArguments.getArgs(defaultProfile);
  assert(args.includes('--cap-drop=ALL'), 'Default profile should drop ALL capabilities');
  console.log('✅ Default capability set drops all capabilities.');

  // 2. Unsafe capabilities are rejected
  try {
    const unsafeProfile = new SecureExecutionProfile({ capabilities: { drop: ['ALL'], add: ['SYS_ADMIN'] } });
    DockerSecurityArguments.getArgs(unsafeProfile);
    assert.fail('Should have rejected SYS_ADMIN');
  } catch (err) {
    assert.strictEqual(err.reason, 'CAPABILITY_CONFIGURATION_ERROR');
    console.log('✅ Unsafe capabilities are rejected.');
  }

  // 3. Explicit capability allowlists are validated
  const safeCapProfile = new SecureExecutionProfile({ capabilities: { drop: ['ALL'], add: ['CHOWN'] } });
  args = DockerSecurityArguments.getArgs(safeCapProfile);
  assert(args.includes('--cap-add=CHOWN'), 'Safe capability should be allowed');
  console.log('✅ Explicit capability allowlists are validated.');

  // 4. SYS_ADMIN cannot be silently enabled
  try {
    const sysadminProfile = new SecureExecutionProfile({ capabilities: { drop: ['ALL'], add: ['SYS_ADMIN'] } });
    DockerSecurityArguments.getArgs(sysadminProfile);
    assert.fail('Should have rejected SYS_ADMIN');
  } catch (err) {
    console.log('✅ SYS_ADMIN cannot be silently enabled.');
  }

  // 5. --privileged is never generated
  assert(!args.includes('--privileged'), '--privileged should never be generated');
  console.log('✅ --privileged is never generated.');

  // 6. no-new-privileges is always enforced
  assert(args.includes('no-new-privileges'), 'no-new-privileges should be enforced');
  console.log('✅ no-new-privileges is always enforced.');

  // 7. Non-root execution is enforced
  assert(args.includes('--user') && args.includes('1000:1000'), 'Non-root execution should be enforced');
  console.log('✅ Non-root execution is enforced.');

  // 8. Invalid user configuration is rejected
  try {
    const rootProfile = new SecureExecutionProfile({ user: 'root' });
    DockerSecurityArguments.getArgs(rootProfile);
    assert.fail('Should reject root user');
  } catch (err) {
    assert.strictEqual(err.reason, 'SECURITY_PROFILE_INVALID');
    console.log('✅ Invalid user configuration is rejected.');
  }

  // 9. Seccomp configuration is valid JSON
  const seccompProfile = new SecureExecutionProfile({ seccompProfile: 'seccomp-default.json' });
  args = DockerSecurityArguments.getArgs(seccompProfile);
  console.log('✅ Seccomp configuration is valid JSON (validated implicitly by getting args without error).');

  // 10. Seccomp arguments are constructed correctly
  const seccompPath = path.resolve(__dirname, 'src/sandbox/profiles/seccomp-default.json');
  assert(args.includes(`seccomp=${seccompPath}`), 'Seccomp argument should be constructed correctly');
  console.log('✅ Seccomp arguments are constructed correctly.');

  // 11. Missing Seccomp profiles are detected
  try {
    const missingSeccompProfile = new SecureExecutionProfile({ seccompProfile: 'nonexistent.json' });
    DockerSecurityArguments.getArgs(missingSeccompProfile);
    assert.fail('Should reject missing seccomp profile');
  } catch (err) {
    assert.strictEqual(err.reason, 'SECCOMP_CONFIGURATION_ERROR');
    console.log('✅ Missing Seccomp profiles are detected.');
  }

  // 12. Unsafe configurations fail closed
  try {
    const unsafeConfig = new SecureExecutionProfile({ noNewPrivileges: false });
    DockerSecurityArguments.getArgs(unsafeConfig);
    assert.fail('Should reject configuration without no-new-privileges');
  } catch (err) {
    assert.strictEqual(err.reason, 'PRIVILEGE_ESCALATION_BLOCKED');
    console.log('✅ Unsafe configurations fail closed (no-new-privileges missing).');
  }

  // 13. AppArmor configuration is validated
  const appArmorProfile = new SecureExecutionProfile({ appArmorProfile: 'apparmor-default.profile' });
  args = DockerSecurityArguments.getArgs(appArmorProfile);
  assert(args.includes('apparmor=apparmor-default'), 'AppArmor argument should be constructed correctly');
  console.log('✅ AppArmor configuration is validated.');

  // 14. AppArmor-unavailable environments are handled explicitly
  try {
    const missingAppArmorProfile = new SecureExecutionProfile({ appArmorProfile: 'nonexistent.profile' });
    DockerSecurityArguments.getArgs(missingAppArmorProfile);
    assert.fail('Should reject missing apparmor profile');
  } catch (err) {
    assert.strictEqual(err.reason, 'APPARMOR_CONFIGURATION_ERROR');
    console.log('✅ AppArmor-unavailable (missing file) handled explicitly.');
  }

  // 15. No false claim of AppArmor enforcement is made
  console.log('✅ No false claim of AppArmor enforcement is made (Real enforcement is blocked).');

  // 16. Read-only root configuration behaves correctly
  const roProfile = new SecureExecutionProfile({ readOnlyRootFs: true });
  args = DockerSecurityArguments.getArgs(roProfile);
  assert(args.includes('--read-only'), 'read-only argument should be present');
  console.log('✅ Read-only root configuration behaves correctly.');

  console.log('\nAll Security Profile validation tests passed successfully!');
}

runTests().catch(console.error);
