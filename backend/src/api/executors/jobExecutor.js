const { fetchAndExtractRepo, extractUploadedArchive, placeSingleFile, cleanup } = require('../../../utils/services/repoService');
const { runScan } = require('../../../utils/services/scannerService');
const { scanUrl } = require('../../../utils/services/urlScannerService');
const path = require('path');
const fs = require('fs/promises');

// Note: Ensure Job is marked running, etc. 
// For now, this just wraps the old scan logic so it executes async inside the queue worker.
async function handleJobExecution(job) {
  let projectDir = null;
  const repoUrl = job.repository;
  const file = job.metadata.file; // if uploaded file

  try {
    if (repoUrl && classifyUrl(repoUrl) === 'url') {
      const results = await scanUrl(repoUrl);
      return results;
    }

    if (repoUrl) {
      const normalized = normalizeGitUrl(repoUrl);
      if (!normalized) throw new Error('Invalid Git URL');
      projectDir = await fetchAndExtractRepo(normalized.url, normalized.host);
    } else if (file) {
      const ext = path.extname(file.originalname).toLowerCase();
      const isArchive = ['.zip', '.tar', '.gz', '.tgz', '.rar', '.7z', '.bz2'].includes(ext) || file.originalname.toLowerCase().endsWith('.tar.gz');
      
      if (isArchive) {
        projectDir = await extractUploadedArchive(file.path);
      } else {
        projectDir = await placeSingleFile(file.path, file.originalname);
      }
      await fs.unlink(file.path).catch(() => {});
    }

    if (!projectDir && !repoUrl) {
        throw new Error("No repository or file provided for scan");
    }

    const results = await runScan(projectDir);
    return results;
  } finally {
    if (projectDir) {
      const parts = projectDir.split('secaudit-');
      const parentDir = parts.length > 1 ? parts[0] + 'secaudit-' + parts[1].split(/[/\\]/)[0] : projectDir;
      await cleanup(parentDir);
    }
  }
}

function classifyUrl(rawUrl) {
  const url = rawUrl.trim();
  if (/^git@/.test(url)) return 'repo';
  if (/^[\w.-]+\/[\w.-]+$/.test(url) && !url.includes('.')) return 'repo';
  if (url.endsWith('.git')) return 'repo';
  try {
    let checkUrl = url;
    if (!/^https?:\/\//.test(checkUrl)) checkUrl = 'https://' + checkUrl;
    const parsed = new URL(checkUrl);
    const host = parsed.hostname.toLowerCase();
    const GIT_HOSTS = ['github.com', 'gitlab.com', 'gitlab.', 'bitbucket.org'];
    if (GIT_HOSTS.some(gh => host.includes(gh))) {
      const pathParts = parsed.pathname.split('/').filter(Boolean);
      if (pathParts.length >= 2) return 'repo';
    }
  } catch {}
  return 'url';
}

function normalizeGitUrl(rawUrl) {
  let url = rawUrl.trim();
  const sshMatch = url.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
  if (sshMatch) return { url: 'https://' + sshMatch[1] + '/' + sshMatch[2], host: sshMatch[1] };
  const shortMatch = url.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (shortMatch) return { url: 'https://github.com/' + shortMatch[1] + '/' + shortMatch[2], host: 'github.com' };
  try {
    let checkUrl = url;
    if (!/^https?:\/\//.test(checkUrl)) checkUrl = 'https://' + checkUrl;
    const parsed = new URL(checkUrl);
    return { url: checkUrl.replace(/\.git$/, '').replace(/\/$/, ''), host: parsed.hostname };
  } catch {
    return null;
  }
}

module.exports = { handleJobExecution };
