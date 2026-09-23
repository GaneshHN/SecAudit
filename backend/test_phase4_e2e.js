const cp = require('child_process');
const path = require('path');
const fs = require('fs');

// --- DETAILED DETERMINISTIC DOCKER MOCK ---
const originalSpawn = cp.spawn;
let dockerInvocations = [];
let mockDockerUnavailable = false;

cp.spawn = function(command, args, options) {
  if (command === 'docker') {
    if (mockDockerUnavailable) {
      const err = new Error('spawn docker ENOENT');
      err.code = 'ENOENT';
      const child = new cp.ChildProcess();
      setTimeout(() => child.emit('error', err), 10);
      return child;
    }
    
    dockerInvocations.push({ args, options });
    
    if (args[0] === 'run') {
      const wIndex = args.indexOf('-w');
      const vIndex = args.findIndex(a => a.includes(':/workspace:rw'));
      
      let realWorkspacePath = '/workspace';
      if (vIndex !== -1) {
        const argStr = args[vIndex];
        realWorkspacePath = argStr.substring(0, argStr.lastIndexOf(':/workspace:rw'));
      }

      // Simulate docker-runner.js
      const runnerPath = path.resolve(__dirname, 'src/sandbox/bin/docker-runner.js');
      const child = originalSpawn('node', [runnerPath, realWorkspacePath], {
        env: { ...process.env, WORKSPACE_PATH: realWorkspacePath },
        stdio: ['ignore', 'pipe', 'pipe']
      });

      return child;
    } else if (args[0] === 'rm') {
      const child = new cp.ChildProcess();
      setTimeout(() => child.emit('close', 0), 10);
      return child;
    }
  }
  return originalSpawn(command, args, options);
};

const { queueService } = require('./src/queue/QueueService');
const ScanWorker = require('./src/workers/ScanWorker');
const WorkerMonitorDecorator = require('./src/workers/WorkerMonitorDecorator');
const { eventLogger } = require('./src/logging/EventLogger');
const { defaultEventBus } = require('./src/events/LocalEventBus');
const unitOfWork = require('./src/persistence/unitOfWorkInstance');
const JobStatePersister = require('./src/persistence/JobStatePersister');
const SandboxConfiguration = require('./src/sandbox/SandboxConfiguration');
const SandboxedScanExecutor = require('./src/executors/SandboxedScanExecutor');
const { sandboxAuditLogger } = require('./src/sandbox/utils/SandboxAuditLogger');
const { sandboxMetrics } = require('./src/sandbox/utils/SandboxMetrics');
const { SandboxReaperScheduler } = require('./src/sandbox/utils/SandboxReaperScheduler');

// Intercept logs
const capturedLogs = [];
const logger = require('./src/logging/logger').logger;
const originalLoggerInfo = logger.info.bind(logger);
logger.info = (msg, obj) => {
  capturedLogs.push({ msg, obj });
  originalLoggerInfo(msg, obj);
};

