const apiMetrics = require('../apiMetrics');
const { JOB_STATES } = require('../../jobs/ScanJobStateMachine');

/**
 * Validates jobId format
 */
function validateJobId(jobId) {
  if (!jobId || typeof jobId !== 'string') return false;
  // Accept standard format 'job_123456_abc' or similar
  return /^job_\d+_[a-z0-9]+$/i.test(jobId) || jobId.length > 5;
}

/**
 * Checks authorization
 */
function isAuthorized(req, job) {
  if (req.user.role === 'admin') return true;
  if (job.userId === 'anonymous') return true; // public job
  return job.userId === req.user.userId;
}

/**
 * Factory for creating the JobController bound to a QueueProvider and UnitOfWork
 */
module.exports = function createJobController(queueProvider, unitOfWork) {
  return {
    async listJobs(req, res) {
      const start = Date.now();
      try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const status = req.query.status;
        const priority = req.query.priority;

        let allJobs = await unitOfWork.scanJobs.query();
        
        // Filter by user if not admin
        if (req.user && req.user.role !== 'admin') {
           allJobs = allJobs.filter(j => j.userId === req.user.userId || j.userId === 'anonymous');
        }

        if (status) {
          allJobs = allJobs.filter(j => j.status.toLowerCase() === status.toLowerCase());
        }
        
        if (priority) {
          allJobs = allJobs.filter(j => j.priorityName.toLowerCase() === priority.toLowerCase());
        }

        // Sort by creation date descending
        allJobs.sort((a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime());

        const total = allJobs.length;
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        const paginated = allJobs.slice(startIndex, endIndex).map(j => j.toJSON());

        apiMetrics.recordRequest(req.originalUrl.split('?')[0], Date.now() - start, true);
        return res.status(200).json({ success: true, data: paginated, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } });
      } catch (err) {
        apiMetrics.recordRequest(req.originalUrl.split('?')[0], Date.now() - start, false);
        return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve jobs', details: err.message }});
      }
    },

    async getJob(req, res) {
      const start = Date.now();
      const jobId = req.params.id;

      if (!validateJobId(jobId)) {
        apiMetrics.recordRequest(req.originalUrl.split('?')[0], Date.now() - start, false, 'validation');
        return res.status(400).json({ success: false, error: { code: 'INVALID_JOB_ID', message: 'Job ID format is invalid' }});
      }

      const job = await unitOfWork.scanJobs.getById(jobId);
      if (!job) {
        apiMetrics.recordRequest(req.originalUrl.split('?')[0], Date.now() - start, false);
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Job ${jobId} not found` }});
      }

      if (!isAuthorized(req, job)) {
        apiMetrics.recordRequest(req.originalUrl.split('?')[0], Date.now() - start, false, 'authorization');
        return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to view this job' }});
      }

      apiMetrics.recordRequest(req.originalUrl.split('?')[0], Date.now() - start, true);
      return res.status(200).json({ success: true, data: job.toJSON() });
    },

    async getJobStatus(req, res) {
      const start = Date.now();
      const jobId = req.params.id;
      
      if (!jobId) {
        return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Missing job ID' }});
      }

      const job = await unitOfWork.scanJobs.getById(jobId);
      if (!job) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Job not found' }});
      }

      // Authorization Check
      if (job.userId !== req.user.userId && req.user.role !== 'admin') {
        apiMetrics.recordRequest(req.originalUrl.split('?')[0], Date.now() - start, false, 'authorization');
        return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' }});
      }

      apiMetrics.recordRequest(req.originalUrl.split('?')[0], Date.now() - start, true);
      return res.status(200).json({ success: true, data: {
        jobId: job.id,
        status: job.status,
        progress: job.progressPercentage,
        stage: job.currentStage,
        estimatedWaitTime: job.schedulingContext ? job.schedulingContext.queueTimeMs : 0,
        isDeadLetter: job.isDeadLetter
      }});
    },

    async getJobResult(req, res) {
      const start = Date.now();
      const jobId = req.params.id;
      
      if (!jobId) {
        return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Missing job ID' }});
      }

      const job = await unitOfWork.scanJobs.getById(jobId);
      if (!job) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Job not found' }});
      }

      // Authorization Check
      if (job.userId !== req.user.userId && req.user.role !== 'admin') {
        apiMetrics.recordRequest(req.originalUrl.split('?')[0], Date.now() - start, false, 'authorization');
        return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' }});
      }

      const result = await unitOfWork.scanResults.getByJobId(jobId);
      if (!result) {
        if (job.status === 'COMPLETED') {
           apiMetrics.recordRequest(req.originalUrl.split('?')[0], Date.now() - start, false, 'not_found');
           return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Result payload missing' }});
        }
        apiMetrics.recordRequest(req.originalUrl.split('?')[0], Date.now() - start, false, 'bad_request');
        return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Job has not completed yet' }});
      }

      apiMetrics.recordRequest(req.originalUrl.split('?')[0], Date.now() - start, true);
      return res.status(200).json({ success: true, data: result });
    },

    async deleteJob(req, res) {
      const start = Date.now();
      const jobId = req.params.id;
      
      const job = await unitOfWork.scanJobs.getById(jobId);
      if (!job) {
         apiMetrics.recordRequest(req.originalUrl.split('?')[0], Date.now() - start, false, 'not_found');
         return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Job ${jobId} not found` }});
      }
      
      // Only admins or owners can cancel/delete
      if (!isAuthorized(req, job)) {
         apiMetrics.recordRequest(req.originalUrl.split('?')[0], Date.now() - start, false, 'authorization');
         return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Unauthorized' }});
      }

      try {
        await queueProvider.removeJob(jobId);
        await unitOfWork.scanJobs.delete(jobId);
        await unitOfWork.commit();
        apiMetrics.recordRequest(req.originalUrl.split('?')[0], Date.now() - start, true);
        return res.status(200).json({ success: true, data: { message: `Job ${jobId} cancelled successfully` }});
      } catch (err) {
        apiMetrics.recordRequest(req.originalUrl.split('?')[0], Date.now() - start, false);
        return res.status(500).json({ success: false, error: { code: 'CANCELLATION_FAILED', message: 'Failed to cancel job', details: err.message }});
      }
    }
  };
};
