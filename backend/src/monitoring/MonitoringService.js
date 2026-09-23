const IMonitoringService = require('./interfaces/IMonitoringService');
const { defaultEventBus } = require('../events/LocalEventBus');

class MonitoringService extends IMonitoringService {
  constructor() {
    super();
    
    // In-memory aggregations
    this.queueMetrics = {
      queuedJobs: 0,
      runningJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      cancelledJobs: 0,
      retryingJobs: 0,
      dlqSize: 0,
      totalQueueTimeMs: 0,
      queueTimesCount: 0,
      maxQueueTimeMs: 0,
      throughput: {
        startTime: Date.now(),
        jobsCompletedInWindow: 0
      }
    };

    this.workerMetrics = new Map(); // workerId -> metadata

    this.scannerMetrics = {
      repositoriesScanned: 0,
      issuesFound: 0,
      severityDistribution: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
      totalScanDurationSecs: 0,
      scanCount: 0
    };

    this.repositoryMetrics = {
      readOperations: 0,
      writeOperations: 0,
      totalReadTimeMs: 0,
      totalWriteTimeMs: 0,
      optimisticLockFailures: 0
    };

    this._eventHandler = this._handleEvent.bind(this);
  }

  start() {
    // Subscribe to ALL events passively
    defaultEventBus.subscribe('*', this._eventHandler);
  }

  stop() {
    defaultEventBus.unsubscribe('*', this._eventHandler);
  }

  _handleEvent(event) {
    if (!event || !event.eventType) return;

    try {
      this._processQueueMetrics(event);
      this._processWorkerMetrics(event);
      this._processScannerMetrics(event);
      this._processRepositoryMetrics(event);
    } catch (err) {
      // Monitoring errors should never crash the system
      console.error('[MonitoringService] Error processing event:', err.message);
    }
  }

  _processQueueMetrics(event) {
    const type = event.eventType;
    if (type === 'JobCreated') this.queueMetrics.queuedJobs++;
    if (type === 'JobDequeued') {
      this.queueMetrics.queuedJobs = Math.max(0, this.queueMetrics.queuedJobs - 1);
      this.queueMetrics.runningJobs++;
      
      const qTime = event.payload?.queueTimeMs;
      if (qTime !== undefined) {
        this.queueMetrics.totalQueueTimeMs += qTime;
        this.queueMetrics.queueTimesCount++;
        if (qTime > this.queueMetrics.maxQueueTimeMs) {
          this.queueMetrics.maxQueueTimeMs = qTime;
        }
      }
    }
    if (type === 'JobCompleted') {
      this.queueMetrics.runningJobs = Math.max(0, this.queueMetrics.runningJobs - 1);
      this.queueMetrics.completedJobs++;
      this.queueMetrics.throughput.jobsCompletedInWindow++;
    }
    if (type === 'JobFailed') {
      this.queueMetrics.runningJobs = Math.max(0, this.queueMetrics.runningJobs - 1);
      this.queueMetrics.failedJobs++;
    }
    if (type === 'JobCancelled') {
      this.queueMetrics.runningJobs = Math.max(0, this.queueMetrics.runningJobs - 1);
      this.queueMetrics.queuedJobs = Math.max(0, this.queueMetrics.queuedJobs - 1);
      this.queueMetrics.cancelledJobs++;
    }
    if (type === 'RetryScheduled') {
      this.queueMetrics.runningJobs = Math.max(0, this.queueMetrics.runningJobs - 1);
      this.queueMetrics.retryingJobs++;
    }
    if (type === 'RetryStarted') {
      this.queueMetrics.retryingJobs = Math.max(0, this.queueMetrics.retryingJobs - 1);
      this.queueMetrics.runningJobs++;
    }
    if (type === 'RetriesExhausted') {
      this.queueMetrics.retryingJobs = Math.max(0, this.queueMetrics.retryingJobs - 1);
      this.queueMetrics.dlqSize++;
    }
  }

  _processWorkerMetrics(event) {
    const type = event.eventType;
    if (type.startsWith('Worker')) {
      const workerId = event.workerId || event.payload?.workerId;
      if (!workerId) return;

      if (!this.workerMetrics.has(workerId)) {
        this.workerMetrics.set(workerId, {
          id: workerId,
          status: 'unknown',
          uptime: 0,
          lastHeartbeat: 0,
          currentJob: null,
          failureCount: 0,
          retryCount: 0,
          totalExecutionTimeMs: 0,
          executionCount: 0
        });
      }

      const worker = this.workerMetrics.get(workerId);
      worker.lastHeartbeat = Date.now();

      if (type === 'WorkerStarted') {
        worker.status = 'idle';
        worker.uptime = Date.now();
      } else if (type === 'WorkerHeartbeat') {
        worker.currentJob = event.payload?.currentJob || worker.currentJob;
      } else if (type === 'WorkerBusy') {
        worker.status = 'busy';
        worker.currentJob = event.payload?.jobId;
      } else if (type === 'WorkerIdle') {
        worker.status = 'idle';
        worker.currentJob = null;
        if (event.payload?.executionTimeMs) {
          worker.totalExecutionTimeMs += event.payload.executionTimeMs;
          worker.executionCount++;
        }
      } else if (type === 'WorkerFailedJob') {
        worker.failureCount++;
      } else if (type === 'WorkerRetriedJob') {
        worker.retryCount++;
      }
    }
  }

