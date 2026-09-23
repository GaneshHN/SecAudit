const https = require('https');
const http = require('http');
const { TIMEOUTS, MAX_FILE_SIZE_BYTES } = require('../../../config/constants');

/**
 * Single Responsibility: Fetching & downloading Git repositories over HTTP/HTTPS.
 */
class RepositoryLoader {
  constructor(options = {}) {
    this.timeoutMs = options.timeoutMs || TIMEOUTS.DOWNLOAD_MS;
    this.maxSizeBytes = options.maxSizeBytes || MAX_FILE_SIZE_BYTES;
    this.userAgent = options.userAgent || 'SecAudit-Scanner/2.0';
  }

  /**
   * Download remote archive file into memory buffer.
   * @param {string} url 
   * @param {number} redirectCount 
   * @returns {Promise<Buffer>}
   */
  downloadFile(url, redirectCount = 0) {
    return new Promise((resolve, reject) => {
      if (redirectCount > 5) return reject(new Error('Too many redirects'));

      const client = url.startsWith('https') ? https : http;

      const req = client.get(
        url,
        { headers: { 'User-Agent': this.userAgent }, timeout: this.timeoutMs },
        (res) => {
          if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
            res.resume();
            return resolve(this.downloadFile(res.headers.location, redirectCount + 1));
          }

          if (res.statusCode !== 200) {
            res.resume();
            return reject(new Error(`Download failed with status ${res.statusCode}`));
          }

          let totalBytes = 0;
          const chunks = [];

          res.on('data', (chunk) => {
            totalBytes += chunk.length;
            if (totalBytes > this.maxSizeBytes) {
              res.destroy();
              return reject(new Error(`Download exceeds ${this.maxSizeBytes / 1024 / 1024}MB limit`));
            }
            chunks.push(chunk);
          });

          res.on('end', () => resolve(Buffer.concat(chunks, totalBytes)));
          res.on('error', reject);
        }
      );

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Download timed out'));
      });

      req.on('error', reject);
    });
  }

  /**
   * Determine downloadable ZIP target URL for GitHub, GitLab, Bitbucket.
   * @param {string} repoUrl 
   * @param {string} host 
   * @returns {{ primary: string, fallback: string|null }}
   */
  getZipUrl(repoUrl, host) {
    const cleaned = repoUrl.trim().replace(/\.git$/, '').replace(/\/$/, '');

    if (host.includes('github.com')) {
      const treeMatch = cleaned.match(/github\.com\/([^/]+)\/([^/]+)\/tree\/(.+)/);
      if (treeMatch) {
        const [, owner, repo, branch] = treeMatch;
        return { primary: `https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.zip`, fallback: null };
      }
      const repoMatch = cleaned.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (repoMatch) {
        const [, owner, repo] = repoMatch;
        return {
          primary: `https://github.com/${owner}/${repo}/archive/refs/heads/main.zip`,
          fallback: `https://github.com/${owner}/${repo}/archive/refs/heads/master.zip`,
        };
      }
    }

    if (host.includes('gitlab')) {
      const match = cleaned.match(/gitlab\.[^/]+\/(.+)/);
      if (match) {
        const projectPath = match[1];
        const name = projectPath.split('/').pop();
        return {
          primary: `https://${host}/${projectPath}/-/archive/main/${name}-main.zip`,
          fallback: `https://${host}/${projectPath}/-/archive/master/${name}-master.zip`,
        };
      }
    }

    if (host.includes('bitbucket')) {
      const match = cleaned.match(/bitbucket\.org\/([^/]+)\/([^/]+)/);
      if (match) {
        const [, owner, repo] = match;
        return {
          primary: `https://bitbucket.org/${owner}/${repo}/get/main.zip`,
          fallback: `https://bitbucket.org/${owner}/${repo}/get/master.zip`,
        };
      }
    }

    throw new Error('Could not determine download URL. Supported: GitHub, GitLab, Bitbucket.');
  }

  /**
   * Fetch repo buffer from remote URL.
   * @param {string} repoUrl 
   * @param {string} host 
   * @returns {Promise<Buffer>}
   */
  async fetchRepoBuffer(repoUrl, host) {
    const { primary, fallback } = this.getZipUrl(repoUrl, host);
    try {
      return await this.downloadFile(primary);
    } catch (err) {
      if (fallback) {
        return await this.downloadFile(fallback);
      }
      throw err;
    }
  }
}

module.exports = RepositoryLoader;
