const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs/promises');
const ISandboxProvider = require('../ISandboxProvider');
const SandboxState = require('../models/SandboxState');
const { defaultEventBus } = require('../../events/LocalEventBus');
const { createSandboxEvent, SANDBOX_EVENTS } = require('../events/SandboxEvents');
const SandboxNetworkPolicy = require('../models/SandboxNetworkPolicy');
const DatabaseScanResultWriter = require('../../executors/writers/DatabaseScanResultWriter');
const SandboxResourceMonitor = require('../utils/SandboxResourceMonitor');
const NetworkPolicyEnforcer = require('../utils/NetworkPolicyEnforcer');
const DockerSecurityArguments = require('../utils/DockerSecurityArguments');
const SecureArtifactReader = require('../utils/SecureArtifactReader');
const SecureIPCProcessor = require('../utils/SecureIPCProcessor');
const SandboxLifecycleManager = require('../utils/SandboxLifecycleManager');

class DockerSandboxProvider extends ISandboxProvider {
  constructor(workspaceManager) {
    super();
    this.workspaceManager = workspaceManager;
  }

  _publishEvent(eventName, context, details = {}) {
    defaultEventBus.publish(createSandboxEvent(eventName, context, details));
  }

  async prepareWorkspace(context) {
    this._publishEvent('SandboxCreated', context);
    await this.workspaceManager.createWorkspace(context);

    // Save context for the runner
    const contextPath = path.join(context.workspace, 'context.json');
    await fs.writeFile(contextPath, JSON.stringify({
      job: context.job,
      repository: context.executionContext?.repository || context.job.repository,
      scanTimeoutMs: context.configuration.resourcePolicy.timeoutMs || 60000
    }, null, 2));

    this._publishEvent('ContainerCreated', context);
  }