  _processScannerMetrics(event) {
    if (event.eventType === 'JobCompleted' && event.payload?.result) {
      this.scannerMetrics.repositoriesScanned++;
      const result = event.payload.result;
      
      this.scannerMetrics.issuesFound += (result.totalIssues || 0);
      
      if (result.summary) {
        this.scannerMetrics.severityDistribution.critical += (result.summary.critical || 0);
        this.scannerMetrics.severityDistribution.high += (result.summary.high || 0);
        this.scannerMetrics.severityDistribution.medium += (result.summary.medium || 0);
        this.scannerMetrics.severityDistribution.low += (result.summary.low || 0);
        this.scannerMetrics.severityDistribution.info += (result.summary.info || 0);
      }

      // Hack to extract scan duration if it's a string like '2.50s'
      if (typeof result.scanTime === 'string' && result.scanTime.endsWith('s')) {
        const secs = parseFloat(result.scanTime.replace('s', ''));
        if (!isNaN(secs)) {
          this.scannerMetrics.totalScanDurationSecs += secs;
          this.scannerMetrics.scanCount++;
        }
      } else if (typeof result.durationSeconds === 'number') {
        this.scannerMetrics.totalScanDurationSecs += result.durationSeconds;
        this.scannerMetrics.scanCount++;
      }
    }
  }

  _processRepositoryMetrics(event) {
    if (event.eventType === 'RepositoryOperationCompleted') {
      const { operation, latencyMs, success } = event.payload;
      
      if (operation === 'read') {
        this.repositoryMetrics.readOperations++;
        this.repositoryMetrics.totalReadTimeMs += latencyMs;
      } else if (operation === 'write') {
        this.repositoryMetrics.writeOperations++;
        this.repositoryMetrics.totalWriteTimeMs += latencyMs;
      }
    } else if (event.eventType === 'OptimisticLockFailed') {
      this.repositoryMetrics.optimisticLockFailures++;
    }
  }

  getQueueMetrics() {
    const avgQTime = this.queueMetrics.queueTimesCount > 0 
      ? (this.queueMetrics.totalQueueTimeMs / this.queueMetrics.queueTimesCount).toFixed(2) 
      : 0;

    const windowMinutes = Math.max(1, (Date.now() - this.queueMetrics.throughput.startTime) / 60000);
    const jobsPerMinute = (this.queueMetrics.throughput.jobsCompletedInWindow / windowMinutes).toFixed(2);

    return {
      queuedJobs: this.queueMetrics.queuedJobs,
      runningJobs: this.queueMetrics.runningJobs,
      completedJobs: this.queueMetrics.completedJobs,
      failedJobs: this.queueMetrics.failedJobs,
      cancelledJobs: this.queueMetrics.cancelledJobs,
      retryingJobs: this.queueMetrics.retryingJobs,
      dlqSize: this.queueMetrics.dlqSize,
      averageQueueTimeMs: parseFloat(avgQTime),
      maximumQueueTimeMs: this.queueMetrics.maxQueueTimeMs,
      jobsPerMinute: parseFloat(jobsPerMinute)
    };
  }

  getWorkerMetrics() {
    let idle = 0;
    let busy = 0;
    const workers = [];

    const now = Date.now();
    for (const [id, w] of this.workerMetrics.entries()) {
      // Mark as dead if heartbeat missed > 30s
      if (now - w.lastHeartbeat > 30000) {
        w.status = 'dead';
      }

      if (w.status === 'idle') idle++;
      if (w.status === 'busy') busy++;

      workers.push({
        ...w,
        uptimeSeconds: Math.floor((now - w.uptime) / 1000),
        averageExecutionTimeMs: w.executionCount > 0 ? Math.floor(w.totalExecutionTimeMs / w.executionCount) : 0
      });
    }

    return {
      totalWorkers: this.workerMetrics.size,
      idleWorkers: idle,
      busyWorkers: busy,
      workers
    };
  }

  getScannerMetrics() {
    const avgDuration = this.scannerMetrics.scanCount > 0 
      ? (this.scannerMetrics.totalScanDurationSecs / this.scannerMetrics.scanCount).toFixed(2) 
      : 0;

    return {
      repositoriesScanned: this.scannerMetrics.repositoriesScanned,
      issuesFound: this.scannerMetrics.issuesFound,
      severityDistribution: this.scannerMetrics.severityDistribution,
      averageScanDurationSecs: parseFloat(avgDuration)
    };
  }

  getRepositoryMetrics() {
    const avgRead = this.repositoryMetrics.readOperations > 0 
      ? (this.repositoryMetrics.totalReadTimeMs / this.repositoryMetrics.readOperations).toFixed(2) 
      : 0;
    const avgWrite = this.repositoryMetrics.writeOperations > 0 
      ? (this.repositoryMetrics.totalWriteTimeMs / this.repositoryMetrics.writeOperations).toFixed(2) 
      : 0;

    return {
      readOperations: this.repositoryMetrics.readOperations,
      writeOperations: this.repositoryMetrics.writeOperations,
      averageReadTimeMs: parseFloat(avgRead),
      averageWriteTimeMs: parseFloat(avgWrite),
      optimisticLockFailures: this.repositoryMetrics.optimisticLockFailures
    };
  }
}

const monitoringService = new MonitoringService();

module.exports = { MonitoringService, monitoringService };
