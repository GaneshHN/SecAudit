const { defaultEventBus } = require('./src/events/LocalEventBus');
const BaseEvent = require('./src/events/BaseEvent');
const { createSandboxEvent, SANDBOX_EVENTS } = require('./src/sandbox/events/SandboxEvents');
const { sandboxAuditLogger } = require('./src/sandbox/utils/SandboxAuditLogger');
const { sandboxMetrics } = require('./src/sandbox/utils/SandboxMetrics');
const { SandboxReaperScheduler } = require('./src/sandbox/utils/SandboxReaperScheduler');
const { healthCheckService } = require('./src/monitoring/HealthCheckService');
const { logger } = require('./src/logging/logger');

// Mock logger.info, logger.warn, logger.error to capture output
const capturedLogs = [];
const originalLogger = {
  info: logger.info,
  warn: logger.warn,
  error: logger.error
};

function interceptLogger() {
  logger.info = (msg, obj) => capturedLogs.push({ level: 'info', msg, obj });
  logger.warn = (msg, obj) => capturedLogs.push({ level: 'warn', msg, obj });
  logger.error = (msg, obj) => capturedLogs.push({ level: 'error', msg, obj });
}

function restoreLogger() {
  logger.info = originalLogger.info;
  logger.warn = originalLogger.warn;
  logger.error = originalLogger.error;
}

