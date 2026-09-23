const express = require('express');
const multer = require('multer');
const os = require('os');
const { handleAsyncScan } = require('../controllers/scanAsyncController');
const { authenticate } = require('../middlewares/authMiddleware');
const { rateLimit } = require('../middlewares/rateLimitMiddleware');
const { MAX_FILE_SIZE_BYTES } = require('../../../config/constants');

const router = express.Router();

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES || 500 * 1024 * 1024 },
});

// POST /api/v1/scan
router.post('/', authenticate, rateLimit({ maxRequests: 20, windowMs: 60000 }), upload.single('file'), handleAsyncScan);

// Multer error handler
router.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ success: false, error: { code: 'PAYLOAD_TOO_LARGE', message: 'File too large. Maximum size is 500MB.' }});
    }
    return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: err.message }});
  }
  if (err) {
    return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: err.message }});
  }
});

module.exports = router;
