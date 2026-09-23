const { queueService } = require('./src/queue/QueueService');
const ScanWorker = require('./src/workers/ScanWorker');
const WorkerMonitorDecorator = require('./src/workers/WorkerMonitorDecorator');
const { monitoringService } = require('./src/monitoring/MonitoringService');
const { eventLogger } = require('./src/logging/EventLogger');
const unitOfWork = require('./src/persistence/unitOfWorkInstance');
const JobStatePersister = require('./src/persistence/JobStatePersister');

async function runConcurrencyTest() {
  console.log('🧪 Starting Concurrency Validation...\n');

  eventLogger.start();
  monitoringService.start();
  
  const jobStatePersister = new JobStatePersister(unitOfWork);
  jobStatePersister.start();

  const queueProvider = queueService.getQueue('scan-queue', { concurrency: 5 });

  const rawWorker = new ScanWorker({ queueProvider });
  // Mock executor to finish quickly
  rawWorker.executor = {
    execute: async (context) => {
      await new Promise(resolve => setTimeout(resolve, 50)); // 50ms processing
      return { totalIssues: 0, score: 'A' };
    }
  };

  const worker = new WorkerMonitorDecorator(rawWorker);
  worker.start();

  const JOB_COUNT = 25;
  console.log(`[1] Submitting ${JOB_COUNT} Scan Jobs concurrently...`);
  
  const enqueuePromises = [];
  for (let i = 0; i < JOB_COUNT; i++) {
    enqueuePromises.push(queueProvider.enqueue('scan', {
      repository: `test-repo-${i}`,
      branch: 'main',
      userId: null
    }));
  }

  const jobs = await Promise.all(enqueuePromises);
  console.log(`✅ ${jobs.length} Jobs Enqueued.`);

  console.log('[2] Waiting for Workers to process queue...');
  let completed = 0;
  
  for (let i = 0; i < 20; i++) {
    const stats = await queueProvider.getStats();
    completed = stats.completed;
    if (completed === JOB_COUNT) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  if (completed !== JOB_COUNT) {
    throw new Error(`Only ${completed}/${JOB_COUNT} completed in time.`);
  }

  console.log(`✅ All ${completed} Jobs Processed.`);
  
  // Verify Database
  console.log('[3] Verifying Persistence under load...');
  let foundInDb = 0;
  for (const job of jobs) {
    const state = await unitOfWork.scanJobs.getById(job.id);
    if (state && state.status === 'COMPLETED') foundInDb++;
  }
  
  if (foundInDb !== JOB_COUNT) {
    throw new Error(`Database inconsistency. Only ${foundInDb}/${JOB_COUNT} marked COMPLETED.`);
  }
  console.log(`✅ Database consistency verified.`);

  console.log('\n🎉 Concurrency Validation Passed!');
  process.exit(0);
}

runConcurrencyTest().catch(err => {
  console.error('\n❌ Concurrency Test failed:', err);
  process.exit(1);
});
