const { monitoringService } = require('../../monitoring/MonitoringService');
const { healthCheckService } = require('../../monitoring/HealthCheckService');
const MonitoringSnapshot = require('../../monitoring/models/MonitoringSnapshot');

class MonitoringController {
  async getMetrics(req, res) {
    try {
      const snapshot = new MonitoringSnapshot({
        queue: monitoringService.getQueueMetrics(),
        scanner: monitoringService.getScannerMetrics(),
        worker: monitoringService.getWorkerMetrics(),
        repository: monitoringService.getRepositoryMetrics()
      });
      return res.success(snapshot.toJSON());
    } catch (error) {
      console.error('[MonitoringController] Error fetching metrics:', error);
      return res.error(500, 'INTERNAL_ERROR', 'Failed to fetch metrics');
    }
  }

  async getHealth(req, res) {
    try {
      const health = await healthCheckService.getSystemHealth();
      const statusCode = health.status === 'Healthy' ? 200 : (health.status === 'Degraded' ? 200 : 503);
      
      // We manually construct response to allow custom status code, 
      // but still conform to the API format.
      return res.status(statusCode).json({
        status: 'success',
        data: health
      });
    } catch (error) {
      console.error('[MonitoringController] Error fetching health:', error);
      return res.error(500, 'INTERNAL_ERROR', 'Failed to fetch system health');
    }
  }

  async getQueueStats(req, res) {
    try {
      return res.success(monitoringService.getQueueMetrics());
    } catch (error) {
      return res.error(500, 'INTERNAL_ERROR', 'Failed to fetch queue stats');
    }
  }

  async getWorkers(req, res) {
    try {
      return res.success(monitoringService.getWorkerMetrics());
    } catch (error) {
      return res.error(500, 'INTERNAL_ERROR', 'Failed to fetch worker stats');
    }
  }

  async getSystem(req, res) {
    try {
      // General system information plus health
      const health = await healthCheckService.getSystemHealth();
      const systemInfo = {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        nodeVersion: process.version,
        platform: process.platform,
        health
      };
      return res.success(systemInfo);
    } catch (error) {
      return res.error(500, 'INTERNAL_ERROR', 'Failed to fetch system info');
    }
  }
}

module.exports = new MonitoringController();
