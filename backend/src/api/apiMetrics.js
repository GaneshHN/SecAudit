/**
 * API Metrics Tracker
 */
class ApiMetrics {
  constructor() {
    this.metrics = {
      requestsTotal: 0,
      requestsSuccess: 0,
      requestsFailed: 0,
      validationFailures: 0,
      authorizationFailures: 0,
      totalLatencyMs: 0,
      routeMetrics: {}
    };
  }

  recordRequest(route, latencyMs, isSuccess, errorType = null) {
    this.metrics.requestsTotal++;
    this.metrics.totalLatencyMs += latencyMs;
    
    if (isSuccess) {
      this.metrics.requestsSuccess++;
    } else {
      this.metrics.requestsFailed++;
      if (errorType === 'validation') this.metrics.validationFailures++;
      if (errorType === 'authorization') this.metrics.authorizationFailures++;
    }

    if (!this.metrics.routeMetrics[route]) {
      this.metrics.routeMetrics[route] = { total: 0, latencyMs: 0 };
    }
    this.metrics.routeMetrics[route].total++;
    this.metrics.routeMetrics[route].latencyMs += latencyMs;
  }

  getMetrics() {
    const avgLatency = this.metrics.requestsTotal > 0 
      ? (this.metrics.totalLatencyMs / this.metrics.requestsTotal).toFixed(2) 
      : 0;

    return {
      ...this.metrics,
      averageLatencyMs: parseFloat(avgLatency)
    };
  }
}

const apiMetrics = new ApiMetrics();

module.exports = apiMetrics;
