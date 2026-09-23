const { queueService } = require('../queue/QueueService');
const unitOfWork = require('../persistence/unitOfWorkInstance');
const { defaultEventBus } = require('../events/LocalEventBus');
const { monitoringService } = require('./MonitoringService');
const { sandboxMetrics } = require('../sandbox/utils/SandboxMetrics');
const HealthResponse = require('./models/HealthResponse');

/**
 * HealthCheckService
 * Aggregates health from decoupled system components.
 */
class HealthCheckService {
  async getSystemHealth() {
    const queueHealth = await this._getQueueHealth();
    const repositoryHealth = await this._getRepositoryHealth();
    const eventBusHealth = this._getEventBusHealth();
    const workerHealth = this._getWorkerHealth();
    const sandboxHealth = this._getSandboxHealth();

    const status = [queueHealth.status, repositoryHealth.status, eventBusHealth.status, workerHealth.status, sandboxHealth.status]
      .some(s => s === 'Unavailable') ? 'Unavailable'
      : [queueHealth.status, repositoryHealth.status, eventBusHealth.status, workerHealth.status, sandboxHealth.status]
        .some(s => s === 'Degraded') ? 'Degraded' : 'Healthy';

    return new HealthResponse({
      status,
      components: {
        queue: queueHealth,
        persistence: repositoryHealth,
        eventBus: eventBusHealth,
        workers: workerHealth,
        sandbox: sandboxHealth
      }
    });
  }

  async _getQueueHealth() {
    try {
      if (queueService.queues.size === 0) return { status: 'Healthy', details: 'No active queues' };
      
      let allHealthy = true;
      for (const [name, queue] of queueService.queues.entries()) {
        if (queue.client && queue.client.status !== 'ready') {
          allHealthy = false;
        }
      }
      return { status: allHealthy ? 'Healthy' : 'Degraded', activeQueues: queueService.queues.size };
    } catch (err) {
      return { status: 'Unavailable', error: err.message };
    }
  }

  async _getRepositoryHealth() {
    try {
      const jobHealth = await unitOfWork.scanJobs.checkHealth();
      const eventHealth = await unitOfWork.events.checkHealth();
      const resultHealth = await unitOfWork.scanResults.checkHealth();

      const statuses = [jobHealth, eventHealth, resultHealth];
      const status = statuses.some(s => s.includes('Disconnected') || s.includes('Unhealthy')) 
        ? 'Unavailable' 
        : statuses.some(s => s.includes('Degraded')) ? 'Degraded' : 'Healthy';

      return { status, details: { scanJobs: jobHealth, events: eventHealth, scanResults: resultHealth } };
    } catch (err) {
      return { status: 'Unavailable', error: err.message };
    }
  }

  _getEventBusHealth() {
    try {
      const metrics = defaultEventBus.getMetrics();
      // If subscriber failures are high, event bus is degraded
      if (metrics.subscriberFailures > 100 || metrics.droppedEvents > 100) {
        return { status: 'Degraded', metrics };
      }
      return { status: 'Healthy', metrics };
    } catch (err) {
      return { status: 'Unavailable', error: err.message };
    }
  }

  _getWorkerHealth() {
    try {
      const metrics = monitoringService.getWorkerMetrics();
      if (metrics.totalWorkers === 0) {
        return { status: 'Healthy', details: 'No workers registered' };
      }
      const deadWorkers = metrics.workers.filter(w => w.status === 'dead').length;
      if (deadWorkers === metrics.totalWorkers) {
        return { status: 'Unavailable', details: 'All workers dead' };
      }
      if (deadWorkers > 0) {
        return { status: 'Degraded', details: `${deadWorkers} dead workers` };
      }
      return { status: 'Healthy', activeWorkers: metrics.totalWorkers };
    } catch (err) {
      return { status: 'Unavailable', error: err.message };
    }
  }

  _getSandboxHealth() {
    try {
      if (!sandboxMetrics) {
        return { status: 'Degraded', details: 'SandboxMetrics unavailable' };
      }
      
      const metrics = sandboxMetrics.getMetrics();
      const isDegraded = metrics.failures > metrics.completions && metrics.starts > 10;
      
      return {
        status: isDegraded ? 'Degraded' : 'Healthy',
        metrics
      };
    } catch (err) {
      return { status: 'Unavailable', error: err.message };
    }
  }
}

const healthCheckService = new HealthCheckService();

module.exports = { HealthCheckService, healthCheckService };
