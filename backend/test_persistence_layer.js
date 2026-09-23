const path = require('path');
const os = require('os');
const { ScanJob } = require('./src/jobs/ScanJob');
const BaseEvent = require('./src/events/BaseEvent');
const RepositoryFactory = require('./src/persistence/factory/RepositoryFactory');
const { OptimisticLockException, EntityNotFoundException } = require('./src/persistence/exceptions/RepositoryExceptions');
const { RepositoryHealthState } = require('./src/persistence/interfaces/IRepositoryHealth');
const DataRetentionPolicy = require('./src/persistence/DataRetentionPolicy');
const { EventCategory } = require('./src/events/EventCategory');

async function testPersistenceLayer() {
  console.log('🧪 Testing Task 12: Persistence Layer & Repository Abstraction...\n');

  // 1. Create Unit of Work via Factory (uses JSON by default in this environment)
  const unitOfWork = RepositoryFactory.createUnitOfWork({ type: 'json' });

  // Verify health checks
  const jobRepoHealth = await unitOfWork.scanJobs.checkHealth();
  console.log(`✅ Job Repository Health: ${jobRepoHealth}`);
  
  // 2. Test Job Saving and Optimistic Locking
  console.log('\n--- Testing Optimistic Locking ---');
  const job = new ScanJob({ repository: 'https://github.com/test/repo', priority: 'High' });
  
  await unitOfWork.scanJobs.save(job);
  console.log(`✅ Saved Job ID: ${job.id} with version: ${job.version}`);

  const fetchedJob = await unitOfWork.scanJobs.getById(job.id);
  
  // Concurrent update simulation
  const concurrentJob1 = ScanJob.fromJSON(fetchedJob.toJSON());
  const concurrentJob2 = ScanJob.fromJSON(fetchedJob.toJSON());

  concurrentJob1.progressPercentage = 50;
  await unitOfWork.scanJobs.save(concurrentJob1);
  console.log(`✅ Updated Job 1 successfully, new version: ${concurrentJob1.version}`);

  try {
    concurrentJob2.progressPercentage = 100;
    await unitOfWork.scanJobs.save(concurrentJob2);
    console.error('❌ Optimistic Locking failed to prevent concurrent update!');
    process.exit(1);
  } catch (err) {
    if (err instanceof OptimisticLockException) {
      console.log(`✅ OptimisticLockException correctly thrown: ${err.message}`);
    } else {
      console.error('❌ Unexpected exception type thrown for optimistic locking:', err);
      process.exit(1);
    }
  }

  // 3. Test Event Persistence
  console.log('\n--- Testing Event Persistence ---');
  const testEvent = new BaseEvent({
    eventType: 'TestEvent',
    category: EventCategory.SYSTEM,
    jobId: job.id,
    payload: { message: 'Testing event persistence' }
  });
  
  await unitOfWork.events.saveEvent(testEvent);
  const fetchedEvents = await unitOfWork.events.getEventsForJob(job.id);
  // Need to handle both the generated persistence events and the explicit testEvent
  const retrievedTestEvent = fetchedEvents.find(e => e.eventId === testEvent.eventId);
  if (retrievedTestEvent) {
    console.log(`✅ Event successfully persisted and retrieved for Job ID: ${job.id}`);
  } else {
    console.error('❌ Failed to retrieve persisted event');
  }

  // 4. Test Scan Result Persistence
  console.log('\n--- Testing Result Persistence ---');
  const dummyResult = { vulnerabilities: 5, severity: 'High' };
  await unitOfWork.scanResults.save(job.id, dummyResult);
  const fetchedResult = await unitOfWork.scanResults.getByJobId(job.id);
  if (fetchedResult && fetchedResult.vulnerabilities === 5) {
    console.log(`✅ Scan Result successfully persisted and retrieved for Job ID: ${job.id}`);
  } else {
    console.error('❌ Failed to retrieve persisted result');
  }

  // 5. Test Soft Deletes and Retention Policy
  console.log('\n--- Testing Soft Deletes & Retention ---');
  // Make the job look old
  job.status = 'COMPLETED';
  job.completedTime = new Date(Date.now() - (40 * 24 * 60 * 60 * 1000)).toISOString(); // 40 days old
  
  // Re-fetch latest version to apply update
  const latestJob = await unitOfWork.scanJobs.getById(job.id);
  latestJob.status = 'COMPLETED';
  latestJob.completedTime = job.completedTime;
  await unitOfWork.scanJobs.save(latestJob);

  const retentionPolicy = new DataRetentionPolicy(unitOfWork, { retentionDays: 30 });
  const deletedCount = await retentionPolicy.cleanupExpiredData();
  
  console.log(`✅ Retention Policy executed. Deleted ${deletedCount} jobs.`);

  const softDeletedJob = await unitOfWork.scanJobs.getById(job.id);
  if (softDeletedJob === null) {
     console.log(`✅ Soft delete verified: getById returns null for deleted job.`);
  } else {
     console.error('❌ Soft delete failed: job still returned by getById.');
     process.exit(1);
  }

  try {
     await unitOfWork.scanResults.getByJobId(job.id);
     console.error('❌ Soft delete failed for scan results.');
     process.exit(1);
  } catch (err) {
     if (err instanceof EntityNotFoundException) {
       console.log(`✅ EntityNotFoundException thrown for soft-deleted result: ${err.message}`);
     }
  }

  console.log('\n🎉 Persistence Layer tests passed successfully!');
}

testPersistenceLayer().catch((err) => {
  console.error('\n❌ Unhandled exception during persistence tests:', err);
  process.exit(1);
});
