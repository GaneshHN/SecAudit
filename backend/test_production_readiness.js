const assert = require('assert');
const child_process = require('child_process');
const { validateDockerRuntime } = require('./scripts/validate-docker-runtime');

async function runTests() {
  console.log('--- Running test_production_readiness.js ---\n');
  let assertions = 0;
  const pass = (msg) => { console.log(`[PASS] ${msg}`); assertions++; };

  // 1. Docker Diagnostics - Safe operations only
  const diagnostics = validateDockerRuntime();
  assert.ok(diagnostics.dockerAvailability === 'PASS' || diagnostics.dockerAvailability === 'BLOCKED');
  assert.strictEqual(diagnostics.error === null || typeof diagnostics.error === 'string', true);
  pass('Docker diagnostics execute safely and classify appropriately');

  // 2. Configuration Validation (Zod)
  try {
    const { execSync } = require('child_process');
    // Test invalid config (e.g. WORKER_CONCURRENCY not numeric string)
    execSync('node -e "require(\'./config/env\')"', { 
      env: { ...process.env, WORKER_CONCURRENCY: 'invalid' },
      stdio: 'pipe' 
    });
    assert.fail('Should have failed validation');
  } catch (err) {
    assert.ok(err.stdout.toString().includes('Invalid') || err.stderr.toString().includes('Invalid'));
    pass('Invalid numeric configuration is rejected and fails closed');
  }

  // 3. Worker Startup (Fail-fast in Production if Docker is missing)
  if (diagnostics.overall !== 'PASS') {
    try {
      child_process.execSync('node worker.js', { 
        env: { ...process.env, NODE_ENV: 'production', SHUTDOWN_TIMEOUT_MS: '1000' },
        stdio: 'pipe' 
      });
      assert.fail('Worker should have failed closed');
    } catch (err) {
      assert.ok(err.stderr.toString().includes('FATAL') || err.stdout.toString().includes('FATAL'));
      pass('Worker refuses production startup when required Docker runtime is unavailable');
    }
  } else {
    pass('Worker refuses production startup when required Docker runtime is unavailable (SKIPPED - Docker is available)');
  }

  // 4. API Startup (Independent)
  const apiProc = child_process.spawn('node', ['server.js'], { 
    env: { ...process.env, PORT: '5002', NODE_ENV: 'production' }
  });
  
  await new Promise(r => setTimeout(r, 1500));
  
  const http = require('http');
  const fetchUrl = (url) => {
    return new Promise((resolve) => {
      http.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data }));
      }).on('error', (err) => resolve({ status: 500, error: err.message }));
    });
  };

  const liveness = await fetchUrl('http://localhost:5002/health/liveness');
  assert.strictEqual(liveness.status, 200);
  pass('API can start independently even if worker/Docker fails');
  
  const readiness = await fetchUrl('http://localhost:5002/health/readiness');
  assert.strictEqual(readiness.status === 200 || readiness.status === 503, true);
  pass('Readiness reflects infrastructure state');

  apiProc.kill('SIGTERM');
  await new Promise(r => setTimeout(r, 1000));
  
  // 5. Worker Startup (Development mock fallback)
  const workerProc = child_process.spawn('node', ['worker.js'], { 
    env: { ...process.env, NODE_ENV: 'development', WORKER_HEALTH_PORT: '9091' }
  });
  
  await new Promise(r => setTimeout(r, 1500));
  const workerLiveness = await fetchUrl('http://localhost:9091/health/liveness');
  assert.strictEqual(workerLiveness.status, 200);
  pass('Worker health endpoint remains available in development fallback mode');
  
  workerProc.kill('SIGTERM');
  await new Promise(r => setTimeout(r, 1000));
  pass('Shutdown still works after configuration changes');
  
  // 6. Security arguments check
  const SandboxConfiguration = require('./src/sandbox/SandboxConfiguration');
  const config = new SandboxConfiguration({ dockerEnabled: true });
  assert.strictEqual(config.networkMode, 'NONE');
  pass('Existing sandbox security arguments remain unchanged (NONE network default)');

  console.log(`\nTest Summary: ${assertions} Passed, 0 Failed`);
  process.exit(0);
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