async function runTests() {
  console.log('🧪 Starting Sandbox Observability & Auditability Tests...\n');
  interceptLogger();

  try {
    sandboxAuditLogger.start();
    sandboxMetrics.start();

    // 1. Audit events captured & Correlation IDs preserved
    console.log('[1] Testing Audit Events and Correlation...');
    
    defaultEventBus.publish(createSandboxEvent(SANDBOX_EVENTS.STARTED, {
      job: { id: 'job-123' },
      correlationId: 'corr-456'
    }, { state: 'RUNNING' }));

    await new Promise(r => setTimeout(r, 50));

    let log = capturedLogs.find(l => l.msg.includes('Sandbox Audit: SandboxStarted'));
    if (!log || log.obj.jobId !== 'job-123' || log.obj.correlationId !== 'corr-456') {
      throw new Error('Audit log missing or correlation ID not preserved.');
    }
    console.log('   ✅ Audit events capture correlation/job IDs.');

    // 2. Secrets scrubbed
    console.log('[2] Testing Secret Scrubbing...');
    defaultEventBus.publish(createSandboxEvent(SANDBOX_EVENTS.FAILED, {
      job: { id: 'job-secret' },
      correlationId: 'corr-secret'
    }, {
      error: 'Failed to connect to mongodb://user:pass123@db.internal:27017, Token=superSecretToken!',
      workspace: '/workspace/internal/secaudit-ws-123'
    }));

    await new Promise(r => setTimeout(r, 50));

    log = capturedLogs.find(l => l.msg.includes('Sandbox Audit: SandboxFailed'));
    if (!log) throw new Error('Audit log for failure missing.');
    if (log.obj.errorSummary.includes('pass123') || log.obj.errorSummary.includes('superSecretToken!')) {
      throw new Error(`Secret leaked in audit log! ${log.obj.errorSummary}`);
    }
    if (log.obj.workspaceId === '/workspace/internal/secaudit-ws-123') {
      throw new Error('Workspace path was not sanitized properly.');
    }
    console.log('   ✅ Secrets and sensitive URLs are scrubbed.');

    // 3. Raw Untrusted Output truncated
    console.log('[3] Testing Untrusted Output Truncation...');
    const longString = 'A'.repeat(500);
    defaultEventBus.publish(createSandboxEvent('IPCProtocolViolation', {
      job: { id: 'job-ipc' }
    }, { error: `Worker sent: ${longString}` }));

    await new Promise(r => setTimeout(r, 50));

    log = capturedLogs.find(l => l.msg.includes('Sandbox Audit: IPCProtocolViolation'));
    if (!log || log.obj.errorSummary.length > 250 || !log.obj.errorSummary.includes('[TRUNCATED]')) {
      throw new Error('Untrusted strings are not truncated.');
    }
    console.log('   ✅ Untrusted strings are truncated.');

    // 4. Sandbox Metrics
    console.log('[4] Testing Sandbox Metrics...');
    defaultEventBus.publish(new BaseEvent({ eventType: 'JobCreated', category: 'System', sourceComponent: 'Test', jobId: 'job-m1', payload: { jobId: 'job-m1' } }));
    await new Promise(r => setTimeout(r, 50));
    
    // Simulate some time passing for metrics
    const startTime = Date.now();
    sandboxMetrics.activeJobTimestamps.set('job-m1', { enqueuedAt: startTime - 100 });
    
    defaultEventBus.publish(createSandboxEvent(SANDBOX_EVENTS.STARTED, { job: { id: 'job-m1' } }));
    await new Promise(r => setTimeout(r, 50));
    
    // Fast forward for execution duration tracking
    sandboxMetrics.activeJobTimestamps.get('job-m1').startedAt = startTime - 500;
    
    defaultEventBus.publish(createSandboxEvent(SANDBOX_EVENTS.COMPLETED, { job: { id: 'job-m1' } }));
    
    defaultEventBus.publish(createSandboxEvent(SANDBOX_EVENTS.RESOURCE_EXCEEDED, { job: { id: 'job-m2' } }, { resource: 'memory' }));
    defaultEventBus.publish(createSandboxEvent(SANDBOX_EVENTS.RESOURCE_WARNING, { job: { id: 'job-m3' } }, { resource: 'disk' }));
    defaultEventBus.publish(createSandboxEvent('SecurityProfileInvalid', { job: { id: 'job-m4' } }));
    defaultEventBus.publish(createSandboxEvent(SANDBOX_EVENTS.TIMEOUT, { job: { id: 'job-m5' } }));

    await new Promise(r => setTimeout(r, 50));

    const metrics = sandboxMetrics.getMetrics();
    if (metrics.starts < 2 || metrics.completions < 1 || metrics.memoryLimitFailures < 1 || metrics.securityIsolationFailures < 1 || metrics.timeouts < 1) {
      throw new Error(`Metrics did not increment correctly. Found: ${JSON.stringify(metrics)}`);
    }
    if (metrics.averageExecutionTimeMs < 400 || metrics.averageQueueToStartTimeMs < 50) {
      throw new Error(`Timings not recorded properly. Exec: ${metrics.averageExecutionTimeMs}, Queue: ${metrics.averageQueueToStartTimeMs}`);
    }
    console.log('   ✅ Sandbox metrics increment correctly (counters and timings).');

    // 5. Reaper Scheduler
    console.log('[5] Testing Reaper Scheduler...');
    const scheduler = new SandboxReaperScheduler({ intervalMs: 50 }); // very short interval
    
    // Mock runReaper
    let runCount = 0;
    const SandboxReaper = require('./src/sandbox/utils/SandboxReaper');
    const originalRunReaper = SandboxReaper.prototype.runReaper;
    
    SandboxReaper.prototype.runReaper = async function() {
      runCount++;
      return new Promise(resolve => setTimeout(() => resolve(1), 20)); // simulated delay
    };

    scheduler.start();
    scheduler.start(); // Idempotent check

    await new Promise(r => setTimeout(r, 120)); // wait for ~2 runs

    scheduler.stop();
    scheduler.stop(); // Idempotent check

    if (runCount < 1 || runCount > 3) {
      throw new Error(`Scheduler did not run the expected number of times. runCount: ${runCount}`);
    }
    
    // Test overlap prevention
    scheduler.isRunning = true; // Lock it
    const preCount = runCount;
    await scheduler.runNow(); // Should skip
    if (runCount !== preCount) {
      throw new Error('Scheduler executed overlapping runs.');
    }
    scheduler.isRunning = false; // Unlock

    SandboxReaper.prototype.runReaper = originalRunReaper;
    console.log('   ✅ Scheduler starts, prevents overlaps, stops cleanly, and is idempotent.');

    // 6. HealthCheckService Integration
    console.log('[6] Testing HealthCheckService Integration...');
    const health = await healthCheckService.getSystemHealth();
    if (!health.components.sandbox || health.components.sandbox.status !== 'Healthy') {
      throw new Error('Sandbox metrics not exposed in health response.');
    }
    if (health.components.sandbox.metrics.starts === undefined) {
      throw new Error('Sandbox metrics object missing in health response.');
    }
    console.log('   ✅ HealthCheckService exposes sandbox metrics safely.');

    // 7. Malformed Events Resilience
    console.log('[7] Testing Malformed Events Resilience...');
    try {
      defaultEventBus.publish(new BaseEvent({ eventType: SANDBOX_EVENTS.STARTED, category: 'System', sourceComponent: 'Test', payload: null }));
      defaultEventBus.publish(new BaseEvent({ eventType: 'RandomEvent', category: 'System', sourceComponent: 'Test', payload: {} }));
      
      // Attempting to bypass BaseEvent constraint directly via handler
      sandboxAuditLogger._handleEvent(null);
      sandboxAuditLogger._handleEvent({ eventType: 'RandomEvent' });
      
      await new Promise(r => setTimeout(r, 50));
    } catch (e) {
      throw new Error('Malformed events crashed the observability components!');
    }
    console.log('   ✅ Components gracefully ignore malformed events.');

    console.log('\n🎉 ALL OBSERVABILITY TESTS PASSED!');

  } catch (error) {
    console.error(`\n❌ TEST FAILED: ${error.message}`);
    process.exit(1);
  } finally {
    sandboxAuditLogger.stop();
    sandboxMetrics.stop();
    restoreLogger();
  }
}

runTests();
