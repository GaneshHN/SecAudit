const path = require('path');
const assert = require('assert');

// Core Queue & Job imports
const IQueueProvider = require('./src/queue/IQueueProvider');
const InMemoryQueueProvider = require('./src/queue/InMemoryQueueProvider');
const { queueService } = require('./src/queue/QueueService');
const { ScanJob, JOB_PRIORITIES } = require('./src/jobs/ScanJob');
const { JOB_STATES, InvalidStateTransitionError, ScanJobStateMachine } = require('./src/jobs/ScanJobStateMachine');
const { JOB_EVENTS, jobEvents } = require('./src/events/JobEvents');
const IScanExecutor = require('./src/executors/IScanExecutor');
const LocalScanExecutor = require('./src/executors/LocalScanExecutor');
const ScanWorker = require('./src/workers/ScanWorker');

async function testRefinedQueueInfrastructure() {
  console.log('🧪 Starting Refined Queue Infrastructure Tests...\n');

  // Test 1: IQueueProvider Contract & Inheritance
  console.log('Test 1: IQueueProvider Interface Abstraction');
  const provider = queueService.getQueue('test-refined-queue', { concurrency: 2 });
  assert(provider instanceof IQueueProvider, 'Provider must implement IQueueProvider');
  console.log('   ✅ Test 1 Passed: Provider implements IQueueProvider interface contract.\n');

  // Test 2: Formal State Machine Transitions
  console.log('Test 2: ScanJob Formal State Machine');
  const jobStateTest = new ScanJob({ repository: 'https://github.com/example/repo' });
  assert.strictEqual(jobStateTest.status, JOB_STATES.QUEUED);

  jobStateTest.transitionTo(JOB_STATES.RUNNING);
  assert.strictEqual(jobStateTest.status, JOB_STATES.RUNNING);

  jobStateTest.transitionTo(JOB_STATES.COMPLETED);
  assert.strictEqual(jobStateTest.status, JOB_STATES.COMPLETED);

  // Assert invalid transition throws InvalidStateTransitionError
  assert.throws(() => {
    jobStateTest.transitionTo(JOB_STATES.RUNNING); // COMPLETED -> RUNNING is illegal!
  }, InvalidStateTransitionError);

  console.log('   ✅ Test 2 Passed: State Machine correctly blocks invalid state transitions.\n');

  // Test 3: Metadata & Job Priorities
  console.log('Test 3: Extended ScanJob Metadata & Priorities');
  const criticalJob = new ScanJob({ repository: 'critical-repo', priority: 'Critical' });
  const lowJob = new ScanJob({ repository: 'low-repo', priority: 'Low' });

  assert.strictEqual(criticalJob.priority, 100);
  assert.strictEqual(lowJob.priority, 1);
  assert.strictEqual(criticalJob.scannerVersion, '2.0.0');

  console.log('   ✅ Test 3 Passed: Priority mapping and extended metadata verified.\n');

  // Test 4: Lightweight Event System
  console.log('Test 4: Lightweight Event System Emitted Events');
  const eventsCaptured = [];
  jobEvents.on('JobCreated', () => eventsCaptured.push('JobCreated'));
  jobEvents.on('JobStarted', () => eventsCaptured.push('JobStarted'));
  jobEvents.on('ProgressUpdated', () => eventsCaptured.push('ProgressUpdated'));
  jobEvents.on('JobCompleted', () => eventsCaptured.push('JobCompleted'));

  const eventJob = new ScanJob({ repository: 'event-repo' });
  jobEvents.emitCreated(eventJob);
  eventJob.transitionTo(JOB_STATES.RUNNING);
  eventJob.updateProgress(new (require('./src/jobs/ProgressSnapshot'))({ progressPercentage: 50 }), require('./src/jobs/JobStage').JobStage.SCANNING);
  eventJob.transitionTo(JOB_STATES.COMPLETED);

  console.log('   Captured events:', eventsCaptured.join(', '));
  // Wait for EventBus setImmediate
  await new Promise(r => setImmediate(r));
  
  assert(eventsCaptured.includes('JobCreated'), 'Expected JobCreated to be emitted');
  assert(eventsCaptured.includes('JobStarted'));
  assert(eventsCaptured.includes('ProgressUpdated'));
  assert(eventsCaptured.includes('JobCompleted'));
  console.log('   ✅ Test 4 Passed: All required events emitted correctly.\n');

  // Test 5: ScanExecutor Layer & ScanWorker Decoupling
  console.log('Test 5: Worker & ScanExecutor Layer Integration');
  const { JobStage } = require('./src/jobs/JobStage');

  class DummyMockExecutor extends IScanExecutor {
    async execute(context) {
      context.reportProgress(JobStage.SCANNING);
      return { score: 100, totalIssues: 0, summary: { high: 0, medium: 0, low: 0 }, issues: [] };
    }
  }

  const mockExecutor = new DummyMockExecutor();
  const worker = new ScanWorker({
    workerId: 'test_worker_01',
    executor: mockExecutor,
    queueProvider: provider,
    jobType: 'scan_test',
  });

  const workerJob = new ScanJob({ repository: 'worker-test-repo' });
  await provider.enqueue('scan_test', workerJob);

  worker.start();

  await new Promise((resolve) => setTimeout(resolve, 150));

  assert.strictEqual(workerJob.status, JOB_STATES.COMPLETED);
  assert.strictEqual(workerJob.workerId, 'test_worker_01');
  assert.strictEqual(workerJob.progressPercentage, 100);
  assert.strictEqual(workerJob.currentStage.id, JobStage.COMPLETE.id);
  assert(workerJob.executionTime >= 0);

  console.log('   Job output:', JSON.stringify({
    status: workerJob.status,
    workerId: workerJob.workerId,
    stage: workerJob.currentStage.id,
    progress: workerJob.progressPercentage,
    queueTime: workerJob.queueTime,
    executionTime: workerJob.executionTime,
  }));
  console.log('   ✅ Test 5 Passed: ScanWorker & ScanExecutor layer decoupled & verified.\n');

  // Test 6: End-to-End Real Project Scan with LocalScanExecutor
  console.log('Test 6: Real Scan Execution via LocalScanExecutor');
  const realExecutor = new LocalScanExecutor();
  const testDirPath = path.join(__dirname, '..', 'test-vulnerable-project');
  const ExecutionContext = require('./src/executors/ExecutionContext');
  const CancellationToken = require('./src/executors/CancellationToken');
  const StaticProgressStrategy = require('./src/jobs/StaticProgressStrategy');

  const realJob = new ScanJob({ repository: testDirPath, priority: 'High' });
  const context = new ExecutionContext({
    job: realJob,
    repository: realJob.repository,
    progressReporter: () => {},
    cancellationToken: new CancellationToken(),
    progressStrategy: new StaticProgressStrategy()
  });

  const realResult = await realExecutor.execute(context);

  assert('score' in realResult);
  assert('totalIssues' in realResult);
  assert(realResult.totalIssues > 0);
  console.log(`   Scanned ${testDirPath} -> Score: ${realResult.score}, Issues: ${realResult.totalIssues}`);
  console.log('   ✅ Test 6 Passed: LocalScanExecutor integration verified.\n');

  await queueService.closeAll();
  console.log('🎉 ALL REFINED QUEUE INFRASTRUCTURE TESTS PASSED!');
}

testRefinedQueueInfrastructure().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
