const mongoose = require('mongoose');
const MongoUnitOfWork = require('./src/persistence/providers/mongo/MongoUnitOfWork');
const { ScanJob } = require('./src/jobs/ScanJob');

async function testMongo() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/secaudit_test';
  await mongoose.connect(uri);

  const uow = new MongoUnitOfWork();
  const job = new ScanJob({ repository: 'mongo-test', status: 'QUEUED' });

  console.log('Saving job...');
  await uow.scanJobs.save(job);
  
  console.log('Retrieving job...');
  const retrieved = await uow.scanJobs.getById(job.id);
  console.log('Retrieved:', retrieved.id, retrieved.status);

  console.log('Deleting job...');
  await uow.scanJobs.delete(job.id);

  console.log('Checking if deleted...');
  const finalCheck = await uow.scanJobs.getById(job.id);
  console.log('Final check:', finalCheck ? 'Failed (exists)' : 'Passed (null)');

  await mongoose.disconnect();
}

testMongo().catch(console.error);
