const { queueService } = require('../queue/QueueService');
const PrioritySchedulingStrategy = require('../jobs/PrioritySchedulingStrategy');
const RetryPolicy = require('../jobs/RetryPolicy');
const { handleJobExecution } = require('./executors/jobExecutor');

const queueProvider = queueService.getQueue('scan', {
  concurrency: 4,
  schedulingStrategy: new PrioritySchedulingStrategy(),
  failurePolicy: new RetryPolicy()
});

// In production with a distributed Redis queue, the Vercel API MUST act ONLY as a producer.
// The external Linux Docker worker is solely responsible for consuming and executing jobs.
// We only register the local processor for development/test fallback scenarios.
const isProductionDistributed = process.env.NODE_ENV === 'production' && (process.env.REDIS_HOST || process.env.REDIS_URL);

if (!isProductionDistributed) {
  queueProvider.process('scan', async (job) => {
    return await handleJobExecution(job);
  });
}

module.exports = queueProvider;
