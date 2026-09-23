const assert = require('assert');
const { ScanJob } = require('./src/jobs/ScanJob');
const { JOB_STATES } = require('./src/jobs/ScanJobStateMachine');
const { jobEvents } = require('./src/events/JobEvents');
const InMemoryQueueProvider = require('./src/queue/InMemoryQueueProvider');
const RetryPolicy = require('./src/jobs/RetryPolicy');
const NoRetryPolicy = require('./src/jobs/NoRetryPolicy');
const ExponentialBackoffStrategy = require('./src/jobs/ExponentialBackoffStrategy');

async function testRetryPolicy() {
  console.log('🧪 Starting Retry & Failure Policy Tests...\n');

  // Test 1: Non-Transient Errors immediately fail (No retry)
  console.log('Test 1: Non-Transient Error (Validation) Bypasses Retries');
  const provider = new InMemoryQueueProvider('retry-queue', { concurrency: 1 });
  
  const job1 = new ScanJob({ repository: 'repo1', maxRetries: 3 });
  await provider.enqueue('test', job1);
  
  let failedEmitted = false;
  jobEvents.once('JobFailed', () => { failedEmitted = true; });

  provider.process('test', async (job) => {
    const err = new Error('Validation Failed: Target invalid');
    err.isValidation = true;
    throw err;
  });

  await new Promise(resolve => setTimeout(resolve, 100));
  
  assert.strictEqual(job1.status, JOB_STATES.FAILED);
  assert.strictEqual(job1.retryContext.currentAttempt, 0); // No retries attempted
  assert.strictEqual(job1.isDeadLetter, true);
  assert.strictEqual(failedEmitted, true);
  console.log('   ✅ Test 1 Passed: Validation error caused immediate failure.\n');

  // Test 2: Transient Errors triggers retry with delay
  console.log('Test 2: Transient Error (Network) Triggers Retry');
  const provider2 = new InMemoryQueueProvider('retry-queue-2');
  const job2 = new ScanJob({ repository: 'repo2', maxRetries: 3 });
  
  // Custom backoff to make tests fast
  job2.retryContext.retryStrategy = new ExponentialBackoffStrategy(10, 50, 1, 0); 
  
  let retryScheduledEmitted = false;
  jobEvents.once('RetryScheduled', () => { retryScheduledEmitted = true; });

  let attemptCount = 0;
  provider2.process('test', async (job) => {
    attemptCount++;
    if (attemptCount === 1) {
      throw new Error('Network timeout');
    }
    return { success: true }; // Succeeds on second attempt
  });

  await provider2.enqueue('test', job2);
  
  await new Promise(resolve => setTimeout(resolve, 200));

  assert.strictEqual(job2.status, JOB_STATES.COMPLETED);
  assert.strictEqual(job2.retryContext.currentAttempt, 1);
  assert.strictEqual(job2.retryContext.history.length, 1);
  assert.strictEqual(job2.retryContext.history[0].failureCategory, 'Network');
  assert.strictEqual(retryScheduledEmitted, true);
  console.log('   ✅ Test 2 Passed: Transient error was retried and succeeded.\n');

  // Test 3: Exhausting Max Retries transitions to DLQ
  console.log('Test 3: Max Retries Exhaustion Triggers FAILED state and DLQ');
  const provider3 = new InMemoryQueueProvider('retry-queue-3');
  const job3 = new ScanJob({ repository: 'repo3', maxRetries: 2 });
  
  job3.retryContext.retryStrategy = new ExponentialBackoffStrategy(5, 10, 1, 0); 
  
  let retriesExhausted = false;
  jobEvents.once('RetriesExhausted', () => { retriesExhausted = true; });

  provider3.process('test', async (job) => {
    throw new Error('Internal Server Error');
  });

  await provider3.enqueue('test', job3);
  
  await new Promise(resolve => setTimeout(resolve, 300));

  assert.strictEqual(job3.status, JOB_STATES.FAILED);
  assert.strictEqual(job3.retryContext.currentAttempt, 2);
  assert.strictEqual(job3.isDeadLetter, true);
  assert.strictEqual(retriesExhausted, true);
  
  const stats = await provider3.getStats();
  assert.strictEqual(stats.dlqSize, 1);
  assert.strictEqual(stats.averageAttempts, 2);
  
  console.log('   ✅ Test 3 Passed: Job exhausted retries and moved to DLQ.\n');

  // Test 4: NoRetryPolicy integration
  console.log('Test 4: NoRetryPolicy Abstraction');
  const provider4 = new InMemoryQueueProvider('retry-queue-4', { failurePolicy: new NoRetryPolicy() });
  const job4 = new ScanJob({ repository: 'repo4', maxRetries: 5 });
  
  provider4.process('test', async (job) => {
    throw new Error('Network error'); // Transient, but policy says NO
  });

  await provider4.enqueue('test', job4);
  
  await new Promise(resolve => setTimeout(resolve, 100));

  assert.strictEqual(job4.status, JOB_STATES.FAILED);
  assert.strictEqual(job4.retryContext.currentAttempt, 0);
  console.log('   ✅ Test 4 Passed: NoRetryPolicy explicitly bypassed retries.\n');

  console.log('🎉 ALL RETRY & FAILURE POLICY TESTS PASSED!');
  process.exit(0);
}

testRetryPolicy().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
