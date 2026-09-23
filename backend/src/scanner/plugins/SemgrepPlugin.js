const ScannerPlugin = require('../core/ScannerPlugin');

/**
 * Extensible Plugin Wrapper for Semgrep integration.
 * Demonstrates Open/Closed Principle: Can be enabled/configured without altering ScannerEngine.
 */
class SemgrepPlugin extends ScannerPlugin {
  constructor(options = {}) {
    super('semgrep-v1', 'Semgrep SAST Plugin', '1.0.0');
    this.binaryPath = options.binaryPath || 'semgrep';
    this.enabled = options.enabled ?? false;
  }

  async initialize() {
    // Verification of semgrep binary or config setup
  }

  async scan(context) {
    if (!this.enabled) return [];
    // Integration logic for semgrep SAST rules execution
    return [];
  }
}

module.exports = SemgrepPlugin;
