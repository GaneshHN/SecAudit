/**
 * Standardizes API responses and catches asynchronous errors.
 */
function responseFormatter(req, res, next) {
  // Override res.json to wrap output
  const originalJson = res.json;
  
  res.success = function (data, meta = {}) {
    return originalJson.call(this, {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'req_' + Date.now(),
        ...meta
      }
    });
  };

  res.error = function (statusCode, code, message, details = {}) {
    return this.status(statusCode).json({
      success: false,
      error: {
        code,
        message,
        details
      }
    });
  };

  next();
}

module.exports = { responseFormatter };
