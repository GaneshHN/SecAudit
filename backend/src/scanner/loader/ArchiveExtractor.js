const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const AdmZip = require('adm-zip');

/**
 * Single Responsibility: Extracting & unwrapping archive files into temporary workspaces.
 */
class ArchiveExtractor {
  /**
   * Generates a unique temporary directory path.
   * @returns {string}
   */
  static getTempDir() {
    const id = crypto.randomBytes(8).toString('hex');
    return path.join(os.tmpdir(), `secaudit-${id}`);
  }

  /**
   * Extract ZIP buffer to target directory and unwrap single root directory if present.
   * @param {Buffer} buffer 
   * @param {string} tempDir 
   * @returns {Promise<string>} Path to extracted root
   */
  static async extractZipBuffer(buffer, tempDir = null) {
    const targetDir = tempDir || ArchiveExtractor.getTempDir();
    const SecureArchiveExtractor = require('./SecureArchiveExtractor');
    return SecureArchiveExtractor.extract(buffer, targetDir);
  }

  /**
   * Extract uploaded file archive.
   * @param {string} filePath 
   * @returns {Promise<string>} Path to extracted workspace directory
   */
  static async extractUploadedArchive(filePath) {
    const buffer = await fs.readFile(filePath);
    return ArchiveExtractor.extractZipBuffer(buffer);
  }

  /**
   * Place single uploaded file into a workspace directory.
   * @param {string} filePath 
   * @param {string} originalName 
   * @returns {Promise<string>}
   */
  static async placeSingleFile(filePath, originalName) {
    const tempDir = ArchiveExtractor.getTempDir();
    await fs.mkdir(tempDir, { recursive: true });
    await fs.copyFile(filePath, path.join(tempDir, originalName));
    return tempDir;
  }

  /**
   * Clean up workspace directory.
   * @param {string} dirPath 
   */
  static async cleanup(dirPath) {
    try {
      await fs.rm(dirPath, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup
    }
  }
}

module.exports = ArchiveExtractor;
