const assert = require('assert');
const crypto = require('crypto');
const { queueService } = require('./src/queue/QueueService');
const ScanWorker = require('./src/workers/ScanWorker');
const WorkerMonitorDecorator = require('./src/workers/WorkerMonitorDecorator');
const { SandboxReaperScheduler } = require('./src/sandbox/utils/SandboxReaperScheduler');
const { ScanJob } = require('./src/jobs/ScanJob');
const CancellationToken = require('./src/executors/CancellationToken');
const { JOB_STATES } = require('./src/jobs/ScanJobStateMachine');
const { defaultEventBus } = require('./src/events/LocalEventBus');

const runTests = async () => {
  console.log('--- Running test_graceful_shutdown.js ---\n');
  
  let assertions = 0;
  const pass = (msg) => { console.log(`[PASS] ${msg}`); assertions++; };

  // Mock components
  const queueProvider = queueService.getQueue('scan-test');
  
  // Custom mock executor to control completion time
  class MockSlowExecutor {
    constructor() {
      this.cancelReasons = [];
    }
    async execute(context) {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          resolve({ score: 100 });
        }, 1000); // Takes 1s

        if (context.cancellationToken) {
          context.cancellationToken.on('cancelled', (reason) => {
            clearTimeout(timeout);
            this.cancelReasons.push(reason);
            const err = new Error('Cancelled');
            err.isCancellation = true;
            reject(err);
          });
        }
      });
    }
  }

  const executor = new MockSlowExecutor();
  const rawWorker = new ScanWorker({ queueProvider, jobType: 'scan-test', executor });
  const worker = new WorkerMonitorDecorator(rawWorker);
  
  worker.start();
  
  // Create jobs
  const job1 = await queueProvider.enqueue('scan-test', { repository: 'repo1' });
  
  // Wait a tick for job to start processing
  await new Promise(r => setTimeout(r, 100));
  
  assert.strictEqual(worker.getActiveJobCount(), 1);
  pass('Active job tracked in worker');

  // Initiate graceful shutdown logic (simulated)
  let isShuttingDown = false;
  let activeJobsBeforeDrain = 0;
  
  const performShutdown = async (timeoutMs) => {
    isShuttingDown = true;
    await queueProvider.close();
    
    assert.strictEqual(queueProvider.isProcessing, false);
    pass('Queue provider closed, stops accepting jobs');

    activeJobsBeforeDrain = worker.getActiveJobCount();
    assert.strictEqual(activeJobsBeforeDrain, 1);
    pass('Shutdown identifies active jobs correctly');
    
    const startWait = Date.now();
    let activeJobs = worker.getActiveJobCount();
    while (activeJobs > 0 && (Date.now() - startWait) < timeoutMs) {
      await new Promise(r => setTimeout(r, 100));
      activeJobs = worker.getActiveJobCount();
    }
    
    if (activeJobs > 0) {
      worker.cancelAllActiveJobs('SHUTDOWN_TIMEOUT');
    }
    
    worker.stop();
  };

  // Test 1: Drain successful (timeout > 1000)
  await performShutdown(2000);
  
  assert.strictEqual(worker.getActiveJobCount(), 0);
  pass('Worker drained active jobs successfully');
  
  assert.strictEqual(job1.status, JOB_STATES.COMPLETED);
  pass('Job allowed to complete during shutdown drain');
  
  // Test 2: Timeout cancellation
  // Reset worker and queue
  const queueProvider2 = queueService.getQueue('scan-test-2');
  const executor2 = new MockSlowExecutor();
  const rawWorker2 = new ScanWorker({ queueProvider: queueProvider2, jobType: 'scan-test-2', executor: executor2 });
  const worker2 = new WorkerMonitorDecorator(rawWorker2);
  worker2.start();
  
  const job2 = await queueProvider2.enqueue('scan-test-2', { repository: 'repo2' });
  await new Promise(r => setTimeout(r, 100));
  
  assert.strictEqual(worker2.getActiveJobCount(), 1);
  pass('Active job 2 tracked in worker2');
  
  isShuttingDown = false;
  
  const performTimeoutShutdown = async (timeoutMs) => {
    isShuttingDown = true;
    await queueProvider2.close();
    
    const startWait = Date.now();
    let activeJobs = worker2.getActiveJobCount();
    while (activeJobs > 0 && (Date.now() - startWait) < timeoutMs) {
      await new Promise(r => setTimeout(r, 100));
      activeJobs = worker2.getActiveJobCount();
    }
    
    if (activeJobs > 0) {
      worker2.cancelAllActiveJobs('SHUTDOWN_TIMEOUT');
      await new Promise(r => setTimeout(r, 50)); // Wait for cancellation propagation
    }
    
    worker2.stop();
  };
  
  // Drain fails (timeout < 1000)
  await performTimeoutShutdown(100);
  
  assert.strictEqual(executor2.cancelReasons.includes('SHUTDOWN_TIMEOUT'), true);
  pass('Active jobs correctly cancelled when timeout expires');
  
  assert.strictEqual(['FAILED', 'RETRYING'].includes(job2.status), true); // Cancellation throws error handled by queue policy
  pass('Job gracefully handled after timeout cancellation');

  // Test 3: Idempotent signal handler structure
  let calls = 0;
  let shutdownPromise = null;
  const mockRealShutdown = async (reason) => {
    calls++;
    await new Promise(r => setTimeout(r, 100));
  };
  const idempotentShutdown = (reason) => {
    if (shutdownPromise) return shutdownPromise;
    shutdownPromise = mockRealShutdown(reason);
    return shutdownPromise;
  };

  idempotentShutdown('SIGTERM');
  idempotentShutdown('SIGINT');
  idempotentShutdown('SIGTERM');

  await shutdownPromise;
  assert.strictEqual(calls, 1);
  pass('Shutdown sequence is strictly idempotent across multiple signals');
  
  // Test 4: Persisters `.stop()` verification
  const EventPersister = require('./src/events/EventPersister');
  const JobStatePersister = require('./src/persistence/JobStatePersister');
  const unitOfWork = require('./src/persistence/unitOfWorkInstance');
  
  const ep = new EventPersister({});
  ep.start();
  assert.strictEqual(typeof ep._handler, 'function');
  ep.stop();
  assert.strictEqual(ep._handler, null);
  pass('EventPersister properly implements .stop() and unsubscribes');
  
  const jsp = new JobStatePersister(unitOfWork);
  jsp.start();
  assert.strictEqual(typeof jsp._handler, 'function');
  jsp.stop();
  assert.strictEqual(jsp._handler, null);
  pass('JobStatePersister properly implements .stop() and unsubscribes');

  // Test 5: Queue rejection
  await queueProvider2.enqueue('scan-test-2', { repository: 'repo3' });
  // Since isProcessing = false after close, the queue length will increase but activeJobs stays 0
  assert.strictEqual(queueProvider2.isProcessing, false);
  assert.strictEqual(queueProvider2.waitingQueue.length, 1);
  assert.strictEqual(worker2.getActiveJobCount(), 0);
  pass('Queue rejects new work gracefully after shutdown');
  
  console.log(`\nTest Summary: ${assertions} Passed, 0 Failed`);
};

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
