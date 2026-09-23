const assert = require('assert');
const { LocalEventBus } = require('./src/events/LocalEventBus');
const BaseEvent = require('./src/events/BaseEvent');
const ISubscriber = require('./src/events/ISubscriber');
const { EventCategory } = require('./src/events/EventCategory');
const { jobEvents, JOB_EVENTS } = require('./src/events/JobEvents');

async function testEventBus() {
  console.log('🧪 Starting Event Bus & Domain Event Tests...\n');

  // Test 1: Publish & Subscribe
  console.log('Test 1: Publish and Subscribe Basic Event');
  const bus1 = new LocalEventBus();
  
  let receivedEvent = null;
  bus1.subscribe('TestEvent', (event) => {
    receivedEvent = event;
  });

  const evt1 = new BaseEvent({ eventType: 'TestEvent', payload: { message: 'Hello' } });
  const published = await bus1.publish(evt1);
  assert.strictEqual(published, true);
  
  // Wait for setImmediate
  await new Promise(r => setImmediate(r));
  
  assert.ok(receivedEvent !== null);
  assert.strictEqual(receivedEvent.payload.message, 'Hello');
  assert.strictEqual(receivedEvent.category, EventCategory.SYSTEM);
  console.log('   ✅ Test 1 Passed: Event published and received asynchronously.\n');

  // Test 2: Middleware execution
  console.log('Test 2: Event Middleware (Logging & Filtering)');
  const bus2 = new LocalEventBus();
  
  // Middleware 1: Appends metadata
  bus2.use(async (event) => {
    event.metadata.processed = true;
    return event;
  });

  // Middleware 2: Filters out events if they lack a correlationId
  bus2.use(async (event) => {
    if (!event.correlationId) return null; // Drop
    return event;
  });

  let receivedEvent2 = null;
  bus2.subscribe('TestMiddleware', (event) => {
    receivedEvent2 = event;
  });

  // This one should be dropped
  await bus2.publish(new BaseEvent({ eventType: 'TestMiddleware' }));
  
  // This one should pass
  await bus2.publish(new BaseEvent({ eventType: 'TestMiddleware', correlationId: 'trace-123' }));

  await new Promise(r => setImmediate(r));

  assert.ok(receivedEvent2 !== null);
  assert.strictEqual(receivedEvent2.correlationId, 'trace-123');
  assert.strictEqual(receivedEvent2.metadata.processed, true);
  
  const metrics = bus2.getMetrics();
  assert.strictEqual(metrics.publishedEvents, 2);
  assert.strictEqual(metrics.droppedEvents, 1);
  assert.strictEqual(metrics.processedEvents, 1);
  console.log('   ✅ Test 2 Passed: Middlewares correctly mutate and filter events.\n');

  // Test 3: Subscriber Isolation and Error Handling
  console.log('Test 3: Subscriber Failure Isolation');
  const bus3 = new LocalEventBus();
  
  let successCount = 0;
  
  bus3.subscribe('CrashEvent', (event) => {
    throw new Error('Subscriber crashed synchronously');
  });

  bus3.subscribe('CrashEvent', async (event) => {
    throw new Error('Subscriber crashed asynchronously');
  });

  bus3.subscribe('CrashEvent', (event) => {
    successCount++; // This should still run
  });

  await bus3.publish(new BaseEvent({ eventType: 'CrashEvent' }));
  
  await new Promise(r => setImmediate(r));
  // Allow async error rejection to tick
  await new Promise(r => setTimeout(r, 10));

  assert.strictEqual(successCount, 1);
  const metrics3 = bus3.getMetrics();
  assert.strictEqual(metrics3.subscriberFailures, 2);
  console.log('   ✅ Test 3 Passed: Crashing subscribers do not affect other subscribers or publishers.\n');

  // Test 4: JobEvents Legacy Proxy Refactor
  console.log('Test 4: JobEvents Proxy Validation');
  
  let proxyEvent = null;
  // Subscribe directly to the central LocalEventBus that JobEvents uses under the hood
  const { defaultEventBus } = require('./src/events/LocalEventBus');
  
  defaultEventBus.subscribe(JOB_EVENTS.JOB_CREATED, (event) => {
    proxyEvent = event;
  });

  // Existing tests or code calling the old method
  jobEvents.emitCreated({ id: 'job_xyz', metadata: { correlationId: 'trace-xyz' } });

  await new Promise(r => setImmediate(r));

  assert.ok(proxyEvent !== null);
  assert.ok(proxyEvent instanceof BaseEvent);
  assert.strictEqual(proxyEvent.jobId, 'job_xyz');
  assert.strictEqual(proxyEvent.correlationId, 'trace-xyz');
  assert.strictEqual(proxyEvent.sourceComponent, 'JobEventsAdapter');
  assert.strictEqual(proxyEvent.category, EventCategory.JOB);
  console.log('   ✅ Test 4 Passed: Legacy JobEventEmitter successfully proxies to LocalEventBus as Domain Events.\n');

  console.log('🎉 ALL EVENT BUS TESTS PASSED!');
  process.exit(0);
}

testEventBus().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
