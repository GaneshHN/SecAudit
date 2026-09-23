$tests = @(
  "test_sandbox_observability.js",
  "test_sandbox_lifecycle.js",
  "test_artifact_ipc_security.js",
  "test_security_profiles.js",
  "test_network_isolation.js",
  "test_resource_limits.js",
  "test_filesystem_isolation.js",
  "test_sandbox_architecture.js",
  "test_docker_sandbox.js",
  "test_state_machine.js",
  "test_queue_scheduling.js",
  "test_retry_policy.js",
  "test_monitoring.js",
  "test_persistence_layer.js",
  "test_phase4_e2e.js",
  "test_graceful_shutdown.js",
  "test_health_probes.js",
  "test_production_readiness.js",
  "test_phase5_final.js"
)

foreach ($test in $tests) {
  Write-Host "=================================="
  Write-Host "Running $test"
  Write-Host "=================================="
  node $test
  if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ $test failed!" -ForegroundColor Red
    exit 1
  }
}

Write-Host "✅ ALL VALIDATION TESTS PASSED!" -ForegroundColor Green