  async execute(context) {
    let isSuccess = false;
    let lifecycleManager = null;
    try {
      await this.prepareWorkspace(context);
      this._publishEvent('ContainerStarted', context);
      this._publishEvent(SANDBOX_EVENTS.STARTED, context);
      
      // Convert Resource Policies to Docker flags
      const memoryLimit = context.configuration.resourcePolicy.memoryMb ? `--memory=${context.configuration.resourcePolicy.memoryMb}m` : '';
      const cpuLimit = context.configuration.resourcePolicy.cpuCores ? `--cpus=${context.configuration.resourcePolicy.cpuCores}` : '';
      const pidsLimit = context.configuration.resourcePolicy.processLimit ? `--pids-limit=${context.configuration.resourcePolicy.processLimit}` : '';
      
      const policyEnforcer = new NetworkPolicyEnforcer(context.configuration.networkMode);
      const networkArgs = policyEnforcer.getDockerArgs();
      this._publishEvent('NetworkPolicyApplied', context, { policy: context.configuration.networkMode });

      const securityArgs = DockerSecurityArguments.getArgs(context.configuration.securityProfile);
      this._publishEvent('SecurityProfileApplied', context, { profile: context.configuration.securityProfile });
      
      // We mount the backend directory as read-only to /app
      const backendPath = path.resolve(process.cwd());
      // We mount the workspace as read-write to /workspace
      const workspacePath = path.resolve(context.workspace);

      const resourceMonitor = new SandboxResourceMonitor(context);
      
      lifecycleManager = new SandboxLifecycleManager(context, (event, ctx, details) => this._publishEvent(event, ctx, details), this.workspaceManager, resourceMonitor);
      
      const containerName = lifecycleManager.containerName;
      const dockerArgs = [
        'run', '--rm',
        '--name', containerName,
        '--label', 'secaudit.managed=true',
        '--label', `secaudit.job_id=${context.job.id}`,
        '-v', `${backendPath}:/app:ro`,
        '-v', `${workspacePath}:/workspace:rw`,
        '-w', '/workspace',
        '-e', 'NODE_ENV=production',
        '-e', 'WORKSPACE_PATH=/workspace'
      ];

      if (memoryLimit) dockerArgs.push(memoryLimit);
      if (cpuLimit) dockerArgs.push(cpuLimit);
      if (pidsLimit) dockerArgs.push(pidsLimit);
      dockerArgs.push(...networkArgs);
      dockerArgs.push(...securityArgs);

      dockerArgs.push('node:20-alpine', 'node', '/app/src/sandbox/bin/docker-runner.js', '/workspace');

      this._publishEvent('RepositoryMounted', context);
      
      resourceMonitor.start();
      lifecycleManager.transition(SandboxState.RUNNING);

      const report = await new Promise((resolve, reject) => {
        const child = spawn('docker', dockerArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
        let stderrOutput = '';
        
        lifecycleManager.setChildProcess(child);

        const cleanupAndReject = async (reason, originalError = null) => {
          try {
            const cleanupResult = await lifecycleManager.cleanup(reason);
            const err = new Error(originalError ? originalError.message : `Sandbox terminated: ${reason}`);
            err.reason = reason;
            if (reason === 'CANCELLED' || reason === 'TIMEOUT' || reason === 'DISK_LIMIT') {
              err.isCancellation = true;
            }
            reject(err);
          } catch (e) {
            reject(e);
          }
        };

        const handleCancel = (reason) => {
          cleanupAndReject(reason);
        };

        if (context.cancellationToken) {
          context.cancellationToken.on('cancelled', handleCancel);
        }

        // Timeout Timer triggers cancellation
        if (context.configuration.resourcePolicy.timeoutMs) {
          setTimeout(() => {
            if (context.cancellationToken) {
              context.cancellationToken.cancel('TIMEOUT');
            } else {
              handleCancel('TIMEOUT');
            }
          }, context.configuration.resourcePolicy.timeoutMs);
        }

        const ipcProcessor = new SecureIPCProcessor(context, (event, ctx) => this._publishEvent(event, ctx));

        child.stdout.on('data', (data) => {
          try {
            ipcProcessor.processChunk(data);
          } catch (e) {
            cleanupAndReject(e.reason || 'IPCProtocolViolation', e);
          }
        });

        child.stderr.on('data', (data) => {
          stderrOutput += data.toString();
        });

        child.on('close', async (code) => {
          if (context.cancellationToken) {
            context.cancellationToken.removeListener('cancelled', handleCancel);
          }
          lifecycleManager.transition(SandboxState.COMPLETING);
          this._publishEvent('ContainerStopped', context);
          
          try {
            const result = await SecureArtifactReader.readArtifacts(context.workspace);
            
            if (context.cancellationToken?.isCancelled) {
              // Already handled by handleCancel, but just in case
              return reject(new Error(`Cancelled: ${context.cancellationToken.reason}`));
            }

            if (code !== 0 || result.exitCode !== 0 || result.error) {
              let reason = 'GENERAL_FAILURE';
              if (code === 137 && stderrOutput.includes('OOMKilled')) {
                reason = 'MEMORY_LIMIT';
              }
              const err = new Error(result.error || `Container exited with code ${code}. Stderr: ${stderrOutput}`);
              err.reason = reason;
              return reject(err);
            }
            
            const hostWriter = new DatabaseScanResultWriter();
            await hostWriter.write(context.executionContext, result.report);
            this._publishEvent(SANDBOX_EVENTS.COMPLETED, context);
            resolve(result.report);
          } catch (e) {
            reject(e);
          }
        });

        child.on('error', (err) => {
          cleanupAndReject('GENERAL_FAILURE', err).catch(reject);
        });
      });
      
      isSuccess = true;
      return report;
    } catch (error) {
      if (error.reason && error.reason.includes('NETWORK_')) {
        this._publishEvent('NetworkIsolationFailure', context, { error: error.message, reason: error.reason });
      } else if (error.reason && ['SECURITY_PROFILE_INVALID', 'PRIVILEGE_ESCALATION_BLOCKED', 'CAPABILITY_CONFIGURATION_ERROR', 'SECCOMP_CONFIGURATION_ERROR', 'APPARMOR_CONFIGURATION_ERROR'].includes(error.reason)) {
        this._publishEvent('SecurityIsolationFailure', context, { error: error.message, reason: error.reason });
      } else if (error.reason && ['ArtifactValidationFailed', 'ArtifactSizeExceeded', 'IPCProtocolViolation'].includes(error.reason)) {
        this._publishEvent(error.reason, context, { error: error.message, reason: error.reason });
      }
      this._publishEvent('SandboxFailed', context, { error: error.message });
      throw error;
    } finally {
      if (lifecycleManager) {
        await lifecycleManager.cleanup();
      }
    }
  }

  async streamLogs(context) {
    return null;
  }

  async cleanup(context, isSuccess) {
    // Handled by SandboxLifecycleManager
  }
}

module.exports = DockerSandboxProvider;
