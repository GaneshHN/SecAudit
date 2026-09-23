const ScannerPlugin = require('../core/ScannerPlugin');

/**
 * Extensible Plugin Wrapper for Trivy Dependency & Vulnerability Scanner.
 * Demonstrates Open/Closed Principle: Can be enabled/configured without altering ScannerEngine.
 */
class TrivyPlugin extends ScannerPlugin {
  constructor(options = {}) {
    super('trivy-v1', 'Trivy Dependency Scanner Plugin', '1.0.0');
    this.binaryPath = options.binaryPath || 'trivy';
    this.enabled = options.enabled ?? false;
  }

  async initialize() {
    // Verification of trivy binary or config setup
  }

  async scan(context) {
    if (!this.enabled) return [];
    // Integration logic for trivy dependency scan
    return [];
  }
}

module.exports = TrivyPlugin;
