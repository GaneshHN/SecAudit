const { queueService } = require('./src/queue/QueueService');
const ScanWorker = require('./src/workers/ScanWorker');
const WorkerMonitorDecorator = require('./src/workers/WorkerMonitorDecorator');
const { monitoringService } = require('./src/monitoring/MonitoringService');
const { eventLogger } = require('./src/logging/EventLogger');
const { defaultEventBus } = require('./src/events/LocalEventBus');
const unitOfWork = require('./src/persistence/unitOfWorkInstance');
const JobStatePersister = require('./src/persistence/JobStatePersister');

async function runFailureRecoveryTest() {
  console.log('🧪 Starting Failure Recovery Validation...\n');

  eventLogger.start();
  monitoringService.start();
  
  const jobStatePersister = new JobStatePersister(unitOfWork);
  jobStatePersister.start();

  const queueProvider = queueService.getQueue('scan-queue', {
    failurePolicy: {
      canRetry: (context) => context.currentAttempt < context.maxAttempts,
      // Minimal delay for tests
      getDelay: () => 100 
    }
  });

  const rawWorker = new ScanWorker({ queueProvider });
  // Force a validation failure by omitting the repository!
  rawWorker._validateJob = (job) => {
    // Override to throw a non-validation error so it becomes transient!
    throw new Error('Simulated Transient Failure');
  };

  const worker = new WorkerMonitorDecorator(rawWorker);
  worker.start();

  console.log('[1] Submitting Scan Job designed to fail...');
  const job = await queueProvider.enqueue('scan', {
    repository: 'fail-repo',
    branch: 'main',
    userId: null
  }, { attempts: 2 }); // maxRetries = 2

  const jobId = job.id;
  console.log(`✅ Job Enqueued: ${jobId} (Max Retries: 2)`);

  console.log('[2] Waiting for Worker to exhaust retries...');
  let jobState = null;
  for (let i = 0; i < 15; i++) {
    try {
      jobState = await unitOfWork.scanJobs.getById(jobId);
      if (jobState && jobState.status === 'FAILED') {
        break;
      }
    } catch (e) { }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  if (!jobState || jobState.status !== 'FAILED') {
    throw new Error(`Job did not reach FAILED state. Current status: ${jobState ? jobState.status : 'null'}`);
  }

  console.log(`✅ Job State in DB: Status=${jobState.status}, Retries=${jobState.retryCount}`);
  
  const queueStats = await queueProvider.getStats();
  if (queueStats.failed !== 1 || queueStats.dlqSize !== 1) {
    throw new Error(`Queue stats do not reflect failure. DLQ Size: ${queueStats.dlqSize}, Failed: ${queueStats.failed}`);
  }
  console.log(`✅ Job moved to Dead Letter Queue. DLQ Size: ${queueStats.dlqSize}`);

  console.log('\n🎉 Failure Recovery Validation Passed!');
  process.exit(0);
}

runFailureRecoveryTest().catch(err => {
  console.error('\n❌ Failure Recovery Test failed:', err);
  process.exit(1);
});
