const fs = require('fs').promises;
const path = require('path');
const ISandboxProvider = require('../ISandboxProvider');
const SandboxState = require('../models/SandboxState');
const LocalScanExecutor = require('../../executors/LocalScanExecutor');
const { defaultEventBus } = require('../../events/LocalEventBus');

const { createSandboxEvent, SANDBOX_EVENTS } = require('../events/SandboxEvents');

/**
 * Executes a scan in an isolated local directory, preserving current scanner behavior.
 */
class LocalSandboxProvider extends ISandboxProvider {
  /**
   * @param {WorkspaceManager} workspaceManager 
   */
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
    
    // Update metadata for local sandbox type
    const metaPath = path.join(context.workspace, '.secaudit-metadata.json');
    try {
      const metaStr = await fs.readFile(metaPath, 'utf-8');
      const meta = JSON.parse(metaStr);
      meta.sandboxType = 'LOCAL_SANDBOX';
      await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));
    } catch (e) {
      // Ignore if metadata is missing
    }
  }

  async execute(context) {
    let isSuccess = false;
    let result = null;

    try {
      await this.prepareWorkspace(context);
      
      this._publishEvent('SandboxStarted', context, { state: SandboxState.RUNNING });

      // invoke the existing ScanExecutor using the original ExecutionContext
      const executor = new LocalScanExecutor();
      result = await executor.execute(context.executionContext);
      isSuccess = true;
      
      this._publishEvent('SandboxCompleted', context, { state: SandboxState.STOPPED });
      
      return result;
    } catch (error) {
      this._publishEvent('SandboxFailed', context, { state: SandboxState.FAILED, error: error.message });
      throw error;
    } finally {
      await this.cleanup(context, isSuccess);
    }
  }

  async streamLogs(context) {
    // Local execution logs are already handled by context.logger.
    return null;
  }

  async cleanup(context, isSuccess) {
    this._publishEvent('SandboxDestroyed', context, { state: SandboxState.DESTROYED });
    await this.workspaceManager.cleanup(context, isSuccess);
  }
}

module.exports = LocalSandboxProvider;
