const ScannerPlugin = require('../core/ScannerPlugin');

/**
 * Extensible Plugin Wrapper for Docker & Containerfile Security Scanner.
 * Demonstrates Open/Closed Principle: Can be enabled/configured without altering ScannerEngine.
 */
class DockerScannerPlugin extends ScannerPlugin {
  constructor(options = {}) {
    super('docker-scanner-v1', 'Docker & Container Security Plugin', '1.0.0');
    this.enabled = options.enabled ?? true;
  }

  async scan(context) {
    if (!this.enabled) return [];
    const { filePath, relativePath } = context;
    if (!filePath || (!relativePath.endsWith('Dockerfile') && !relativePath.endsWith('docker-compose.yml'))) {
      return [];
    }
    // Dockerfile specific security checks can be added here
    return [];
  }
}

module.exports = DockerScannerPlugin;
