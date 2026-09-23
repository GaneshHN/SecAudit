const fs = require('fs/promises');
const path = require('path');
const SecureFilesystem = require('./SecureFilesystem');

class SandboxReaper {
  constructor(config) {
    this.workspaceRoot = config.workspaceRoot;
  }

  async runReaper() {
    let reapedCount = 0;
    try {
      const items = await fs.readdir(this.workspaceRoot, { withFileTypes: true });
      for (const item of items) {
        if (!item.isDirectory() || !item.name.startsWith('secaudit-ws-')) {
          continue;
        }

        const workspacePath = path.join(this.workspaceRoot, item.name);
        if (await this._shouldReap(workspacePath)) {
          try {
            // Strict boundary check before deletion
            SecureFilesystem.resolveSecurePath(this.workspaceRoot, workspacePath);
            await fs.rm(workspacePath, { recursive: true, force: true });
            reapedCount++;
          } catch (e) {
            // Log error, continue safely
          }
        }
      }
    } catch (e) {
      if (e.code !== 'ENOENT') {
        throw e;
      }
    }
    return reapedCount;
  }

  async _shouldReap(workspacePath) {
    const metaPath = path.join(workspacePath, '.secaudit-metadata.json');
    let metadata;
    try {
      const data = await fs.readFile(metaPath, 'utf8');
      metadata = JSON.parse(data);
    } catch (e) {
      // Missing or malformed metadata -> DO NOT reap arbitrarily to prevent destroying non-sandbox data
      return false;
    }

    if (!metadata || !metadata.jobId || !metadata.expirationTime) {
      return false;
    }

    const expTime = new Date(metadata.expirationTime).getTime();
    if (isNaN(expTime)) {
      return false;
    }

    // Only reap if expiration time has passed
    return Date.now() > expTime;
  }
}

module.exports = SandboxReaper;
