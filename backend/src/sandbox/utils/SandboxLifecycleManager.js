const { spawn } = require('child_process');
const SandboxState = require('../models/SandboxState');
const { SANDBOX_EVENTS } = require('../events/SandboxEvents');

class SandboxLifecycleManager {
  constructor(context, eventPublisher, workspaceManager, resourceMonitor) {
    this.context = context;
    this._publishEvent = eventPublisher;
    this.workspaceManager = workspaceManager;
    this.resourceMonitor = resourceMonitor;
    
    // Safely generate container name from trusted job ID
    // Replaces anything not alphanumeric or dash/underscore
    const safeJobId = (context.job.id || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '');
    this.containerName = `secaudit-sandbox-${safeJobId}-${Date.now()}`;
    
    this.childProcess = null;
    this.state = SandboxState.CREATED;
    this.cleanupPromise = null;
    this.isChildExited = false;
    this.finalExitCode = null;
    this.finalError = null;
    this.finalReason = null;
    this.cancellationReason = null;
  }

  transition(newState) {
    // Simple state enforcement (could be more robust based on requirements)
    const validStates = Object.values(SandboxState);
    if (!validStates.includes(newState)) {
      throw new Error(`Invalid Sandbox State: ${newState}`);
    }
    
    // Prevent transitions if already terminal
    if ([SandboxState.DESTROYED, SandboxState.COMPLETED, SandboxState.FAILED].includes(this.state)) {
      // Only allow DESTROYING -> DESTROYED if previously FAILED/COMPLETED. Actually FAILED -> DESTROYING -> DESTROYED
      if ((this.state === SandboxState.FAILED || this.state === SandboxState.COMPLETED) && 
          (newState === SandboxState.DESTROYING || newState === SandboxState.DESTROYED)) {
        this.state = newState;
        return;
      }
      // Otherwise, swallow or warn
      return;
    }
    this.state = newState;
  }

  setChildProcess(child) {
    this.childProcess = child;
    child.on('close', (code) => {
      this.isChildExited = true;
      if (this.finalExitCode === null) {
        this.finalExitCode = code;
      }
    });
    child.on('error', (err) => {
      this.isChildExited = true;
      if (this.finalError === null) {
        this.finalError = err;
      }
    });
  }

  cleanup(reason = null) {
    if (reason && !this.cancellationReason && !this.isChildExited) {
      this.cancellationReason = reason;
    }
    
    // Idempotent cleanup: only execute once
    if (this.cleanupPromise) {
      return this.cleanupPromise;
    }

    this.cleanupPromise = this._executeCleanup(reason);
    return this.cleanupPromise;
  }

  async _executeCleanup(reason) {
    this.transition(SandboxState.DESTROYING);
    
    // 1. Cancel resource monitor
    if (this.resourceMonitor) {
      this.resourceMonitor.stop();
    }

    // 2. Request graceful termination
    if (this.childProcess && !this.isChildExited) {
      this.transition(SandboxState.TERMINATING);
      try {
        this.childProcess.kill('SIGTERM');
        // Wait for grace period
        const gracePeriod = this.context.configuration.resourcePolicy.gracePeriodMs || 5000;
        await this._waitForExit(gracePeriod);
        
        if (!this.isChildExited) {
          // 3. Force kill if still running
          this.childProcess.kill('SIGKILL');
          await this._waitForExit(2000); // Wait a bit more for SIGKILL
        }
      } catch (err) {
        this.context.logger?.error(`Error killing child process: ${err.message}`);
      }
    }

    // 4. Fallback: Cleanup docker container via name if process tracking lost or failed to kill
    try {
      await this._execDockerRmF();
    } catch (err) {
      this.context.logger?.error(`Error running docker rm: ${err.message}`);
    }

    // 5. Workspace cleanup
    let isSuccess = (this.cancellationReason === null && this.finalExitCode === 0 && !this.finalError);
    try {
      if (this.workspaceManager) {
        await this.workspaceManager.cleanup(this.context, isSuccess);
      }
    } catch (err) {
      this.context.logger?.error(`Sandbox workspace cleanup failed: ${err.message}`);
      this._publishEvent('SandboxCleanupFailure', this.context, { error: err.message });
    }

    // Emit termination events if not already done
    if (this.cancellationReason) {
       this._publishEvent(SANDBOX_EVENTS.TERMINATED, this.context, { reason: this.cancellationReason });
    }

    this.transition(SandboxState.DESTROYED);
    this._publishEvent('ContainerDestroyed', this.context, { state: SandboxState.DESTROYED });
    
    return {
      cancellationReason: this.cancellationReason,
      exitCode: this.finalExitCode,
      error: this.finalError
    };
  }

  _waitForExit(timeoutMs) {
    return new Promise((resolve) => {
      if (this.isChildExited) return resolve();
      
      const timer = setTimeout(() => {
        resolve();
      }, timeoutMs);
      
      this.childProcess.once('close', () => {
        clearTimeout(timer);
        resolve();
      });
      
      this.childProcess.once('error', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  _execDockerRmF() {
    return new Promise((resolve, reject) => {
      const rmChild = spawn('docker', ['rm', '-f', this.containerName], { stdio: 'ignore' });
      rmChild.on('close', resolve);
      rmChild.on('error', reject);
    });
  }
}

module.exports = SandboxLifecycleManager;
