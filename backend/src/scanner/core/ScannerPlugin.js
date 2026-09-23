/**
 * Base Interface/Class for all Detection Plugins.
 * Follows the Open/Closed Principle (OCP). New scanners just extend this class.
 */
class ScannerPlugin {
  constructor(id, name, version = '1.0.0') {
    if (!id || !name) {
      throw new Error('ScannerPlugin requires id and name');
    }
    this.id = id;
    this.name = name;
    this.version = version;
    this.enabled = true;
  }

  /**
   * Initializes the plugin (loading rules, initializing models, downloading binaries, etc.).
   */
  async initialize() {
    // To be implemented by subclasses if initialization steps are required
  }

  /**
   * Runs the plugin against the provided context.
   * @param {Object} context - File/project context object (filePath, content, lines, relativePath, projectDir, etc.)
   * @returns {Promise<Array<Finding>>} - Array of Findings.
   */
  async scan(context) {
    throw new Error(`ScannerPlugin subclass '${this.constructor.name}' must implement scan()`);
  }
}

module.exports = ScannerPlugin;
