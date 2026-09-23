const assert = require('assert');
const SandboxLifecycleManager = require('./src/sandbox/utils/SandboxLifecycleManager');
const SandboxState = require('./src/sandbox/models/SandboxState');
const { EventEmitter } = require('events');
const fs = require('fs/promises');
const path = require('path');
const SandboxReaper = require('./src/sandbox/utils/SandboxReaper');

async function testLifecycleManager() {
  console.log("🧪 Starting Sandbox Lifecycle Tests...");

  // Mock Context
  const context = {
    job: { id: 'job_123_test' },
    configuration: {
      resourcePolicy: { gracePeriodMs: 50, timeoutMs: 500 }
    },
    logger: { error: () => {} }
  };

  // 1. Valid Transitions
  const manager = new SandboxLifecycleManager(context, () => {}, {}, { stop: () => {} });
  assert.strictEqual(manager.state, SandboxState.CREATED);
  manager.transition(SandboxState.PREPARING);
  assert.strictEqual(manager.state, SandboxState.PREPARING);
  
  // 2. Container Identity Validation
  assert.strictEqual(manager.containerName.startsWith('secaudit-sandbox-job_123_test-'), true);

  // 3. Child Process tracking & Natural Exit
  const mockChild = new EventEmitter();
  mockChild.kill = () => {};
  manager.setChildProcess(mockChild);
  
  mockChild.emit('close', 0);
  assert.strictEqual(manager.isChildExited, true);
  assert.strictEqual(manager.finalExitCode, 0);

  // 4. Cleanup Idempotence & State convergence
  const cleanupPromise1 = manager.cleanup();
  const cleanupPromise2 = manager.cleanup();
  assert.strictEqual(cleanupPromise1, cleanupPromise2);

  const result = await cleanupPromise1;
  assert.strictEqual(result.exitCode, 0);
  assert.strictEqual(manager.state, SandboxState.DESTROYED);

  // 5. Cleanup Race condition (Timeout vs Exit)
  const managerRace = new SandboxLifecycleManager(context, () => {}, {}, { stop: () => {} });
  const mockChildRace = new EventEmitter();
  mockChildRace.kill = () => {};
  managerRace.setChildProcess(mockChildRace);

  // Process exits naturally
  mockChildRace.emit('close', 0);

  // Timeout tries to cancel shortly after
  await managerRace.cleanup('TIMEOUT');
  
  // It should NOT be classified as timeout because child exited first cleanly
  // Actually, wait, if child exited first and we call cleanup('TIMEOUT'), our logic says:
  // if (reason && !this.cancellationReason && !this.isChildExited) { this.cancellationReason = reason; }
  // So it shouldn't set cancellationReason!
  assert.strictEqual(managerRace.cancellationReason, null);

  console.log("✅ Lifecycle Manager tests passed.");
}

async function testReaper() {
  console.log("🧪 Starting Sandbox Reaper Tests...");

  const wsRoot = path.join(__dirname, 'reaper_test_root');
  await fs.mkdir(wsRoot, { recursive: true });

  const reaper = new SandboxReaper({ workspaceRoot: wsRoot });

  // 1. Create a valid, expired workspace
  const expiredWs = path.join(wsRoot, 'secaudit-ws-expired-123');
  await fs.mkdir(expiredWs, { recursive: true });
  await fs.writeFile(path.join(expiredWs, '.secaudit-metadata.json'), JSON.stringify({
    jobId: 'expired_job',
    expirationTime: new Date(Date.now() - 10000).toISOString() // 10s ago
  }));

  // 2. Create a valid, ACTIVE workspace
  const activeWs = path.join(wsRoot, 'secaudit-ws-active-456');
  await fs.mkdir(activeWs, { recursive: true });
  await fs.writeFile(path.join(activeWs, '.secaudit-metadata.json'), JSON.stringify({
    jobId: 'active_job',
    expirationTime: new Date(Date.now() + 100000).toISOString() // future
  }));

  // 3. Create a malformed workspace (missing metadata)
  const malformedWs = path.join(wsRoot, 'secaudit-ws-malformed-789');
  await fs.mkdir(malformedWs, { recursive: true });

  // 4. Create an unrelated directory
  const unrelatedWs = path.join(wsRoot, 'some-other-folder');
  await fs.mkdir(unrelatedWs, { recursive: true });

  const reapedCount = await reaper.runReaper();
  
  assert.strictEqual(reapedCount, 1);

  // Verify what was deleted
  let expiredExists = false;
  try { await fs.stat(expiredWs); expiredExists = true; } catch (e) {}
  assert.strictEqual(expiredExists, false); // SHOULD BE DELETED

  let activeExists = false;
  try { await fs.stat(activeWs); activeExists = true; } catch (e) {}
  assert.strictEqual(activeExists, true); // SHOULD STILL EXIST

  let malformedExists = false;
  try { await fs.stat(malformedWs); malformedExists = true; } catch (e) {}
  assert.strictEqual(malformedExists, true); // SHOULD STILL EXIST (safe rejection)

  let unrelatedExists = false;
  try { await fs.stat(unrelatedWs); unrelatedExists = true; } catch (e) {}
  assert.strictEqual(unrelatedExists, true); // SHOULD STILL EXIST

  // Cleanup
  await fs.rm(wsRoot, { recursive: true, force: true });

  console.log("✅ Sandbox Reaper tests passed.");
}

async function runAll() {
  try {
    await testLifecycleManager();
    await testReaper();
    console.log("🎉 ALL SANDBOX LIFECYCLE TESTS PASSED!");
  } catch (err) {
    console.error("❌ Test Failed:", err);
    process.exit(1);
  }
}

runAll();
