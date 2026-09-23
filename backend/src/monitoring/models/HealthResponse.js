/**
 * Standard Health Response Model
 * Ensures API endpoints and internal systems represent health homogeneously.
 */
class HealthResponse {
  constructor({ status, components, error, details }) {
    this.status = status; // 'Healthy', 'Degraded', 'Unavailable'
    this.timestamp = new Date().toISOString();
    this.components = components || {};
    this.error = error || null;
    this.details = details || null;
  }

  toJSON() {
    return {
      status: this.status,
      timestamp: this.timestamp,
      components: this.components,
      ...(this.error && { error: this.error }),
      ...(this.details && { details: this.details })
    };
  }
}

module.exports = HealthResponse;
