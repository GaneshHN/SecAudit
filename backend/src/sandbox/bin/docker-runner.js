const path = require('path');
const fs = require('fs/promises');
const LocalScanExecutor = require('../../executors/LocalScanExecutor');
const ArtifactScanResultWriter = require('../../executors/writers/ArtifactScanResultWriter');
const ExecutionContext = require('../../executors/ExecutionContext');

async function run() {
  const workspacePath = process.argv[2] || process.env.WORKSPACE_PATH;
  if (!workspacePath) {
    console.error('Workspace path is required.');
    process.exit(1);
  }

  const artifactsDir = path.join(workspacePath, 'artifacts');
  await fs.mkdir(artifactsDir, { recursive: true });

  let exitCode = 0;
  let errorMsg = null;

  try {
    const metaPath = path.join(workspacePath, '.secaudit-metadata.json');
    let metaData = {};
    try {
      metaData = JSON.parse(await fs.readFile(metaPath, 'utf8'));
    } catch (e) {
      // Optional
    }

    // Reconstruct a minimal ExecutionContext
    // The workspace already has the repository downloaded?
    // Wait, the prompt says "workspace mounting, read-only application mount".
    // If LocalScanExecutor is used here, it needs `context.repository`.
    // Does the Docker Sandbox Provider download the repository before running the container?
    // If not, LocalScanExecutor downloads it.
    
    // We expect the original context parameters to be serialized in context.json
    const contextPath = path.join(workspacePath, 'context.json');
    const contextData = JSON.parse(await fs.readFile(contextPath, 'utf8'));

    const executionContext = new ExecutionContext({
      job: contextData.job,
      cancellationToken: null, // Cancel tokens don't serialize easily across processes, handled by host killing container
      logger: {
        info: (msg) => console.log(JSON.stringify({ level: 'info', msg })),
        error: (msg) => console.log(JSON.stringify({ level: 'error', msg }))
      }
    });

    executionContext.workspace = workspacePath;

    // Override reportProgress to log out to stdout
    executionContext.reportProgress = (stage, details = {}) => {
      console.log(JSON.stringify({ type: 'progress', stage, details }));
    };

    const executor = new LocalScanExecutor({
      scanTimeoutMs: contextData.scanTimeoutMs || 60000,
      resultWriter: new ArtifactScanResultWriter()
    });

    // The context.repository can be the original target or a mounted folder
    // For simplicity, we just pass the original execution context
    executionContext.repository = contextData.repository;
    
    // Execute!
    console.log(JSON.stringify({ type: 'lifecycle', event: 'ScannerStarted' }));
    await executor.execute(executionContext);
    console.log(JSON.stringify({ type: 'lifecycle', event: 'ScannerFinished' }));
    
  } catch (err) {
    console.error(err);
    exitCode = 1;
    errorMsg = err.message;
  } finally {
    const exitPath = path.join(artifactsDir, 'exit.json');
    const exitTmpPath = path.join(artifactsDir, 'exit.json.tmp');
    await fs.writeFile(exitTmpPath, JSON.stringify({ exitCode, error: errorMsg }, null, 2));
    await fs.rename(exitTmpPath, exitPath);
    console.log(JSON.stringify({ type: 'lifecycle', event: 'ArtifactsWritten' }));
    process.exit(exitCode);
  }
}

run();
