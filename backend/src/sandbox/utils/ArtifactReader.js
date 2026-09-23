const path = require('path');
const SandboxExecutionResult = require('../models/SandboxExecutionResult');
const SecureFilesystem = require('./SecureFilesystem');

class ArtifactReader {
  /**
   * Reads execution artifacts from a workspace.
   * @param {string} workspacePath 
   * @returns {Promise<SandboxExecutionResult>}
   */
  static async readArtifacts(workspacePath) {
    const artifactsDir = SecureFilesystem.resolveSecurePath(workspacePath, 'artifacts');
    let report = null;
    let logs = [];
    let metadata = {};
    let exitCode = 0;
    let error = null;

    try {
      const reportPath = SecureFilesystem.resolveSecurePath(artifactsDir, 'report.json');
      const data = await require('fs/promises').readFile(reportPath, 'utf8');
      report = JSON.parse(data);
    } catch (e) {
      error = 'Failed to read report.json: ' + e.message;
    }

    try {
      const logsPath = SecureFilesystem.resolveSecurePath(artifactsDir, 'logs.json');
      const data = await require('fs/promises').readFile(logsPath, 'utf8');
      logs = JSON.parse(data);
    } catch (e) {
      // Optional
    }

    try {
      const metaPath = SecureFilesystem.resolveSecurePath(workspacePath, '.secaudit-metadata.json');
      const data = await require('fs/promises').readFile(metaPath, 'utf8');
      metadata = JSON.parse(data);
    } catch (e) {
      // Optional
    }

    try {
      const exitPath = SecureFilesystem.resolveSecurePath(artifactsDir, 'exit.json');
      const data = await require('fs/promises').readFile(exitPath, 'utf8');
      const exitData = JSON.parse(data);
      exitCode = exitData.exitCode || 0;
      if (exitData.error) error = exitData.error;
    } catch (e) {
      // Optional
    }

    return new SandboxExecutionResult({
      report,
      logs,
      metadata,
      exitCode,
      error
    });
  }
}

module.exports = ArtifactReader;
