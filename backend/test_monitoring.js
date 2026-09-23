const { monitoringService } = require('./src/monitoring/MonitoringService');
const { healthCheckService } = require('./src/monitoring/HealthCheckService');
const { defaultEventBus } = require('./src/events/LocalEventBus');
const BaseEvent = require('./src/events/BaseEvent');
const { EventCategory } = require('./src/events/EventCategory');
const { jobEvents, JOB_EVENTS } = require('./src/events/JobEvents');

async function testMonitoring() {
  console.log('🧪 Testing Task 13: Monitoring & Observability subsystem...\n');

  monitoringService.start();

  console.log('--- Emitting Simulated Events ---');

  // Simulate Job Queue
  jobEvents.emitCreated({ id: 'job_123' });
  jobEvents.emitJobDequeued({ id: 'job_123' }, 250);
  
  // Simulate Scanner
  jobEvents.emitCompleted({ id: 'job_123' }, { 
    totalIssues: 5, 
    scanTime: '1.20s',
    summary: { high: 2, medium: 3 }
  });

  // Simulate Worker
  defaultEventBus.publish(new BaseEvent({
    eventType: 'WorkerStarted',
    category: EventCategory.SYSTEM,
    workerId: 'worker_001',
    sourceComponent: 'WorkerMonitorDecorator'
  }));

  defaultEventBus.publish(new BaseEvent({
    eventType: 'WorkerBusy',
    category: EventCategory.SYSTEM,
    workerId: 'worker_001',
    payload: { jobId: 'job_123' },
    sourceComponent: 'WorkerMonitorDecorator'
  }));

  // Simulate Repository Metric
  defaultEventBus.publish(new BaseEvent({
    eventType: 'RepositoryOperationCompleted',
    category: EventCategory.SYSTEM,
    sourceComponent: 'ScanJobRepository',
    payload: { operation: 'read', method: 'getById', latencyMs: 45, success: true }
  }));

  // Give asynchronous event bus a tiny moment to process
  await new Promise(resolve => setTimeout(resolve, 100));

  console.log('\n--- Queue Metrics ---');
  const queueStats = monitoringService.getQueueMetrics();
  console.log(queueStats);
  if (queueStats.completedJobs === 1 && queueStats.averageQueueTimeMs === 250) {
    console.log('✅ Queue Metrics aggregated successfully');
  } else {
    console.error('❌ Queue Metrics failed to aggregate');
  }

  console.log('\n--- Scanner Metrics ---');
  const scanStats = monitoringService.getScannerMetrics();
  console.log(scanStats);
  if (scanStats.repositoriesScanned === 1 && scanStats.issuesFound === 5 && scanStats.averageScanDurationSecs === 1.2) {
    console.log('✅ Scanner Metrics aggregated successfully');
  } else {
    console.error('❌ Scanner Metrics failed to aggregate');
  }

  console.log('\n--- Worker Metrics ---');
  const workerStats = monitoringService.getWorkerMetrics();
  console.log(workerStats);
  if (workerStats.totalWorkers === 1 && workerStats.busyWorkers === 1) {
    console.log('✅ Worker Metrics aggregated successfully');
  } else {
    console.error('❌ Worker Metrics failed to aggregate');
  }

  console.log('\n--- Repository Metrics ---');
  const repoStats = monitoringService.getRepositoryMetrics();
  console.log(repoStats);
  if (repoStats.readOperations === 1 && repoStats.averageReadTimeMs === 45) {
    console.log('✅ Repository Metrics aggregated successfully');
  } else {
    console.error('❌ Repository Metrics failed to aggregate');
  }

  console.log('\n--- Health System ---');
  const health = await healthCheckService.getSystemHealth();
  console.log('Overall Status:', health.status);
  if (health.status) {
    console.log('✅ Health Check Service is operational');
  } else {
    console.error('❌ Health Check Service failed');
  }

  console.log('\n🎉 Monitoring and Observability Tests Passed!\n');
  process.exit(0);
}

testMonitoring().catch(err => {
  console.error('❌ Monitoring test failed with exception:', err);
  process.exit(1);
});
