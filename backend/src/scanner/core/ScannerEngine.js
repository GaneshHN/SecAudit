const ReportGenerator = require('./ReportGenerator');

/**
 * Core Scanner Engine.
 * Follows the Open/Closed Principle (OCP):
 * - Open for extension: new scanner plugins can be registered without modifying this engine.
 * - Closed for modification: the execution pipeline and reporting logic stay invariant.
 */
class ScannerEngine {
  constructor() {
    this.plugins = [];
  }

  /**
   * Register a new detection plugin.
   * @param {ScannerPlugin} plugin 
   */
  registerPlugin(plugin) {
    if (!plugin || typeof plugin.scan !== 'function') {
      throw new Error('Invalid plugin: plugin must implement scan() method.');
    }
    this.plugins.push(plugin);
    return this;
  }

  /**
   * Initialize all registered plugins concurrently.
   */
  async initialize() {
    await Promise.all(
      this.plugins.map(async (plugin) => {
        if (plugin.enabled && typeof plugin.initialize === 'function') {
          await plugin.initialize();
        }
      })
    );
  }

  /**
   * Executes all enabled registered plugins against a single context.
   * @param {Object} context - File or project context object
   * @returns {Promise<Array<Finding>>}
   */
  async scanContext(context) {
    const findings = [];
    for (const plugin of this.plugins) {
      if (!plugin.enabled) continue;
      try {
        const result = await plugin.scan(context);
        if (result && Array.isArray(result) && result.length > 0) {
          findings.push(...result);
        }
      } catch (err) {
        console.error(`[ScannerEngine] Plugin '${plugin.name}' error on ${context.relativePath || context.filePath}:`, err);
      }
    }
    return findings;
  }

  /**
   * Run the full engine pipeline on a batch of file contexts.
   * @param {Array<Object>} contexts 
   * @param {number|string} durationSeconds
   * @returns {Object} 100% backward-compatible scan report JSON
   */
  async generateReport(contexts, durationSeconds) {
    const allFindings = [];

    // Run scans concurrently across contexts
    const scanPromises = contexts.map((ctx) => this.scanContext(ctx));
    const results = await Promise.all(scanPromises);

    for (const fileFindings of results) {
      allFindings.push(...fileFindings);
    }

    return ReportGenerator.generateReport(allFindings, contexts.length, durationSeconds);
  }
}

module.exports = ScannerEngine;
