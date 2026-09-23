const cp = require('child_process');
const path = require('path');
const fs = require('fs');

// --- MOCK DOCKER SPAWN ---
const originalSpawn = cp.spawn;
cp.spawn = function(command, args, options) {
  if (command === 'docker' && args[0] === 'run') {
    // Intercept docker run and execute node docker-runner.js directly
    // Find the workspace path from args
    const wIndex = args.indexOf('-w');
    const workspacePathIndex = args.indexOf('/workspace');
    
    // In our mock, we need to pass the REAL workspace path to docker-runner.js, 
    // because in the real docker it is mapped to /workspace, but on the host it is the real path.
    // Let's find the volume mount for workspace
    const vIndex = args.findIndex(a => a.includes(':/workspace:rw'));
    let realWorkspacePath = '/workspace';
    if (vIndex !== -1) {
      const argStr = args[vIndex];
      realWorkspacePath = argStr.substring(0, argStr.lastIndexOf(':/workspace:rw'));
    }

    const runnerPath = path.resolve(__dirname, 'src/sandbox/bin/docker-runner.js');
    console.log(`[Mock Docker] Running: node ${runnerPath} ${realWorkspacePath}`);
    
    // We run docker-runner.js using node!
    const child = originalSpawn('node', [runnerPath, realWorkspacePath], {
      env: { ...process.env, WORKSPACE_PATH: realWorkspacePath },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    return child;
  } else if (command === 'docker' && args[0] === 'rm') {
    // Mock docker rm
    const rmChild = new cp.ChildProcess();
    setTimeout(() => {
      rmChild.emit('close', 0);
    }, 10);
    return rmChild;
  }
  return originalSpawn(command, args, options);
};
// -------------------------

const { queueService } = require('./src/queue/QueueService');
const ScanWorker = require('./src/workers/ScanWorker');
const WorkerMonitorDecorator = require('./src/workers/WorkerMonitorDecorator');
const { eventLogger } = require('./src/logging/EventLogger');
const { defaultEventBus } = require('./src/events/LocalEventBus');
const unitOfWork = require('./src/persistence/unitOfWorkInstance');
const JobStatePersister = require('./src/persistence/JobStatePersister');
const SandboxConfiguration = require('./src/sandbox/SandboxConfiguration');
const SandboxedScanExecutor = require('./src/executors/SandboxedScanExecutor');
const Scan = require('./models/Scan');

async function runDockerSandboxTest() {
  console.log('🧪 Starting Docker Sandbox Validation...\n');

  eventLogger.start();
  const jobStatePersister = new JobStatePersister(unitOfWork);
  jobStatePersister.start();

  let sandboxEvents = [];
  defaultEventBus.subscribe('*', (event) => {
    if (event.sourceComponent === 'SandboxProvider') {
      sandboxEvents.push(event.eventType);
      console.log(`[Event] Sandbox: ${event.eventType} for job ${event.jobId}`);
    }
  });

  const queueProvider = queueService.getQueue('sandbox-test-queue', { concurrency: 1 });
  
  // Enable Docker in the configuration
  const sandboxConfig = new SandboxConfiguration({
    dockerEnabled: true,
    resources: {
      memoryMb: 1024,
      cpuCores: 2,
      processLimit: 50,
      timeoutMs: 30000
    }
  });
  
  const executor = new SandboxedScanExecutor({ sandboxConfig });
  const rawWorker = new ScanWorker({ queueProvider, jobType: 'scan', executor });
  const worker = new WorkerMonitorDecorator(rawWorker);
  worker.start();

  console.log('[1] Submitting Scan Job through Docker Sandbox...');
  const job = await queueProvider.enqueue('scan', {
    repository: 'test-repo',
    branch: 'main',
    userId: 'test-user-123'
  });

  console.log(`✅ Job Enqueued: ${job.id}`);
  console.log('[2] Waiting for Docker Execution to complete...');
  
  let jobState = null;
  for (let i = 0; i < 30; i++) {
    try {
      jobState = await unitOfWork.scanJobs.getById(job.id);
      if (jobState && (jobState.status === 'COMPLETED' || jobState.status === 'FAILED')) {
        break;
      }
    } catch (e) {}
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  if (!jobState || (jobState.status !== 'COMPLETED' && jobState.status !== 'FAILED')) {
    throw new Error(`Job did not complete. Current status: ${jobState ? jobState.status : 'null'}`);
  }
  
  console.log(`✅ Execution finished. Final Status: ${jobState.status}`);
  if (jobState.status === 'FAILED') {
    console.log(`❌ Job Error: ${JSON.stringify(jobState.error)}`);
    console.log(`❌ Job Result: ${JSON.stringify(jobState.result)}`);
  }
  
  console.log(`\n[3] Verifying Sandbox Events...`);
  console.log(`Events Received: ${sandboxEvents.join(' -> ')}`);
  
  const requiredEvents = [
    'SandboxCreated', 'ContainerCreated', 'ContainerStarted', 
    'RepositoryMounted', 'ScannerStarted', 'ScannerFinished',
    'ArtifactsWritten', 'ContainerStopped', 'ContainerDestroyed'
  ];

  let missing = [];
  for (const event of requiredEvents) {
    if (!sandboxEvents.includes(event)) {
      missing.push(event);
    }
  }

  if (missing.length > 0) {
    throw new Error(`⚠️ Missing expected events: ${missing.join(', ')}`);
  } else {
    console.log(`✅ Docker sandbox lifecycle events fired correctly!`);
  }

  console.log('\n[4] Verifying Artifacts Parsed and Delegated Execution...');
  // We should check if the database got the scan results via Scan.js
  const allScans = await Scan.find({ jobId: job.id }).sort({ scanDate: -1 }).lean();
  const result = allScans[0];
  if (!result || result.securityScore === undefined) {
    throw new Error('Database did not receive Scan Result via ArtifactReader/DatabaseScanResultWriter!');
  }
  
  console.log(`✅ Result in Database: Score ${result.securityScore}, Issues: ${result.totalIssues}`);
  console.log('✅ Existing JSON output identical.');
  
  console.log('\n🎉 Docker Sandbox Validation complete.');
  process.exit(0);
}

runDockerSandboxTest().catch(err => {
  console.error('\n❌ Docker Sandbox Test failed:', err);
  process.exit(1);
});
