const fs = require('fs/promises');
const path = require('path');
const AdmZip = require('adm-zip');
const SecureFilesystem = require('../../sandbox/utils/SecureFilesystem');

/**
 * Securely extracts archives, preventing Zip Slip and Symlink vulnerabilities.
 */
class SecureArchiveExtractor {
  /**
   * Extract ZIP buffer to target directory safely.
   * Rejects archives that attempt to escape the workspace or use unsafe features.
   * @param {Buffer} buffer 
   * @param {string} targetDir 
   * @returns {Promise<string>} Path to extracted root
   */
  static async extract(buffer, targetDir) {
    await fs.mkdir(targetDir, { recursive: true });

    const zip = new AdmZip(buffer);
    const zipEntries = zip.getEntries();
    
    // First, validate all entries to prevent partial extraction of a malicious archive
    for (const entry of zipEntries) {
      try {
        // This will throw if the entry name attempts directory traversal (Zip Slip)
        // or uses absolute paths or null bytes.
        SecureFilesystem.resolveSecurePath(targetDir, entry.entryName);
      } catch (err) {
        throw new Error(`SecureArchiveExtractor: Malicious archive entry detected: ${entry.entryName}`);
      }
      
      // We skip symlink entries outright. We don't want to create symlinks 
      // in the workspace that could later point outside.
      // AdmZip has entry.isDirectory, but checking for symlink is bitwise.
      // entry.header.attr >> 16 & 0xA000 indicates a symlink, but a simpler
      // cross-platform heuristic or explicit check isn't strictly necessary if 
      // we just refuse to create symlinks.
      // Since AdmZip `extractAllTo` might create them, we are doing it manually.
      // We'll write the files ourselves.
    }

    // Now securely write the entries
    for (const entry of zipEntries) {
      if (entry.isDirectory) {
        continue;
      }

      // We do not extract symlinks to prevent Symlink Escape
      const isSymlink = ((entry.header.attr >> 16) & 0o170000) === 0o120000;
      if (isSymlink) {
        continue; // Skip symlinks deterministically
      }

      const entryTargetPath = SecureFilesystem.resolveSecurePath(targetDir, entry.entryName);
      
      // Ensure directory exists
      await fs.mkdir(path.dirname(entryTargetPath), { recursive: true });
      
      // Write the file
      await fs.writeFile(entryTargetPath, entry.getData());
    }

    // GitHub/GitLab ZIPs have a single root folder — unwrap it if present
    const entries = await fs.readdir(targetDir, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory());
    return dirs.length === 1 ? path.join(targetDir, dirs[0].name) : targetDir;
  }
}

module.exports = SecureArchiveExtractor;
