const express = require('express');
const { authenticate } = require('../middlewares/authMiddleware');
const { rateLimit } = require('../middlewares/rateLimitMiddleware');
const createJobController = require('../controllers/jobController');
const queueProvider = require('../queueInstance');
const unitOfWork = require('../../persistence/unitOfWorkInstance');

const router = express.Router();
const jobController = createJobController(queueProvider, unitOfWork);

// GET /api/v1/jobs
router.get('/', authenticate, rateLimit({ maxRequests: 200, windowMs: 60000 }), jobController.listJobs);

// GET /api/v1/jobs/:id
router.get('/:id', authenticate, rateLimit({ maxRequests: 300, windowMs: 60000 }), jobController.getJob);

// GET /api/v1/jobs/:id/status
router.get('/:id/status', authenticate, rateLimit({ maxRequests: 500, windowMs: 60000 }), jobController.getJobStatus);

// GET /api/v1/jobs/:id/result
router.get('/:id/result', authenticate, rateLimit({ maxRequests: 100, windowMs: 60000 }), jobController.getJobResult);

// DELETE /api/v1/jobs/:id
router.delete('/:id', authenticate, rateLimit({ maxRequests: 50, windowMs: 60000 }), jobController.deleteJob);

module.exports = router;