async function runE2ETests() {
  console.log('🧪 Starting Phase 4 E2E Integration Test...\n');
  
  eventLogger.start();
  sandboxAuditLogger.start();
  sandboxMetrics.start();
  
  const jobStatePersister = new JobStatePersister(unitOfWork);
  jobStatePersister.start();

  const queueProvider = queueService.getQueue('phase4-e2e', { concurrency: 1 });
  const sandboxConfig = new SandboxConfiguration({
    dockerEnabled: true,
    resources: { memoryMb: 512, cpuCores: 1, processLimit: 20, timeoutMs: 10000 }
  });
  
  const executor = new SandboxedScanExecutor({ sandboxConfig });
  const rawWorker = new ScanWorker({ queueProvider, jobType: 'scan', executor });
  const worker = new WorkerMonitorDecorator(rawWorker);
  worker.start();

  const scheduler = new SandboxReaperScheduler({ intervalMs: 60000, workspaceRoot: sandboxConfig.workspaceRoot });
  scheduler.start();

  // 1. Submit Job
  console.log('[1] Submitting Scan Job...');
  const job = await queueProvider.enqueue('scan', {
    repository: 'e2e-repo',
    branch: 'main',
    userId: 'e2e-user'
  });

  // 2. Wait for completion
  console.log('[2] Waiting for Job Execution...');
  let jobState = null;
  for (let i = 0; i < 30; i++) {
    try {
      jobState = await unitOfWork.scanJobs.getById(job.id);
      if (jobState && (jobState.status === 'COMPLETED' || jobState.status === 'FAILED')) break;
    } catch (e) {}
    await new Promise(r => setTimeout(r, 100));
  }

  if (!jobState || jobState.status !== 'COMPLETED') {
    throw new Error(`Job did not complete successfully. Status: ${jobState?.status}`);
  }

  // 3. Verify Docker Args
  console.log('[3] Verifying Security Chain & Container Creation...');
  const dockerRun = dockerInvocations.find(i => i.args[0] === 'run');
  if (!dockerRun) throw new Error('Docker run was never called');
  
  const args = dockerRun.args;
  
  // Security checks
  if (!args.includes('--cap-drop=ALL')) throw new Error('Missing --cap-drop=ALL');
  if (!args.includes('no-new-privileges')) throw new Error('Missing no-new-privileges');
  if (!args.includes('--network=none')) throw new Error('Network isolation missing');
  if (!args.find(a => a.startsWith('--memory='))) throw new Error('Memory limit missing');
  
  // Labels
  if (!args.find(a => a.includes('secaudit.managed=true'))) throw new Error('Management label missing');
  if (!args.find(a => a.includes(`secaudit.job_id=${job.id}`))) throw new Error('Job ID label missing');
  
  console.log('   ✅ Docker isolation constraints are firmly applied.');

  // 4. Verify Host Persistence
  console.log('[4] Verifying Host Persistence...');
  const scanResult = await unitOfWork.scanResults.getByJobId(job.id);
  if (!scanResult || scanResult.score !== 100) {
    throw new Error('Scan result was not persisted on the host!');
  }
  console.log('   ✅ Result safely traversed the IPC/Artifact boundary to DB.');

  // 5. Verify Observability
  console.log('[5] Verifying Observability & Auditability...');
  await new Promise(r => setTimeout(r, 150)); // Wait for async event processing
  
  const metrics = sandboxMetrics.getMetrics();
  console.log('Metrics:', JSON.stringify(metrics, null, 2));
  if (metrics.starts !== 1 || metrics.completions !== 1) {
    throw new Error('SandboxMetrics did not record the full lifecycle.');
  }
  
  const auditLogs = capturedLogs.filter(l => l.msg && l.msg.includes('Sandbox Audit:'));
  if (auditLogs.length < 3) {
    throw new Error('Insufficient audit logs generated.');
  }
  if (!auditLogs.some(l => l.msg.includes('SandboxCompleted'))) {
    throw new Error('Completion audit log missing.');
  }
  console.log('   ✅ Audit logging and metrics accurately reflect execution.');

  // 6. Verify Cleanup
  console.log('[6] Verifying Cleanups...');
  const dockerRm = dockerInvocations.find(i => i.args[0] === 'rm');
  if (!dockerRm) throw new Error('docker rm -f was not called');
  console.log('   ✅ Container was actively destroyed.');

  // Verify workspace is gone
  const wsIndex = dockerRun.args.findIndex(a => a.includes(':/workspace:rw'));
  const realWorkspacePath = dockerRun.args[wsIndex].substring(0, dockerRun.args[wsIndex].lastIndexOf(':/workspace:rw'));
  
  try {
    await fs.promises.access(realWorkspacePath);
    throw new Error('Workspace was not cleaned up on host!');
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  console.log('   ✅ Workspace directory aggressively purged on completion.');

  console.log('\n🎉 ALL PHASE 4 E2E INTEGRATION TESTS PASSED!');
  process.exit(0);
}

runE2ETests().catch(err => {
  console.error('\n❌ E2E TEST FAILED:', err.message);
  process.exit(1);
});
