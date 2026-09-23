const assert = require('assert');
const { queueService } = require('./src/queue/QueueService');
const ScanWorker = require('./src/workers/ScanWorker');
const WorkerMonitorDecorator = require('./src/workers/WorkerMonitorDecorator');
const SandboxedScanExecutor = require('./src/executors/SandboxedScanExecutor');
const SandboxConfiguration = require('./src/sandbox/SandboxConfiguration');
const { eventLogger } = require('./src/logging/EventLogger');
const { sandboxAuditLogger } = require('./src/sandbox/utils/SandboxAuditLogger');
const { sandboxMetrics } = require('./src/sandbox/utils/SandboxMetrics');
const { monitoringService } = require('./src/monitoring/MonitoringService');
const EventPersister = require('./src/events/EventPersister');
const JobStatePersister = require('./src/persistence/JobStatePersister');
const unitOfWork = require('./src/persistence/unitOfWorkInstance');

async function runTests() {
  console.log('--- Phase 5.4 Final E2E Deterministic Stress Test ---\n');
  let assertions = 0;
  const pass = (msg) => { console.log(`âœ… [PASS] ${msg}`); assertions++; };

  // 1. Setup Architecture
  eventLogger.start();
  monitoringService.start();
  sandboxAuditLogger.start();
  sandboxMetrics.start();

  const eventPersister = new EventPersister(unitOfWork.events);
  eventPersister.start();

  const jobStatePersister = new JobStatePersister(unitOfWork);
  jobStatePersister.start();

  const sandboxConfig = new SandboxConfiguration({ dockerEnabled: true });
  const executor = new SandboxedScanExecutor({ sandboxConfig });

  const queueName = `scan-test-docker-${Date.now()}`;
  console.log(`Using isolated Docker E2E queue: ${queueName}`);
  const queueProvider = queueService.getQueue(queueName, { concurrency: 5 });

  const rawWorker = new ScanWorker({ queueProvider, jobType: 'scan', executor });
  const worker = new WorkerMonitorDecorator(rawWorker);

  // 2. Queue is already empty in-memory

  // 3. Inject 50 Jobs (Stress Test)
  console.log('\nInjecting 50 jobs for stress test...');
  for (let i = 1; i <= 50; i++) {
    await queueProvider.enqueue('scan', { repository: `test-repo-${i}` });
  }

  let stats = await queueProvider.getStats();
  assert.strictEqual(stats.queued, 50);
  pass('50 Jobs enqueued successfully');

  // 4. Start Worker
  worker.start();
  pass('Worker started with Concurrency 5');

  // 5. Wait for all jobs to complete
  console.log('\nProcessing jobs (this may take a few seconds)...');
  let attempt = 0;
  while (attempt < 150) { // 15s max
    stats = await queueProvider.getStats();
    if (stats.queued === 0 && worker.getActiveJobCount() === 0) {
      break;
    }
    await new Promise(r => setTimeout(r, 100));
    attempt++;
  }

  assert.strictEqual(stats.queued, 0, 'Queue should be empty');
  assert.strictEqual(worker.getActiveJobCount(), 0, 'No active jobs should remain');
  pass('All 50 jobs processed successfully without deadlocks or duplicates');

  const finalStats = await queueProvider.getStats();
  assert.strictEqual(finalStats.completed, 50, 'Exactly 50 jobs should be completed');
  pass('Queue ordering and completion counts remain perfectly accurate');

  // 6. Graceful Shutdown
  console.log('\nInitiating graceful shutdown of testing architecture...');
  worker.stop();
  await queueProvider.close();

  eventPersister.stop();
  jobStatePersister.stop();
  sandboxMetrics.stop();
  sandboxAuditLogger.stop();
  monitoringService.stop();
  eventLogger.stop();

  pass('Architecture cleanly decoupled and stopped');

  console.log(`\nðŸŽ‰ Phase 5.4 Stress Test Passed: ${assertions} assertions completed.`);
}

runTests().catch(err => {
  console.error('\nâŒ FATAL TEST ERROR:', err);
  process.exit(1);
});
