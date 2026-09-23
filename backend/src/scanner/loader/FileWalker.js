const fs = require('fs/promises');
const path = require('path');
const fileUtils = require('../../../utils/fileUtils');

const DEFAULT_IGNORED_DIRS = fileUtils.IGNORED_DIRS || new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '__pycache__',
  '.venv', 'venv', '.cache', 'coverage', '.nyc_output', 'vendor',
]);

const DEFAULT_BINARY_EXTENSIONS = fileUtils.BINARY_EXTENSIONS || new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg', '.webp',
  '.mp3', '.mp4', '.avi', '.mov', '.pdf', '.zip', '.tar', '.gz',
  '.exe', '.dll', '.so', '.dylib', '.bin', '.db', '.sqlite',
]);

const DEFAULT_PRIORITY_EXTENSIONS = fileUtils.PRIORITY_EXTENSIONS || new Set([
  '.js', '.ts', '.jsx', '.tsx', '.py', '.rb', '.php',
  '.java', '.go', '.rs', '.c', '.cpp', '.h', '.cs',
  '.env', '.sh', '.bash', '.yml', '.yaml', '.toml',
  '.json', '.xml', '.tf', '.hcl', '.html', '.sql',
]);

const MAX_FILE_SIZE = fileUtils.MAX_FILE_SIZE || 1 * 1024 * 1024;
const MAX_FILES = fileUtils.MAX_FILES || 5000;

/**
 * Single Responsibility: File discovery, filtering, and concurrent file content loading.
 */
class FileWalker {
  constructor(options = {}) {
    this.concurrency = options.concurrency || 100;
    this.maxFileSize = options.maxFileSize || MAX_FILE_SIZE;
    this.maxFiles = options.maxFiles || MAX_FILES;
    this.ignoredDirs = options.ignoredDirs || DEFAULT_IGNORED_DIRS;
    this.binaryExtensions = options.binaryExtensions || DEFAULT_BINARY_EXTENSIONS;
    this.priorityExtensions = options.priorityExtensions || DEFAULT_PRIORITY_EXTENSIONS;
    this.maxTotalSize = options.maxTotalSize || null;
    this.totalSizeRead = 0;
  }

  /**
   * Recursively discover scannable files within a directory.
   * Priority files are returned first.
   * @param {string} dirPath 
   * @returns {Promise<Array<string>>}
   */
  async getScannableFiles(dirPath) {
    const priorityFiles = [];
    const otherFiles = [];
    let fileCount = 0;

    const self = this;

    async function walk(currentDir) {
      if (fileCount >= self.maxFiles) return;

      let entries;
      try {
        entries = await fs.readdir(currentDir, { withFileTypes: true });
      } catch {
        return;
      }

      const subdirTasks = [];

      for (const entry of entries) {
        if (fileCount >= self.maxFiles) break;

        const name = entry.name;
        
        if (entry.isSymbolicLink()) {
          continue; // Skip symlinks deterministically for security
        }

        if (entry.isDirectory()) {
          if (!self.ignoredDirs.has(name) && name[0] !== '.') {
            subdirTasks.push(walk(path.join(currentDir, name)));
          }
        } else if (entry.isFile()) {
          const ext = path.extname(name).toLowerCase();
          if (self.binaryExtensions.has(ext)) continue;

          const fullPath = path.join(currentDir, name);
          fileCount++;

          if (self.priorityExtensions.has(ext) || name === 'Dockerfile' || name === '.env') {
            priorityFiles.push(fullPath);
          } else {
            otherFiles.push(fullPath);
          }
        }
      }

      if (subdirTasks.length > 0) {
        await Promise.all(subdirTasks);
      }
    }

    await walk(dirPath);
    return priorityFiles.concat(otherFiles);
  }

  /**
   * Read file content safely, skipping binaries and oversized files.
   * @param {string} filePath 
   * @returns {Promise<{ content: string, lines: Array<string> } | null>}
   */
  async readFileSafe(filePath) {
    try {
      const stats = await fs.stat(filePath);

      if (stats.size > this.maxFileSize || stats.size === 0) return null;
      
      if (this.maxTotalSize) {
        if (this.totalSizeRead + stats.size > this.maxTotalSize) {
          return null; // Exceeded total disk allowance
        }
        this.totalSizeRead += stats.size;
      }

      const buffer = await fs.readFile(filePath);

      // Null byte detection in first 512 bytes for binary check
      const sample = buffer.subarray(0, 512);
      if (sample.includes(0x00)) return null;

      const content = buffer.toString('utf-8');
      return { content, lines: content.split('\n') };
    } catch {
      return null;
    }
  }

  /**
   * Batch read file contexts for scannable files in projectDir.
   * @param {string} projectDir 
   * @param {number} timeoutMs 
   * @returns {Promise<Array<Object>>} Array of file contexts
   */
  async loadFileContexts(projectDir, timeoutMs = 60000) {
    const files = await this.getScannableFiles(projectDir);
    const contexts = [];
    const t0 = performance.now();
    const deadline = t0 + timeoutMs;

    for (let i = 0; i < files.length; i += this.concurrency) {
      if (performance.now() > deadline) {
        break;
      }

      const batch = files.slice(i, i + this.concurrency);
      const batchReads = await Promise.all(
        batch.map(async (filePath) => {
          const fileData = await this.readFileSafe(filePath);
          if (!fileData) return null;
          return {
            filePath,
            content: fileData.content,
            lines: fileData.lines,
            relativePath: path.relative(projectDir, filePath).replace(/\\/g, '/'),
            projectDir,
          };
        })
      );

      contexts.push(...batchReads.filter(Boolean));
    }

    return contexts;
  }
}

module.exports = FileWalker;
