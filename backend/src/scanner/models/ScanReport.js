/**
 * Standardized Scan Report Model.
 * Aggregates findings and ensures backward compatibility.
 */
class ScanReport {
  constructor(totalFilesScanned, durationSeconds) {
    this.totalFilesScanned = totalFilesScanned;
    this.scanTime = `${durationSeconds}s`;
    this.issues = [];
    this.score = 100;
    this.summary = { high: 0, medium: 0, low: 0 };
    
    // Configurable severity weights
    this.severityWeights = { High: 20, Medium: 10, Low: 5 };
  }

  addFindings(findings) {
    this.issues.push(...findings);
  }

  finalize() {
    // Sort by severity (High -> Medium -> Low)
    const severityOrder = { High: 0, Medium: 1, Low: 2, Informational: 3 };
    this.issues.sort((a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4));

    // Calculate Summary and Score
    let penalty = 0;
    this.summary = { high: 0, medium: 0, low: 0 };
    
    for (const issue of this.issues) {
      if (issue.severity === 'High') this.summary.high++;
      else if (issue.severity === 'Medium') this.summary.medium++;
      else if (issue.severity === 'Low') this.summary.low++;
      
      penalty += this.severityWeights[issue.severity] || 0;
    }

    this.score = Math.max(0, Math.min(100, 100 - penalty));
  }

  // To remain 100% backward compatible with the current JSON format
  toJSON() {
    return {
      score: this.score,
      summary: this.summary,
      totalIssues: this.issues.length,
      filesScanned: this.totalFilesScanned,
      scanTime: this.scanTime,
      message: `Scanned ${this.totalFilesScanned} files in ${this.scanTime}`,
      issues: this.issues.map(i => i.toJSON()),
    };
  }
}

module.exports = ScanReport;
