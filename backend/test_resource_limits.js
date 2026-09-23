const assert = require('assert');
const SandboxResourcePolicy = require('./src/sandbox/models/SandboxResourcePolicy');
const CancellationToken = require('./src/executors/CancellationToken');
const SandboxResourceMonitor = require('./src/sandbox/utils/SandboxResourceMonitor');
const SandboxContext = require('./src/sandbox/SandboxContext');
const DockerSandboxProvider = require('./src/sandbox/providers/DockerSandboxProvider');
const WorkspaceManager = require('./src/sandbox/WorkspaceManager');
const SandboxConfiguration = require('./src/sandbox/SandboxConfiguration');
const { SANDBOX_EVENTS } = require('./src/sandbox/events/SandboxEvents');
const EventEmitter = require('events');
const { defaultEventBus } = require('./src/events/LocalEventBus');

async function test_resource_limits() {
  console.log('--- Running test_resource_limits.js ---');
  let passed = 0;
  let failed = 0;

  const test = async (name, fn) => {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (e) {
      console.error(`[FAIL] ${name}`);
      console.error(e);
      failed++;
    }
  };

  // 1. Valid resource policy
  await test('Valid resource policy', () => {
    const p = new SandboxResourcePolicy({ memoryMb: 2048, cpuCores: 2, diskMb: 10240, processLimit: 200, timeoutMs: 120000 });
    assert.strictEqual(p.memoryMb, 2048);
  });

  // 2. Invalid resource policy
  await test('Invalid resource policy - negative memory', () => {
    assert.throws(() => new SandboxResourcePolicy({ memoryMb: -100 }), /must be between/);
  });
  await test('Invalid resource policy - NaN CPU', () => {
    assert.throws(() => new SandboxResourcePolicy({ cpuCores: NaN }), /must be a valid number/);
  });
  await test('Invalid resource policy - oversized disk', () => {
    assert.throws(() => new SandboxResourcePolicy({ diskMb: 999999999 }), /must be between/);
  });

  // 17. Existing CancellationToken behavior
  await test('Existing CancellationToken behavior', () => {
    const token = new CancellationToken();
    assert.strictEqual(token.isCancelled, false);
    token.cancel('TEST_REASON');
    assert.strictEqual(token.isCancelled, true);
    assert.strictEqual(token.reason, 'TEST_REASON');
    assert.throws(() => token.throwIfCancelled(), /TEST_REASON/);
  });

  // 7. Cancellation Event Behavior
  await test('Cancellation Event Behavior', () => {
    return new Promise((resolve, reject) => {
      const token = new CancellationToken();
      token.on('cancelled', (reason) => {
        try {
          assert.strictEqual(reason, 'EVENT_TEST');
          resolve();
        } catch (e) {
          reject(e);
        }
      });
      token.cancel('EVENT_TEST');
    });
  });

  await test('Docker configuration parsing', async () => {
    let capturedArgs = [];
    const child_process = require('child_process');
    const originalSpawn = child_process.spawn;

    child_process.spawn = (cmd, args) => {
      capturedArgs = args;
      const ee = new EventEmitter();
      ee.stdout = new EventEmitter();
      ee.stderr = new EventEmitter();
      ee.kill = () => {};
      setTimeout(() => ee.emit('close', 0), 10);
      return ee;
    };
    
    // We need to clear the require cache so DockerSandboxProvider picks up the mocked spawn
    delete require.cache[require.resolve('./src/sandbox/providers/DockerSandboxProvider')];
    const DockerSandboxProvider = require('./src/sandbox/providers/DockerSandboxProvider');

    const config = new SandboxConfiguration({
      workspaceRoot: __dirname + '/tmp_test_ws',
      dockerEnabled: true,
      resources: { memoryMb: 1024, cpuCores: 2, processLimit: 150 }
    });
    
    const ArtifactReader = require('./src/sandbox/utils/ArtifactReader');
    ArtifactReader.readArtifacts = async () => ({ exitCode: 0, report: {}, error: null });
    
    const DatabaseScanResultWriter = require('./src/executors/writers/DatabaseScanResultWriter');
    const oldWrite = DatabaseScanResultWriter.prototype.write;
    DatabaseScanResultWriter.prototype.write = async () => {};
    
    const fs = require('fs');
    if (!fs.existsSync(__dirname + '/tmp_test_ws')) {
      fs.mkdirSync(__dirname + '/tmp_test_ws');
    }
    
    const wm = new WorkspaceManager(config);
    const provider = new DockerSandboxProvider(wm);
    wm.createWorkspace = async (ctx) => { ctx.workspace = __dirname + '/tmp_test_ws'; };
    wm.cleanup = async () => {};
    
    const context = new SandboxContext({ job: { id: 'test1' }, configuration: config });
    
    await provider.execute(context);
    
    assert.ok(capturedArgs.includes('--memory=1024m'));
    assert.ok(capturedArgs.includes('--cpus=2'));
    assert.ok(capturedArgs.includes('--pids-limit=150'));
    
    DatabaseScanResultWriter.prototype.write = oldWrite;
    
    child_process.spawn = originalSpawn;
  });

  // 10, 11, 12, 15: Disk Limit and Warning Events
  await test('Resource Monitor Disk Limit enforcement', async () => {
    const config = new SandboxConfiguration({
      workspaceRoot: __dirname + '/tmp_test_ws',
      resources: { diskMb: 10 } // 10 MB limit
    });
    const token = new CancellationToken();
    const context = new SandboxContext({ job: { id: 'test2' }, configuration: config, cancellationToken: token });
    context.workspace = __dirname + '/tmp_test_ws'; // Mock workspace
    
    const monitor = new SandboxResourceMonitor(context, 100);
    
    // mock getDirSize
    monitor.getDirSize = async () => 11 * 1024 * 1024; // 11 MB
    
    let exceededFired = false;
    let warningFired = false;
    
    defaultEventBus.subscribe(SANDBOX_EVENTS.RESOURCE_EXCEEDED, (e) => { exceededFired = true; });
    defaultEventBus.subscribe(SANDBOX_EVENTS.RESOURCE_WARNING, (e) => { warningFired = true; });
    
    await monitor.checkDiskUsage();
    await new Promise(r => setImmediate(r));
    
    assert.strictEqual(exceededFired, true, 'Should fire Exceeded event');
    assert.strictEqual(token.isCancelled, true, 'Should cancel token');
    assert.strictEqual(token.reason, 'DISK_LIMIT', 'Reason should be DISK_LIMIT');
    
    // Test Warning
    token._cancelled = false; // Reset for test
    monitor.getDirSize = async () => 9.5 * 1024 * 1024; // 9.5 MB
    await monitor.checkDiskUsage();
    await new Promise(r => setImmediate(r));
    
    assert.strictEqual(warningFired, true, 'Should fire Warning event');
    assert.strictEqual(token.isCancelled, false, 'Should NOT cancel token');
  });

  console.log(`\nTest Summary: ${passed} Passed, ${failed} Failed`);
  process.exit(failed === 0 ? 0 : 1);
}

test_resource_limits().catch(err => {
  console.error(err);
  process.exit(1);
});
