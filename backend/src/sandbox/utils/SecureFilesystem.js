const path = require('path');
const fs = require('fs/promises');

class SecureFilesystem {
  /**
   * Resolves a target path against a root directory and guarantees it remains inside the root.
   * Throws an error if the path attempts to escape the root via traversal or absolute path injection.
   * Also rejects paths containing null bytes.
   * 
   * @param {string} rootPath - The absolute, canonical path to the root directory (e.g. workspace)
   * @param {string} targetPath - The untrusted relative or absolute path
   * @returns {string} The fully resolved, secure absolute path
   */
  static resolveSecurePath(rootPath, targetPath) {
    if (typeof targetPath !== 'string' || typeof rootPath !== 'string') {
      throw new Error('SecureFilesystem: Paths must be strings.');
    }

    // Reject null bytes immediately
    if (targetPath.includes('\0') || rootPath.includes('\0')) {
      throw new Error('SecureFilesystem: Null byte detected in path.');
    }

    // Resolve the root to ensure it is absolute and normalized
    const canonicalRoot = path.resolve(rootPath);
    
    // Resolve the target relative to the canonical root
    // path.resolve will automatically handle mixed separators, decode (if applied prior), and ../
    const canonicalTarget = path.resolve(canonicalRoot, targetPath);

    // Enforce the boundary
    // We add path.sep to the root to ensure `/workspace/job1` doesn't match `/workspace/job10`
    const rootPrefix = canonicalRoot.endsWith(path.sep) ? canonicalRoot : canonicalRoot + path.sep;
    
    // Exact match is allowed (e.g., target is the root itself)
    if (canonicalTarget !== canonicalRoot && !canonicalTarget.startsWith(rootPrefix)) {
      throw new Error(`SecureFilesystem: Path traversal detected! Target path escapes root directory.`);
    }

    return canonicalTarget;
  }

  /**
   * Deterministically verifies that a file path (which might be a symlink) resolves to a physical location
   * strictly within the rootPath.
   * 
   * @param {string} rootPath - The absolute, canonical path to the root directory
   * @param {string} targetPath - The resolved target path to check
   * @returns {Promise<boolean>} True if safe, false if it escapes (or fails to resolve)
   */
  static async isSymlinkSafe(rootPath, targetPath) {
    try {
      const canonicalRoot = path.resolve(rootPath);
      // fs.realpath resolves symlinks to their physical location
      const realPath = await fs.realpath(targetPath);
      
      const rootPrefix = canonicalRoot.endsWith(path.sep) ? canonicalRoot : canonicalRoot + path.sep;
      return realPath === canonicalRoot || realPath.startsWith(rootPrefix);
    } catch (err) {
      // If the file doesn't exist, it's technically not an escaping symlink yet.
      // But typically we validate existing files. We return false for safety if it fails to resolve.
      return false;
    }
  }
}

module.exports = SecureFilesystem;
