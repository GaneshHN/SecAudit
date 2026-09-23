const path = require('path');
const IScanExecutor = require('./IScanExecutor');
const RepositoryLoader = require('../scanner/loader/RepositoryLoader');
const ArchiveExtractor = require('../scanner/loader/ArchiveExtractor');
const FileWalker = require('../scanner/loader/FileWalker');
const ScannerEngine = require('../scanner/core/ScannerEngine');
const RegexScannerPlugin = require('../scanner/plugins/RegexScannerPlugin');
const SecretDetectorPlugin = require('../scanner/plugins/SecretDetectorPlugin');
const InsecureCodePlugin = require('../scanner/plugins/InsecureCodePlugin');
const DockerScannerPlugin = require('../scanner/plugins/DockerScannerPlugin');
const Scan = require('../../models/Scan');
const { JobStage } = require('../jobs/JobStage');

const DatabaseScanResultWriter = require('./writers/DatabaseScanResultWriter');

class LocalScanExecutor extends IScanExecutor {
  constructor(options = {}) {
    super();
    this.scanTimeoutMs = options.scanTimeoutMs || 60000;
    this.resultWriter = options.resultWriter || new DatabaseScanResultWriter();
  }

  async execute(context) {
    let projectDir = null;
    const t0 = performance.now();

    try {
      context.cancellationToken?.throwIfCancelled();

      // Step 1: Repository Download / Archive Extraction
      context.reportProgress(JobStage.DOWNLOADING);

      const target = context.repository;
      if (!target) {
        throw new Error('Invalid scan target: repository target is empty');
      }

      if (target.startsWith('http://') || target.startsWith('https://') || target.startsWith('git@')) {
        const repoLoader = new RepositoryLoader();
        const parsedUrl = new URL(target.startsWith('git@') ? `https://${target.split('@')[1].replace(':', '/')}` : target);
        
        context.cancellationToken?.throwIfCancelled();
        const buffer = await repoLoader.fetchRepoBuffer(target, parsedUrl.hostname);

        context.reportProgress(JobStage.EXTRACTING, { totalFiles: 1, currentFile: target });
        context.cancellationToken?.throwIfCancelled();
        projectDir = await ArchiveExtractor.extractZipBuffer(buffer);
      } else {
        // Local directory or workspace path
        projectDir = target;
      }

      // Step 2: File Discovery & Traversal
      context.reportProgress(JobStage.WALKING);
      context.cancellationToken?.throwIfCancelled();
      const walker = new FileWalker();
      const contexts = await walker.loadFileContexts(projectDir, this.scanTimeoutMs);

      // Step 3: Scanner Engine Execution
      context.reportProgress(JobStage.SCANNING, { totalFiles: contexts.length });
      context.cancellationToken?.throwIfCancelled();
      const engine = new ScannerEngine();
      engine.registerPlugin(new RegexScannerPlugin());
      engine.registerPlugin(new SecretDetectorPlugin());
      engine.registerPlugin(new InsecureCodePlugin());
      engine.registerPlugin(new DockerScannerPlugin());

      await engine.initialize();

      const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
      context.reportProgress(JobStage.REPORTING, { totalFiles: contexts.length, filesProcessed: contexts.length });
      context.cancellationToken?.throwIfCancelled();
      const report = await engine.generateReport(contexts, elapsed);

      // Step 4: Persist Results
      context.reportProgress(JobStage.PERSISTING);
      await this.resultWriter.write(context, report);

      return report;
    } finally {
      if (projectDir && projectDir.includes('secaudit-')) {
        await ArchiveExtractor.cleanup(projectDir);
      }
    }
  }
}

module.exports = LocalScanExecutor;
