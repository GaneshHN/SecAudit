const IScanResultWriter = require('./IScanResultWriter');
const Scan = require('../../../models/Scan');

class DatabaseScanResultWriter extends IScanResultWriter {
  async write(context, report) {
    if (context.job.userId) {
      await Scan.create({
        jobId: context.job.id,
        userId: context.job.userId,
        repoUrl: context.repository,
        totalIssues: report.totalIssues,
        highCount: report.summary?.high || 0,
        mediumCount: report.summary?.medium || 0,
        lowCount: report.summary?.low || 0,
        securityScore: report.score,
        results: report.issues || [],
      });
    }
  }
}

module.exports = DatabaseScanResultWriter;
