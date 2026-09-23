const fs = require('fs');
const path = require('path');
const os = require('os');
const { defaultEventBus } = require('./src/events/LocalEventBus');
const { JOB_EVENTS, jobEvents } = require('./src/events/JobEvents');
const JsonEventRepository = require('./src/persistence/providers/json/JsonEventRepository');
const EventPersister = require('./src/events/EventPersister');
const { ScanJob } = require('./src/jobs/ScanJob');

async function runTests() {
  console.log('--- Running Event Persistence Tests ---');

  const testDbPath = path.join(os.tmpdir(), `test-events-${Date.now()}.json`);
  const repo = new JsonEventRepository(testDbPath);
  const persister = new EventPersister(repo);

  try {
    persister.start();

    const job = new ScanJob({ repository: 'https://github.com/test/test' });
    
    // Trigger some events
    console.log('Emitting events...');
    jobEvents.emitCreated(job);
    
    // Simulate some work then emit completed
    job.transitionTo('RUNNING');
    job.transitionTo('COMPLETED');
    // Note: transitionTo automatically calls jobEvents.emitCompleted if status changes.
    // wait a tiny bit for async event bus to process
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify
    const events = await repo.getEventsForJob(job.id);
    
    // We expect at least JOB_CREATED and JOB_COMPLETED
    const hasCreated = events.some(e => e.eventType === JOB_EVENTS.JOB_CREATED);
    const hasCompleted = events.some(e => e.eventType === JOB_EVENTS.JOB_COMPLETED);

    if (!hasCreated) throw new Error('JOB_CREATED event not persisted');
    if (!hasCompleted) throw new Error('JOB_COMPLETED event not persisted');

    console.log(`  ✓ Persisted ${events.length} events for job successfully`);
    console.log('\nAll Event Persistence Tests Passed! ✓');
  } finally {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  }
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
