const fs = require('fs/promises');
const path = require('path');
const IScanResultWriter = require('./IScanResultWriter');
const SecureFilesystem = require('../../sandbox/utils/SecureFilesystem');

class ArtifactScanResultWriter extends IScanResultWriter {
  async write(context, report) {
    if (!context.workspace) {
      throw new Error('ArtifactScanResultWriter requires a valid workspace path in the context.');
    }
    const artifactsDir = SecureFilesystem.resolveSecurePath(context.workspace, 'artifacts');
    await fs.mkdir(artifactsDir, { recursive: true });
    
    const reportPath = SecureFilesystem.resolveSecurePath(artifactsDir, 'report.json');
    const reportTmpPath = path.join(artifactsDir, 'report.json.tmp');
    await fs.writeFile(reportTmpPath, JSON.stringify(report, null, 2));
    await fs.rename(reportTmpPath, reportPath);

    // Exit state or metadata can be added as needed by the runner.
  }
}

module.exports = ArtifactScanResultWriter;
