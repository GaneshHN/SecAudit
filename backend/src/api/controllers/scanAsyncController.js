const { ScanJob } = require('../../jobs/ScanJob');
const unitOfWork = require('../../persistence/unitOfWorkInstance');
const queueProvider = require('../queueInstance');
const apiMetrics = require('../apiMetrics');

async function handleAsyncScan(req, res) {
  const start = Date.now();
  try {
    const { repoUrl, priority } = req.body;
    
    // Minimal validation
    if (!repoUrl && !req.file) {
      apiMetrics.recordRequest(req.originalUrl.split('?')[0], Date.now() - start, false, 'validation');
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Must provide repoUrl or upload a zip file.' }});
    }

    const scanOptions = {
      repository: repoUrl || 'uploaded-file.zip',
      priority: priority || 'Normal',
      userId: req.user ? req.user.userId : 'anonymous',
      maxRetries: 3
    };

    const job = new ScanJob(scanOptions);
    
    // Save to persistence (Mongo)
    await unitOfWork.scanJobs.save(job);
    
    // Enqueue to Redis via QueueProvider
    // Using BullMQ queueProvider adapter configured via REDIS_URL
    await queueProvider.enqueue('scan', job.toJSON());

    apiMetrics.recordRequest(req.originalUrl.split('?')[0], Date.now() - start, true);
    
    return res.status(202).json({
      success: true,
      data: {
        jobId: job.id,
        message: 'Scan job accepted and queued for processing.'
      },
      meta: {
        requestId: req.headers['x-request-id'] || 'test-req-id'
      }
    });
  } catch (err) {
    console.error('Async Scan Error:', err);
    apiMetrics.recordRequest(req.originalUrl.split('?')[0], Date.now() - start, false);
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to start scan job', details: err.message }});
  }
}

module.exports = { handleAsyncScan };
