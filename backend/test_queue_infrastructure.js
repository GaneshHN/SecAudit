const assert = require('assert');
require('dotenv').config();
const { queueService } = require('./src/queue/QueueService');
const { jobEvents, JOB_EVENTS } = require('./src/events/JobEvents');

async function testQueueInfrastructure() {
  console.log('🧪 Testing Queue Infrastructure...\n');

  const queueName = `scan-queue-test-${Date.now()}`;
  console.log(`Using isolated queue: ${queueName}`);
  const queue = queueService.getQueue(queueName, { concurrency: 2 });
  assert(queue, 'Queue instance should be created');
  assert(queue.constructor.name === 'BullMQQueueProvider', 'Must use BullMQQueueProvider, not InMemory');
  
  if (queue.queue && queue.queue.client) {
    queue.queue.client.then(client => {
      client.on('error', (err) => console.error('Redis Client Error:', err));
    }).catch(err => console.error('Redis Client Promise Error:', err));
  } else if (queue.queue) {
    queue.queue.on('error', (err) => console.error('BullMQ Queue Error:', err));
  }

  let jobQueuedFired = false;
  let jobStartedFired = false;
  let jobCompletedFired = false;

  jobEvents.on(JOB_EVENTS.JOB_CREATED, () => { jobQueuedFired = true; });
  jobEvents.on(JOB_EVENTS.JOB_STARTED, () => { jobStartedFired = true; });
  jobEvents.on(JOB_EVENTS.JOB_COMPLETED, () => { jobCompletedFired = true; });
  jobEvents.on(JOB_EVENTS.JOB_FAILED, (data) => console.error('[Job Failed]', data.error));

  // Test 1: Priority Enqueuing & Delayed Execution
  console.log('Test 1: Enqueuing Priority Jobs');
  const job1 = await queue.enqueue('scan', { target: 'low-priority' }, { priority: 10, jobId: 'job_low' });
  const job2 = await queue.enqueue('scan', { target: 'high-priority' }, { priority: 1, jobId: 'job_high' });

  assert.strictEqual(job1.id, 'job_low');
  assert.strictEqual(job2.id, 'job_high');
  assert(jobQueuedFired, 'job:queued event should be fired');
  console.log('   ✅ Enqueued 2 jobs with priority.\n');

  // Test 2: Worker Processing & Execution
  console.log('Test 2: Worker Processing');
  const executedOrder = [];

  queue.process('scan', async (jobData) => {
    console.log('[Worker] Executing job target:', jobData.target);
    executedOrder.push(jobData.target === 'low-priority' ? 'job_low' : 'job_high');
    await new Promise((resolve) => setTimeout(resolve, 50));
    return { status: 'success', target: jobData.target };
  }, { concurrency: 2 });

  // Deterministic polling for jobs to finish processing
  let beforeAssertStats;
  for (let i = 0; i < 60; i++) {
    beforeAssertStats = await queue.getStats();
    if (beforeAssertStats.completed === 2) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log('[Worker] Stats before assert:', beforeAssertStats);
  
  if (beforeAssertStats.failed > 0) {
    const failedJobs = await queue.queue.getFailed();
    for (const j of failedJobs) {
      console.log(`Job ${j.id} failed:`, j.failedReason);
    }
  }

  assert.strictEqual(executedOrder.length, 2);
  assert.strictEqual(executedOrder[0], 'job_high', 'High priority job should run first');
  assert(jobStartedFired, 'job:started event should be fired');
  assert(jobCompletedFired, 'job:completed event should be fired');

  console.log('   Execution order:', executedOrder);
  console.log('   ✅ Worker processing & priority sorting verified.\n');

  // Test 3: Queue Metrics & Stats
  console.log('Test 3: Queue Metrics & Utilization');
  const stats = await queue.getStats();
  console.log('   Stats:', JSON.stringify(stats));
  assert.strictEqual(stats.completed, 2);
  assert.strictEqual(stats.failed, 0);
  console.log('   ✅ Stats & metrics verified.\n');

  await queueService.closeAll();
  console.log('🎉 QUEUE INFRASTRUCTURE TESTS PASSED!');
}

testQueueInfrastructure().catch((err) => {
  console.error('❌ Queue test failed:', err);
  process.exit(1);
});
