const assert = require('assert');
const { ScanJob } = require('./src/jobs/ScanJob');
const { JOB_STATES } = require('./src/jobs/ScanJobStateMachine');
const { jobEvents } = require('./src/events/JobEvents');
const InMemoryQueueProvider = require('./src/queue/InMemoryQueueProvider');
const PrioritySchedulingStrategy = require('./src/jobs/PrioritySchedulingStrategy');
const { JobPriority } = require('./src/jobs/JobPriority');

async function testScheduling() {
  console.log('🧪 Starting Queue Scheduling Tests...\n');

  // Test 1: Priority Ordering
  console.log('Test 1: Priority Ordering (Critical > High > Normal > Low)');
  const provider1 = new InMemoryQueueProvider('sched-queue-1', { concurrency: 1 });
  
  // Pause processing to enqueue all jobs first
  provider1.isProcessing = false;
  
  const jobLow = await provider1.enqueue('test', new ScanJob({ priority: 'Low' }));
  const jobNormal = await provider1.enqueue('test', new ScanJob({ priority: 'Normal' }));
  const jobHigh = await provider1.enqueue('test', new ScanJob({ priority: 'High' }));
  const jobCritical = await provider1.enqueue('test', new ScanJob({ priority: 'Critical' }));

  const executionOrder = [];
  provider1.process('test', async (job) => {
    executionOrder.push(job.schedulingContext.basePriorityName);
    return { success: true };
  });

  await new Promise(resolve => setTimeout(resolve, 200));

  assert.deepStrictEqual(executionOrder, ['Critical', 'High', 'Normal', 'Low']);
  console.log('   ✅ Test 1 Passed: Jobs executed strictly by priority.\n');

  // Test 2: FIFO Ordering for Same Priority
  console.log('Test 2: FIFO Ordering within the Same Priority');
  const provider2 = new InMemoryQueueProvider('sched-queue-2', { concurrency: 1 });
  provider2.isProcessing = false;

  const jobN1 = await provider2.enqueue('test', new ScanJob({ priority: 'Normal' }));
  await new Promise(resolve => setTimeout(resolve, 10)); // Ensure timestamps are distinct
  const jobN2 = await provider2.enqueue('test', new ScanJob({ priority: 'Normal' }));
  await new Promise(resolve => setTimeout(resolve, 10));
  const jobN3 = await provider2.enqueue('test', new ScanJob({ priority: 'Normal' }));

  const fifoOrder = [];
  provider2.process('test', async (job) => {
    fifoOrder.push(job.id);
    return { success: true };
  });

  await new Promise(resolve => setTimeout(resolve, 200));

  assert.deepStrictEqual(fifoOrder, [jobN1.id, jobN2.id, jobN3.id]);
  console.log('   ✅ Test 2 Passed: Jobs executed FIFO when priorities are equal.\n');

  // Test 3: Starvation Prevention (Aging Mechanism)
  console.log('Test 3: Starvation Prevention / Aging');
  
  const strategy = new PrioritySchedulingStrategy({ agingIntervalMs: 50, agingFactor: 20 });
  const provider3 = new InMemoryQueueProvider('sched-queue-3', { concurrency: 1, schedulingStrategy: strategy, agingIntervalMs: 50 });
  
  provider3.isProcessing = false;

  // Enqueue a Low priority job
  const jobStarved = await provider3.enqueue('test', new ScanJob({ priority: 'Low' }));
  assert.strictEqual(jobStarved.schedulingContext.basePriorityName, 'Low');
  assert.strictEqual(jobStarved.schedulingContext.effectivePriorityWeight, JobPriority.LOW.weight);

  // Wait long enough for aging to occur (2 intervals)
  let starvationEventEmitted = false;
  let priorityChangedEventEmitted = false;
  
  jobEvents.once('QueueStarvationDetected', () => { starvationEventEmitted = true; });
  jobEvents.once('PriorityChanged', () => { priorityChangedEventEmitted = true; });

  await new Promise(resolve => setTimeout(resolve, 120));

  // The interval inside InMemoryQueueProvider should have fired and raised effective priority
  assert.ok(jobStarved.schedulingContext.effectivePriorityWeight > JobPriority.LOW.weight, 'Effective priority should increase');
  assert.strictEqual(starvationEventEmitted, true, 'QueueStarvationDetected event should be emitted');
  assert.strictEqual(priorityChangedEventEmitted, true, 'PriorityChanged event should be emitted');
  assert.ok(jobStarved.schedulingContext.history.length > 0, 'Scheduling history should record StarvationPrevention');
  
  provider3.close();
  console.log('   ✅ Test 3 Passed: Low priority jobs gain weight over time to prevent starvation.\n');

  // Test 4: Queue Metrics and JobDequeued Event
  console.log('Test 4: Queue Metrics & Dequeued Event');
  const provider4 = new InMemoryQueueProvider('sched-queue-4', { concurrency: 1 });
  
  let dequeuedEventReceived = false;
  jobEvents.once('JobDequeued', (data) => {
    dequeuedEventReceived = true;
    assert.ok(data.queueTimeMs >= 0);
  });

  provider4.process('test', async (job) => {
    await new Promise(r => setTimeout(r, 50));
    return { success: true };
  });

  const jobMetrics = await provider4.enqueue('test', new ScanJob({ priority: 'Normal' }));
  await new Promise(resolve => setTimeout(resolve, 150));

  const stats = await provider4.getStats();
  assert.strictEqual(dequeuedEventReceived, true);
  assert.ok(stats.avgWaitTimeMs >= 0);
  console.log('   ✅ Test 4 Passed: Queue metrics track wait time and JobDequeued is emitted.\n');

  console.log('🎉 ALL SCHEDULING TESTS PASSED!');
  process.exit(0);
}

testScheduling().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
