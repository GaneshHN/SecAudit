const ScanReport = require('../models/ScanReport');

/**
 * Single Responsibility: Aggregates findings and generates JSON reports.
 */
class ReportGenerator {
  /**
   * Generates a backward-compatible scan report.
   * @param {Array<Finding>} findings - List of findings collected by plugins
   * @param {number} totalFilesScanned - Count of scannable files scanned
   * @param {number|string} durationSeconds - Scan duration in seconds
   * @returns {Object} 100% backward compatible report JSON payload
   */
  static generateReport(findings, totalFilesScanned, durationSeconds) {
    const report = new ScanReport(totalFilesScanned, durationSeconds);
    report.addFindings(findings || []);
    report.finalize();
    return report.toJSON();
  }
}

module.exports = ReportGenerator;
