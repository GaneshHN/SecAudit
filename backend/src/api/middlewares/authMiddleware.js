const apiMetrics = require('../apiMetrics');

/**
 * Validates authentication (mock implementation for Task 11)
 * Extracts userId and role from headers for simulation.
 */
function authenticate(req, res, next) {
  const userId = req.headers['x-user-id'] || 'anonymous';
  const role = req.headers['x-user-role'] || 'user';
  
  req.user = { userId, role };
  
  // Enforce auth if strict mode
  if (req.headers['x-require-auth'] === 'true' && userId === 'anonymous') {
    const routePath = req.originalUrl ? req.originalUrl.split('?')[0] : req.path;
    apiMetrics.recordRequest(routePath, 0, false, 'authorization');
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
  }

  next();
}

/**
 * Authorizes based on ownership or admin role.
 */
function authorizeJobAccess(req, res, next) {
  // We'll validate actual ownership in the controller once we fetch the job
  // Here we just ensure the user object exists
  if (!req.user) {
    const routePath = req.originalUrl ? req.originalUrl.split('?')[0] : req.path;
    apiMetrics.recordRequest(routePath, 0, false, 'authorization');
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required for job access' } });
  }
  next();
}

module.exports = { authenticate, authorizeJobAccess };
