# SecAudit Sandbox - Deployment Guide

This guide details how to securely deploy the SecAudit sandbox architecture to production environments.

## Architecture

The system operates across two isolated execution boundaries:

1. **API Server (`server.js`)**: An HTTP server that accepts user requests, persists jobs, and enqueues scan tasks. It is fully stateless and does NOT require Docker access.
2. **Worker Daemon (`worker.js`)**: A background daemon that dequeues jobs, manages the sandbox lifecycle, and orchestrates `DockerSandboxProvider`.

By separating these components, the API attack surface is completely isolated from the high-privilege operations required by the Worker to interact with Docker.

## Components & Infrastructure

### Queue & Persistence
Currently, the system uses in-memory persistence (`JsonUnitOfWork`) and queueing (`InMemoryQueueProvider`) backed by JSON files (`secaudit-jobs.json`, `secaudit-events.json`, `secaudit-results.json`).
For horizontal scaling in the future, these components will be swapped out for Redis (Queue) and PostgreSQL/MongoDB (Persistence).

### Docker Daemon Requirement
The **Worker Daemon** strictly requires a functioning Docker daemon on the host. The worker dynamically provisions ephemeral containers for untrusted execution.
The API Server does NOT require Docker.

> [!WARNING]
> **Real Docker security verification MUST be performed on a Linux host with a functioning Docker daemon.**
> Testing in mock environments or Windows/MacOS VMs provides validation of the architecture but does NOT validate the kernel-level isolation (e.g., AppArmor, Seccomp, CGroups) which must be tested natively.

---

## Docker Runtime Validation

In production (`NODE_ENV=production`), the Worker performs a diagnostic check (`scripts/validate-docker-runtime.js`) upon boot:
- Checks if Docker is available (`docker info`).
- Inspects `Seccomp` and `AppArmor` capabilities.

**Development vs Production Behavior:**
- **Development/Test**: If Docker validation fails, the worker will warn but continue (potentially falling back to local mocks).
- **Production**: If Docker validation fails, the worker **FAILS FAST AND CLOSED** (`process.exit(1)`). It will never silently process untrusted code in a mock or un-sandboxed environment.

---

## High-Privilege Deployment Boundary: Docker Socket

The Worker container (`Dockerfile.worker`) utilizes the `docker-cli` to command the host's Docker daemon.
You **must** mount the Docker socket from the host to the worker container:

```bash
docker run -v /var/run/docker.sock:/var/run/docker.sock secaudit-worker
```

> [!CAUTION]
> Mounting `/var/run/docker.sock` grants the worker container effectively `root` equivalence on the host. Ensure the worker container itself is network-isolated and not exposed to public ingress.
> To run the `node` user securely, the host's `docker` group GID must match the worker's permissions, or a socket proxy should be utilized.

---

## Environment Variables

Centralized in `config/env.js`.

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | Mode: `production`, `development`, `test`. Enforces strict validation in prod. |
| `PORT` | `5000` | Port for the API server. |
| `WORKER_HEALTH_PORT` | `9090` | Port for the Worker's isolated health probes. |
| `WORKER_CONCURRENCY` | `2` | Number of simultaneous concurrent sandbox executions. |
| `SHUTDOWN_TIMEOUT_MS` | `30000` | Maximum time to wait for jobs to drain before forced SIGKILL. |
| `READINESS_QUEUE_THRESHOLD` | `0` | If > 0, API/Worker will report 503 Readiness when queue depth exceeds this. |
| `METRICS_ENABLED` | `true` | Toggles telemetry and observability streams. |
| `SANDBOX_WORKSPACE_ROOT` | `/tmp/secaudit-workspaces` | Directory where ephemeral files are mounted. |
| `SANDBOX_REAPER_INTERVAL_MS`| `900000` (15m) | Interval for the Orphan Cleanup Reaper. |

---

## Health, Liveness & Readiness Probes

Designed for Kubernetes/Load Balancers:

### API Server (`PORT`)
- **Liveness**: `GET /health/liveness` - Returns `200 OK` if the process is running.
- **Readiness**: `GET /health/readiness` - Returns `200 OK`, or `503` if shutting down, infrastructure is degraded, or queue backpressure threshold is exceeded.

### Worker Daemon (`WORKER_HEALTH_PORT`)
Hosted on a completely isolated, internal lightweight HTTP server.
- **Liveness**: `GET /health/liveness` - Returns `200 OK`.
- **Readiness**: `GET /health/readiness` - Returns `200 OK`, or `503` if shutting down or queue backpressure threshold is exceeded.

---

## Graceful Shutdown

Both API and Worker respond to `SIGTERM` and `SIGINT`:
1. Instantly flips `isShuttingDown` = `true` -> Health readiness becomes `503`.
2. Load balancers drain traffic from the node.
3. Queue stops accepting new jobs.
4. Active sandbox executions continue until `SHUTDOWN_TIMEOUT_MS`.
5. Remaining jobs are cancelled (and re-queued/failed) cleanly.
6. Ephemeral workspaces and orphaned containers are reaped before exit.

## Sandbox Security Requirements & Reaper

Phase 4 Security controls actively enforced:
- **Network**: `--network=none` disables outbound networking.
- **Filesystem**: Read-only root filesystem with precise tmpfs mounts. Path traversal and symlink guards applied.
- **Resources**: CPU, Memory, and PID limits enforced.
- **Kernel**: Privileges dropped (`no-new-privileges`, `cap-drop=ALL`).
- **Cleanup**: `SandboxReaperScheduler` scans `SANDBOX_WORKSPACE_ROOT` and Docker API every `SANDBOX_REAPER_INTERVAL_MS` to destroy zombie processes or orphaned artifacts.
