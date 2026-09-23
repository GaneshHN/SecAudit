const fs = require('fs').promises;
const path = require('path');
const { defaultEventBus } = require('../../events/LocalEventBus');
const { createSandboxEvent, SANDBOX_EVENTS } = require('../events/SandboxEvents');

class SandboxResourceMonitor {
  /**
   * @param {SandboxContext} context
   */
  constructor(context, pollIntervalMs = 5000) {
    this.context = context;
    this.pollIntervalMs = pollIntervalMs;
    this.timer = null;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(async () => {
      try {
        await this.checkDiskUsage();
      } catch (err) {
        this.context.logger.error(`[SandboxResourceMonitor] Error monitoring resources: ${err.message}`);
      }
    }, this.pollIntervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async checkDiskUsage() {
    const policy = this.context.configuration.resourcePolicy;
    if (!policy || !policy.diskMb) return;
    if (!this.context.workspace) return;
    if (this.context.cancellationToken?.isCancelled) return;

    const sizeBytes = await this.getDirSize(this.context.workspace);
    const sizeMb = sizeBytes / (1024 * 1024);

    if (sizeMb > policy.diskMb) {
      this._publishEvent(SANDBOX_EVENTS.RESOURCE_EXCEEDED, { 
        resource: 'disk', 
        usageMb: sizeMb, 
        limitMb: policy.diskMb 
      });

      if (this.context.cancellationToken) {
        this.context.cancellationToken.cancel('DISK_LIMIT');
      }
    } else if (sizeMb > policy.diskMb * 0.9) {
      this._publishEvent(SANDBOX_EVENTS.RESOURCE_WARNING, { 
        resource: 'disk', 
        usageMb: sizeMb, 
        limitMb: policy.diskMb 
      });
    }
  }

  async getDirSize(dirPath) {
    let totalSize = 0;
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          totalSize += await this.getDirSize(fullPath);
        } else if (entry.isFile()) {
          const stats = await fs.stat(fullPath);
          totalSize += stats.size;
        }
      }
    } catch (e) {
      // ignore errors like ENOENT if file deleted during traversal
    }
    return totalSize;
  }

  _publishEvent(eventName, details = {}) {
    defaultEventBus.publish(createSandboxEvent(eventName, this.context, details));
  }
}

module.exports = SandboxResourceMonitor;
