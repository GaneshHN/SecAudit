/**
 * Rate Limiting Middleware (Mock implementation for Task 11)
 * In production, this would use Redis or a similar store.
 */
const rateLimits = new Map();

function rateLimit(options = { maxRequests: 100, windowMs: 60000 }) {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const key = `${ip}_${req.route ? req.route.path : req.path}`;
    
    const now = Date.now();
    let record = rateLimits.get(key);
    
    if (!record) {
      record = { count: 1, resetTime: now + options.windowMs };
      rateLimits.set(key, record);
    } else {
      if (now > record.resetTime) {
        record.count = 1;
        record.resetTime = now + options.windowMs;
      } else {
        record.count++;
      }
    }
    
    res.setHeader('X-RateLimit-Limit', options.maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, options.maxRequests - record.count));
    res.setHeader('X-RateLimit-Reset', record.resetTime);
    
    if (record.count > options.maxRequests) {
      const apiMetrics = require('../apiMetrics');
      const routePath = req.originalUrl ? req.originalUrl.split('?')[0] : req.path;
      apiMetrics.recordRequest(routePath, 0, false, 'ratelimit');
      return res.status(429).json({ success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Rate limit exceeded. Try again later.' }});
    }
    
    next();
  };
}

module.exports = { rateLimit };
