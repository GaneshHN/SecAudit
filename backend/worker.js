const { env } = require('./config/env');
const { queueService } = require('./src/queue/QueueService');
const ScanWorker = require('./src/workers/ScanWorker');
const WorkerMonitorDecorator = require('./src/workers/WorkerMonitorDecorator');
const { eventLogger } = require('./src/logging/EventLogger');
const { monitoringService } = require('./src/monitoring/MonitoringService');
const unitOfWork = require('./src/persistence/unitOfWorkInstance');
const EventPersister = require('./src/events/EventPersister');
const JobStatePersister = require('./src/persistence/JobStatePersister');
const SandboxConfiguration = require('./src/sandbox/SandboxConfiguration');
const SandboxedScanExecutor = require('./src/executors/SandboxedScanExecutor');
const { sandboxAuditLogger } = require('./src/sandbox/utils/SandboxAuditLogger');
const { sandboxMetrics } = require('./src/sandbox/utils/SandboxMetrics');
const { SandboxReaperScheduler } = require('./src/sandbox/utils/SandboxReaperScheduler');
const { validateDockerRuntime } = require('./scripts/validate-docker-runtime');

console.log(`\n🚀 Starting SecAudit Worker Daemon in ${env.NODE_ENV} mode...`);

// 0. Docker Runtime Validation
const dockerDiagnostic = validateDockerRuntime();
if (env.NODE_ENV === 'production' && dockerDiagnostic.overall !== 'PASS') {
  console.error('\n❌ FATAL: Production environment failed Docker runtime validation.');
  console.error(JSON.stringify(dockerDiagnostic, null, 2));
  process.exit(1);
} else if (dockerDiagnostic.overall !== 'PASS') {
  console.warn('\n⚠️ WARNING: Docker runtime validation failed. Mock executors may be used in development/test.');
  console.warn(JSON.stringify(dockerDiagnostic, null, 2));
} else {
  console.log('✅ Docker runtime verified successfully.');
}

// 1. Start Observability
eventLogger.start();
monitoringService.start();
sandboxAuditLogger.start();
sandboxMetrics.start();

// 2. Start Persistence
const eventPersister = new EventPersister(unitOfWork.events);
eventPersister.start();

const jobStatePersister = new JobStatePersister(unitOfWork);
jobStatePersister.start();

// 3. Configure Sandbox
const sandboxConfig = new SandboxConfiguration({
  dockerEnabled: true,
  resources: {
    memoryMb: 1024,
    cpuCores: 2,
    processLimit: 50,
    timeoutMs: 5 * 60 * 1000 // 5 minutes
  }
});
const executor = new SandboxedScanExecutor({ sandboxConfig });

// 4. Start Queue and Worker
const queueProvider = queueService.getQueue('scan', { concurrency: env.WORKER_CONCURRENCY });
const rawWorker = new ScanWorker({ queueProvider, jobType: 'scan', executor });
const worker = new WorkerMonitorDecorator(rawWorker);
worker.start();

// 5. Start Orphan Workspace Reaper Scheduler
const reaperScheduler = new SandboxReaperScheduler({ 
  intervalMs: env.SANDBOX_REAPER_INTERVAL_MS,
  workspaceRoot: env.SANDBOX_WORKSPACE_ROOT 
});
reaperScheduler.start();

console.log(`✅ Worker listening on queue 'scan' (Concurrency: ${env.WORKER_CONCURRENCY})`);
console.log(`✅ SandboxReaperScheduler started.`);

// 6. Worker Health Probes
const http = require('http');
const WORKER_HEALTH_PORT = env.WORKER_HEALTH_PORT;
let isShuttingDown = false;
let shutdownPromise = null;

const healthServer = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health/liveness') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
  } else if (req.method === 'GET' && req.url === '/health/readiness') {
    if (isShuttingDown) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'not_ready' }));
      return;
    }
    
    // Evaluate Queue Backpressure
    const threshold = env.READINESS_QUEUE_THRESHOLD;
    if (threshold > 0) {
      const stats = await queueProvider.getStats();
      if (stats.queued >= threshold) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'not_ready' }));
        return;
      }
    }
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ready' }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

healthServer.listen(WORKER_HEALTH_PORT, () => {
  console.log(`✅ Worker Health Probes listening on port ${WORKER_HEALTH_PORT}`);
});

// Graceful shutdown

const performShutdown = async (reason) => {
  console.log(`\n[worker.js] ${reason} received. Initiating graceful shutdown...`);
  isShuttingDown = true;
  
  // 1. Stop accepting new jobs
  console.log('Stopping queue provider...');
  await queueProvider.close();
  
  // 2. Stop reaper so it doesn't accidentally reap while draining
  reaperScheduler.stop();
  
  // 3. Drain active jobs up to timeout
  const SHUTDOWN_TIMEOUT_MS = env.SHUTDOWN_TIMEOUT_MS;
  const startWait = Date.now();
  let activeJobs = worker.getActiveJobCount();
  
  console.log(`Active jobs at shutdown: ${activeJobs}`);
  
  while (activeJobs > 0 && (Date.now() - startWait) < SHUTDOWN_TIMEOUT_MS) {
    await new Promise(r => setTimeout(r, 1000));
    activeJobs = worker.getActiveJobCount();
    console.log(`Waiting for ${activeJobs} active job(s) to finish...`);
  }
  
  // 4. Cancel remaining jobs if timeout reached
  if (activeJobs > 0) {
    console.warn(`\nShutdown timeout (${SHUTDOWN_TIMEOUT_MS}ms) reached. Cancelling ${activeJobs} remaining job(s)...`);
    worker.cancelAllActiveJobs('SHUTDOWN_TIMEOUT');
    
    // Give SandboxLifecycleManager a short window to perform SIGTERM/SIGKILL cleanup
    await new Promise(r => setTimeout(r, 2000));
  } else {
    console.log('All jobs drained successfully.');
  }

  // 5. Stop Observability and Persistence
  console.log('Stopping observability and persistence components...');
  healthServer.close();
  worker.stop();
  sandboxAuditLogger.stop();
  sandboxMetrics.stop();
  monitoringService.stop();
  eventLogger.stop();
  eventPersister.stop();
  jobStatePersister.stop();
  
  console.log('Graceful shutdown completed.');
  process.exit(0);
};

const shutdown = (reason) => {
  if (shutdownPromise) return shutdownPromise;
  shutdownPromise = performShutdown(reason).catch(err => {
    console.error('Error during shutdown:', err);
    process.exit(1);
  });
  return shutdownPromise;
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
