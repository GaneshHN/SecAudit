const path = require('path');
const fs = require('fs').promises;
const CleanupPolicy = require('./models/CleanupPolicy');
const SecureFilesystem = require('./utils/SecureFilesystem');

/**
 * Manages the physical filesystem isolation for sandboxes.
 */
class WorkspaceManager {
  /**
   * @param {SandboxConfiguration} config 
   */
  constructor(config) {
    this.config = config;
  }

  /**
   * Creates a unique workspace directory and writes metadata.
   * @param {SandboxContext} context 
   * @returns {string} The absolute path to the workspace
   */
  async createWorkspace(context) {
    const workspaceId = `secaudit-ws-${context.job.id}-${Date.now()}`;
    // SecureFilesystem will throw if there's any traversal escaping the workspaceRoot
    const workspacePath = SecureFilesystem.resolveSecurePath(this.config.workspaceRoot, workspaceId);

    await fs.mkdir(workspacePath, { recursive: true });

    // Write workspace metadata (Task 6 refinement)
    const metadata = {
      jobId: context.job.id,
      workerId: context.job.workerId,
      correlationId: context.correlationId,
      creationTime: new Date().toISOString(),
      expirationTime: new Date(Date.now() + this.config.resourcePolicy.timeoutMs).toISOString(),
      sandboxType: 'LOCAL_OR_DOCKER' // Will be updated by provider if needed
    };

    await fs.writeFile(
      path.join(workspacePath, '.secaudit-metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    context.workspace = workspacePath;
    return workspacePath;
  }

  /**
   * Cleans up the workspace directory based on the cleanup policy.
   * @param {SandboxContext} context 
   * @param {boolean} isSuccess 
   */
  async cleanup(context, isSuccess) {
    if (!context.workspace) return;

    let shouldCleanup = false;
    switch (this.config.cleanupPolicy) {
      case CleanupPolicy.ALWAYS:
        shouldCleanup = true;
        break;
      case CleanupPolicy.ON_SUCCESS:
        shouldCleanup = isSuccess;
        break;
      case CleanupPolicy.NEVER:
      case CleanupPolicy.DEBUG:
        shouldCleanup = false;
        break;
    }

    if (shouldCleanup) {
      try {
        // Double check boundary before deleting
        SecureFilesystem.resolveSecurePath(this.config.workspaceRoot, context.workspace);
        await fs.rm(context.workspace, { recursive: true, force: true });
        context.logger.info(`[WorkspaceManager] Cleaned up workspace: ${context.workspace}`);
      } catch (err) {
        context.logger.error(`[WorkspaceManager] Failed to cleanup workspace ${context.workspace}: ${err.message}`);
      }
    } else {
      context.logger.info(`[WorkspaceManager] Retained workspace due to policy (${this.config.cleanupPolicy}): ${context.workspace}`);
    }
  }
}

module.exports = WorkspaceManager;
