const SandboxReaper = require('./SandboxReaper');
const { logger } = require('../../logging/logger');

/**
 * SandboxReaperScheduler
 * Periodically invokes the SandboxReaper to ensure orphan cleanup.
 * Prevents overlapping executions.
 */
class SandboxReaperScheduler {
  constructor(options = {}) {
    this.intervalMs = options.intervalMs || 10 * 60 * 1000; // 10 minutes default
    this.workspaceRoot = options.workspaceRoot || process.env.WORKSPACE_ROOT || '/tmp/secaudit-workspaces';
    
    this.timer = null;
    this.isRunning = false;
  }

  start() {
    if (this.timer) {
      return; // Already started, idempotent
    }
    
    logger.info(`SandboxReaperScheduler started. Interval: ${this.intervalMs}ms, Root: ${this.workspaceRoot}`);
    
    this.timer = setInterval(async () => {
      await this.runNow();
    }, this.intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('SandboxReaperScheduler stopped.');
    }
  }

  async runNow() {
    if (this.isRunning) {
      logger.warn('SandboxReaperScheduler skipped execution: Previous run still active.');
      return;
    }

    this.isRunning = true;
    try {
      const reaper = new SandboxReaper(this.workspaceRoot);
      const reapedCount = await reaper.runReaper();
      if (reapedCount > 0) {
        logger.info(`SandboxReaperScheduler completed. Reaped ${reapedCount} workspaces.`);
      }
    } catch (err) {
      logger.error('SandboxReaperScheduler encountered an error:', { error: err.message });
    } finally {
      this.isRunning = false;
    }
  }
}

module.exports = { SandboxReaperScheduler };
