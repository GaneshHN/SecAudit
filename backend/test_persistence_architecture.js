const fs = require('fs');
const path = require('path');
const os = require('os');
const { JsonScanJobRepository, OptimisticLockingError } = require('./src/persistence/providers/json/JsonScanJobRepository');
const { ScanJob } = require('./src/jobs/ScanJob');

async function runTests() {
  console.log('--- Running Persistence Architecture Tests ---');

  const testDbPath = path.join(os.tmpdir(), `test-jobs-${Date.now()}.json`);
  const repo = new JsonScanJobRepository(testDbPath);

  try {
    // 1. Basic CRUD
    console.log('Test 1: Basic Save and Retrieve');
    const job = new ScanJob({ repository: 'https://github.com/test/test' });
    await repo.save(job);
    
    const fetched = await repo.getById(job.id);
    if (!fetched) throw new Error('Failed to retrieve job');
    if (fetched.version !== 1) throw new Error(`Expected version 1, got ${fetched.version}`);
    console.log('  ✓ Basic CRUD passed');

    // 2. Optimistic Locking (Success)
    console.log('Test 2: Optimistic Locking - Sequential updates');
    fetched.priorityName = 'High';
    await repo.save(fetched);
    
    const fetched2 = await repo.getById(job.id);
    if (fetched2.version !== 2) throw new Error(`Expected version 2, got ${fetched2.version}`);
    console.log('  ✓ Sequential updates passed');

    // 3. Optimistic Locking (Failure on concurrent overwrite)
    console.log('Test 3: Optimistic Locking - Conflict detection');
    // Simulate concurrent worker loading old version
    const worker1Job = await repo.getById(job.id);
    const worker2Job = await repo.getById(job.id);

    worker1Job.status = 'RUNNING';
    await repo.save(worker1Job); // Should succeed, version becomes 3

    worker2Job.status = 'COMPLETED'; // Still has version 2
    let conflictDetected = false;
    try {
      await repo.save(worker2Job); // Should throw
    } catch (err) {
      if (err instanceof OptimisticLockingError) {
        conflictDetected = true;
      } else {
        throw err;
      }
    }

    if (!conflictDetected) throw new Error('Optimistic Locking failed to prevent concurrent overwrite');
    console.log('  ✓ Conflict detection passed');

    // 4. Querying
    console.log('Test 4: Repository Querying');
    const job2 = new ScanJob({ repository: 'https://github.com/another/one', status: 'FAILED' });
    await repo.save(job2);

    const failedJobs = await repo.query({ status: 'FAILED' });
    if (failedJobs.length !== 1 || failedJobs[0].id !== job2.id) {
      throw new Error('Querying by status failed');
    }
    console.log('  ✓ Querying passed');

    console.log('\nAll Persistence Architecture Tests Passed! ✓');
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
