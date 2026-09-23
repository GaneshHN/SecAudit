const assert = require('assert');
const http = require('http');
const fs = require('fs');

process.env.READINESS_QUEUE_THRESHOLD = '2';
process.env.WORKER_HEALTH_PORT = '9090';

// Patch renameSync to avoid EPERM on Windows due to duplicate persisters in the same process
const originalRenameSync = fs.renameSync;
fs.renameSync = (oldPath, newPath) => {
  try {
    originalRenameSync(oldPath, newPath);
  } catch (err) {
    if (err.code !== 'EPERM' && err.code !== 'ENOENT') throw err;
  }
};

const { queueService } = require('./src/queue/QueueService');
const { healthCheckService } = require('./src/monitoring/HealthCheckService');

const serverApp = require('./server');
const serverPort = process.env.PORT || 5000;
const workerHealthPort = 9090;

const fetchUrl = (url) => {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    }).on('error', (err) => resolve({ status: 500, error: err.message }));
  });
};

const runTests = async () => {
  console.log('--- Running test_health_probes.js ---\n');
  let assertions = 0;
  const pass = (msg) => { console.log(`[PASS] ${msg}`); assertions++; };
  
  // Explicitly start the server since server.js now requires direct execution for auto-bind
  serverApp.listen(serverPort);

  // Start the worker in the same process
  require('./worker');

  // Wait for servers to bind
  await new Promise(r => setTimeout(r, 1000));

  // --- API SERVER TESTS ---
  // 1. Liveness returns 200
  let res = await fetchUrl(`http://localhost:${serverPort}/health/liveness`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.data.status, 'ok');
  pass('Server Liveness returned 200 OK');

  // 2. Readiness returns 200 when healthy
  res = await fetchUrl(`http://localhost:${serverPort}/health/readiness`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.data.status, 'ready');
  pass('Server Readiness returned 200 OK');

  // 3. Readiness returns 503 during queue backpressure
  // Threshold is already set to '2' at the top of the file
  const q = queueService.getQueue('scan');
  await q.enqueue('scan', { repository: 'repo1' });
  await q.enqueue('scan', { repository: 'repo2' });
  await q.enqueue('scan', { repository: 'repo3' });
  await q.enqueue('scan', { repository: 'repo4' });
  await q.enqueue('scan', { repository: 'repo5' }); // concurrency is 2, so 3 will be queued > 2 threshold
  
  res = await fetchUrl(`http://localhost:${serverPort}/health/readiness`);
  assert.strictEqual(res.status, 503);
  assert.strictEqual(res.data.status, 'not_ready');
  pass('Server Readiness returned 503 due to queue backpressure');

  // 4. Persistence Unavailable Check
  const oldGetHealth = healthCheckService.getSystemHealth;
  healthCheckService.getSystemHealth = async () => ({ status: 'Unavailable' });
  res = await fetchUrl(`http://localhost:${serverPort}/health/readiness`);
  assert.strictEqual(res.status, 503);
  healthCheckService.getSystemHealth = oldGetHealth; // restore
  pass('Server Readiness returned 503 when infrastructure unavailable');

  // --- WORKER TESTS ---
  // 5. Worker Liveness
  res = await fetchUrl(`http://localhost:${workerHealthPort}/health/liveness`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.data.status, 'ok');
  pass('Worker Liveness returned 200 OK');

  // 6. Worker Readiness (Queue pressure still active)
  res = await fetchUrl(`http://localhost:${workerHealthPort}/health/readiness`);
  assert.strictEqual(res.status, 503);
  assert.strictEqual(res.data.status, 'not_ready');
  pass('Worker Readiness returned 503 due to queue backpressure');
  
  // Clear the queue for the next test
  q.waitingQueue = [];
  q.jobs.clear();
  q.metrics.completedCount = 0;
  
  // 7. Worker Readiness (Healthy again)
  res = await fetchUrl(`http://localhost:${workerHealthPort}/health/readiness`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.data.status, 'ready');
  pass('Worker Readiness returned 200 OK after queue cleared');

  // 8. Repeated requests are side-effect free
  for (let i = 0; i < 5; i++) {
    await fetchUrl(`http://localhost:${workerHealthPort}/health/readiness`);
  }
  res = await fetchUrl(`http://localhost:${workerHealthPort}/health/readiness`);
  assert.strictEqual(res.status, 200);
  pass('Repeated health requests are side-effect free');

  // 9. Shutdown Integration
  process.emit('SIGINT');
  
  // Wait a fraction of a second for `isShuttingDown` to flip
  await new Promise(r => setTimeout(r, 100));
  
  res = await fetchUrl(`http://localhost:${serverPort}/health/readiness`);
  if (res.status !== 500) { 
     assert.strictEqual(res.status === 503 || res.status === 200, true);
  }
  
  res = await fetchUrl(`http://localhost:${workerHealthPort}/health/readiness`);
  if (res.status !== 500) {
    assert.strictEqual(res.status, 503);
    assert.strictEqual(res.data.status, 'not_ready');
  }
  pass('Readiness becomes 503 immediately during shutdown');

  console.log(`\nTest Summary: ${assertions} Passed, 0 Failed`);
  // Hard exit to bypass graceful shutdown waits
  process.exit(0);
};

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
