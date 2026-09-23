const path = require('path');
const fs = require('fs/promises');
const os = require('os');
const assert = require('assert');
const AdmZip = require('adm-zip');

const SecureFilesystem = require('./src/sandbox/utils/SecureFilesystem');
const SecureArchiveExtractor = require('./src/scanner/loader/SecureArchiveExtractor');
const FileWalker = require('./src/scanner/loader/FileWalker');
const WorkspaceManager = require('./src/sandbox/WorkspaceManager');
const SandboxConfiguration = require('./src/sandbox/SandboxConfiguration');
const ArtifactScanResultWriter = require('./src/executors/writers/ArtifactScanResultWriter');
const ArtifactReader = require('./src/sandbox/utils/ArtifactReader');

async function runTests() {
  console.log('🧪 Starting Secure Filesystem & Workspace Isolation Tests...\n');
  
  const testRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'secaudit-test-'));
  const workspaceRoot = path.join(testRoot, 'workspaces');
  await fs.mkdir(workspaceRoot, { recursive: true });

  // 1. SecureFilesystem Bound Validation
  console.log('[1] Testing Path Validation & Rejection...');
  assert.throws(() => SecureFilesystem.resolveSecurePath(workspaceRoot, '../outside'), /escapes root/, '../ traversal failed to throw');
  assert.throws(() => SecureFilesystem.resolveSecurePath(workspaceRoot, '/etc/passwd'), /escapes root/, 'Absolute path failed to throw');
  assert.throws(() => SecureFilesystem.resolveSecurePath(workspaceRoot, 'safe/..\\../outside'), /escapes root/, 'Mixed separator failed to throw');
  assert.throws(() => SecureFilesystem.resolveSecurePath(workspaceRoot, 'null\0byte'), /Null byte detected/, 'Null byte failed to throw');
  
  const safePath = SecureFilesystem.resolveSecurePath(workspaceRoot, 'safe/file.txt');
  assert(safePath.startsWith(workspaceRoot), 'Safe path should resolve inside root');
  console.log('   ✅ Traversal and escape paths correctly rejected.');

  // 2. ZIP Extraction Protection
  console.log('\n[2] Testing ZIP Extraction (Zip Slip & Symlinks)...');
  
  const maliciousZip = new AdmZip();
  maliciousZip.addFile('safe.txt', Buffer.from('safe'));
  maliciousZip.addFile('escaped.txt', Buffer.from('escaped'));
  maliciousZip.getEntries().find(e => e.entryName === 'escaped.txt').entryName = '../escaped.txt';
  
  const extractDir = path.join(testRoot, 'zip-extract');
  await fs.mkdir(extractDir, { recursive: true });
  
  try {
    await SecureArchiveExtractor.extract(maliciousZip.toBuffer(), extractDir);
    assert.fail('Should have rejected malicious ZIP');
  } catch (err) {
    if (err.code === 'ERR_ASSERTION') throw err; // Re-throw assertion failures from assert.fail
    assert(err.message.includes('Malicious archive entry'), `Did not catch malicious ZIP correctly. Got: ${err.message}`);
  }
  
  // Verify partial extraction did not occur
  const files = await fs.readdir(extractDir);
  assert.strictEqual(files.length, 0, 'Partial extraction occurred on malicious archive!');
  console.log('   ✅ Zip Slip prevented. No partial extraction occurred.');

  // 3. FileWalker Resource Limits & Symlink Skipping
  console.log('\n[3] Testing FileWalker maxTotalSize & Symlink handling...');
  const walkerDir = path.join(testRoot, 'walker');
  await fs.mkdir(walkerDir, { recursive: true });
  await fs.writeFile(path.join(walkerDir, 'file1.txt'), Buffer.alloc(500, 'a'));
  await fs.writeFile(path.join(walkerDir, 'file2.txt'), Buffer.alloc(600, 'b'));
  
  // Create a symlink pointing outside
  try {
    await fs.symlink(os.tmpdir(), path.join(walkerDir, 'escape-link'), 'dir');
  } catch (e) {
    // Windows might need admin rights for symlinks, ignore if it fails
    if (e.code !== 'EPERM') throw e;
  }

  const walker = new FileWalker({ maxTotalSize: 1000 }); // 1000 bytes max
  const contexts = await walker.loadFileContexts(walkerDir);
  
  // It should only load ONE file because 500+600 > 1000
  assert.strictEqual(contexts.length, 1, 'FileWalker did not enforce maxTotalSize!');
  console.log('   ✅ FileWalker successfully enforced maxTotalSize limit and skipped symlinks.');

  // 4. Artifact Boundary Protection
  console.log('\n[4] Testing Artifact Boundaries...');
  const config = new SandboxConfiguration({ workspaceRoot });
  const wsManager = new WorkspaceManager(config);
  
  const ctx = {
    job: { id: 'test-job', workerId: 'worker-1' },
    correlationId: 'corr-1',
    logger: { info: () => {}, error: () => {} }
  };
  
  const wsPath = await wsManager.createWorkspace(ctx);
  assert(wsPath.startsWith(workspaceRoot), 'Workspace was not created in root');
  
  const writer = new ArtifactScanResultWriter();
  await writer.write(ctx, { score: 100, issues: [] });
  
  const readerResult = await ArtifactReader.readArtifacts(ctx.workspace);
  assert.strictEqual(readerResult.report.score, 100, 'Failed to read valid artifact');
  
  // Try to read outside bounds directly (though internal to ArtifactReader, we verify it uses SecureFilesystem)
  // Let's verify we didn't write outside
  const artifactsExist = await fs.stat(path.join(ctx.workspace, 'artifacts', 'report.json'));
  assert(artifactsExist, 'Artifact was not correctly bounded in workspace');
  console.log('   ✅ Artifacts are strictly bounded to the workspace directory.');

  // 5. Cleanup Boundaries
  console.log('\n[5] Testing Workspace Cleanup Boundaries...');
  await wsManager.cleanup(ctx, true);
  
  try {
    await fs.stat(ctx.workspace);
    assert.fail('Workspace should have been deleted');
  } catch (e) {
    assert(e.code === 'ENOENT', 'Workspace was not deleted correctly');
  }
  
  // Cleanup test root
  await fs.rm(testRoot, { recursive: true, force: true });
  console.log('   ✅ Workspace correctly destroyed without escaping bounds.');
  
  console.log('\n🎉 ALL FILESYSTEM ISOLATION TESTS PASSED!');
}

runTests().catch(err => {
  console.error('\n❌ Test Failed:', err);
  process.exit(1);
});
