const assert = require('assert');
const request = require('supertest');
const app = require('./server'); // Requires server.js which exports app
const queueProvider = require('./src/api/queueInstance');

async function testApiIntegration() {
  console.log('🧪 Starting API Integration Tests...\n');

  // Test 1: POST /api/v1/scan (Success - URL)
  console.log('Test 1: POST /api/v1/scan with valid URL');
  const res1 = await request(app)
    .post('/api/v1/scan')
    .send({ repoUrl: 'https://github.com/expressjs/express', priority: 'High' })
    .set('x-user-id', 'test_user')
    .set('x-user-role', 'user');

  assert.strictEqual(res1.status, 202, 'Should return 202 Accepted');
  assert.strictEqual(res1.body.success, true);
  assert.ok(res1.body.data.jobId);
  assert.ok(res1.body.meta.requestId);
  
  const jobId = res1.body.data.jobId;
  console.log('   ✅ Test 1 Passed: Scan job enqueued and returned 202.\n');

  // Test 2: GET /api/v1/jobs/:id/status
  console.log('Test 2: GET /api/v1/jobs/:id/status');
  const res2 = await request(app)
    .get(`/api/v1/jobs/${jobId}/status`)
    .set('x-user-id', 'test_user')
    .set('x-user-role', 'user');
    
  assert.strictEqual(res2.status, 200);
  assert.strictEqual(res2.body.success, true);
  assert.strictEqual(res2.body.data.jobId, jobId);
  assert.ok(res2.body.data.status !== undefined);
  console.log('   ✅ Test 2 Passed: Job status retrieved successfully.\n');

  // Test 3: Validation Error Standardization
  console.log('Test 3: POST /api/v1/scan with Validation Error');
  const res3 = await request(app)
    .post('/api/v1/scan')
    .send({}) // Missing repoUrl and file
    .set('x-user-id', 'test_user');
    
  assert.strictEqual(res3.status, 400);
  assert.strictEqual(res3.body.success, false);
  assert.strictEqual(res3.body.error.code, 'BAD_REQUEST');
  console.log('   ✅ Test 3 Passed: Validation errors follow standard format.\n');

  // Test 4: Authorization (Accessing another user's job)
  console.log('Test 4: Authorization check');
  const res4 = await request(app)
    .get(`/api/v1/jobs/${jobId}/status`)
    .set('x-user-id', 'hacker')
    .set('x-user-role', 'user');
    
  assert.strictEqual(res4.status, 403);
  assert.strictEqual(res4.body.success, false);
  assert.strictEqual(res4.body.error.code, 'FORBIDDEN');
  console.log('   ✅ Test 4 Passed: Authorization blocks cross-user access.\n');

  // Test 5: Authorization (Admin override)
  console.log('Test 5: Admin Authorization override');
  const res5 = await request(app)
    .get(`/api/v1/jobs/${jobId}/status`)
    .set('x-user-id', 'admin_123')
    .set('x-user-role', 'admin');
    
  assert.strictEqual(res5.status, 200);
  assert.strictEqual(res5.body.success, true);
  console.log('   ✅ Test 5 Passed: Admin can access any job.\n');

  // Test 6: Rate Limiting
  console.log('Test 6: Rate Limiting middleware');
  // POST /api/v1/scan has max 20 requests per minute
  let lastRes = null;
  for(let i=0; i<22; i++) {
    lastRes = await request(app)
      .post('/api/v1/scan')
      .send({ repoUrl: 'https://github.com/expressjs/express' })
      .set('x-user-id', 'spammer');
  }
  
  assert.strictEqual(lastRes.status, 429);
  assert.strictEqual(lastRes.body.error.code, 'TOO_MANY_REQUESTS');
  console.log('   ✅ Test 6 Passed: Rate limit kicks in at configured threshold.\n');

  // Test 7: Metrics Tracker
  console.log('Test 7: API Metrics Endpoint');
  const res7 = await request(app).get('/api/v1/metrics');
  assert.strictEqual(res7.status, 200);
  assert.ok(res7.body.data.requestsTotal > 0);
  assert.ok(res7.body.data.validationFailures > 0);
  assert.ok(res7.body.data.authorizationFailures > 0);
  assert.ok(res7.body.data.routeMetrics['/api/v1/scan'] !== undefined);
  console.log('   ✅ Test 7 Passed: Metrics are correctly accumulated and exposed.\n');

  console.log('🎉 ALL API INTEGRATION TESTS PASSED!');
  process.exit(0);
}

testApiIntegration().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
