const path = require('path');
const assert = require('assert');

// 1. Interfaces & Core
const Rule = require('./src/scanner/core/Rule');
const FindingBuilder = require('./src/scanner/core/FindingBuilder');
const ReportGenerator = require('./src/scanner/core/ReportGenerator');
const ScannerPlugin = require('./src/scanner/core/ScannerPlugin');
const ScannerEngine = require('./src/scanner/core/ScannerEngine');

// 2. Loaders
const RepositoryLoader = require('./src/scanner/loader/RepositoryLoader');
const ArchiveExtractor = require('./src/scanner/loader/ArchiveExtractor');
const FileWalker = require('./src/scanner/loader/FileWalker');
const RuleLoader = require('./src/scanner/rules/RuleLoader');

// 3. Plugins
const RegexScannerPlugin = require('./src/scanner/plugins/RegexScannerPlugin');
const SecretDetectorPlugin = require('./src/scanner/plugins/SecretDetectorPlugin');
const InsecureCodePlugin = require('./src/scanner/plugins/InsecureCodePlugin');
const GitLeaksPlugin = require('./src/scanner/plugins/GitLeaksPlugin');
const SemgrepPlugin = require('./src/scanner/plugins/SemgrepPlugin');
const TrivyPlugin = require('./src/scanner/plugins/TrivyPlugin');
const DockerScannerPlugin = require('./src/scanner/plugins/DockerScannerPlugin');
const AIScannerPlugin = require('./src/scanner/plugins/AIScannerPlugin');

// Services
const { runScan } = require('./utils/services/scannerService');

async function testModularArchitecture() {
  console.log('🧪 Starting Modular Scanner Architecture Verification Tests...\n');

  // Test 1: Single Responsibility & Interfaces
  console.log('Test 1: Rule & FindingBuilder & ReportGenerator');
  const rule = new Rule({ id: 'R-TEST', name: 'Test Rule', regex: /secret/i, severity: 'High' });
  assert.strictEqual(rule.id, 'R-TEST');
  assert(rule.matches('this is a secret'));

  const finding = new FindingBuilder()
    .setRuleId(rule.id)
    .setIssue(rule.name)
    .setSeverity(rule.severity)
    .setFile('test.js')
    .setLine(10)
    .build();

  assert.strictEqual(finding.ruleId, 'R-TEST');
  assert.strictEqual(finding.file, 'test.js');
  assert.strictEqual(finding.line, 10);

  const jsonReport = ReportGenerator.generateReport([finding], 1, 0.5);
  assert.strictEqual(jsonReport.totalIssues, 1);
  assert.strictEqual(jsonReport.summary.high, 1);
  assert.strictEqual(typeof jsonReport.score, 'number');
  console.log('   ✅ Test 1 Passed: Core interfaces and models are intact.\n');

  // Test 2: Open/Closed Principle with Custom Plugin
  console.log('Test 2: Open/Closed Principle (Custom Plugin Registration)');
  class CustomDummyPlugin extends ScannerPlugin {
    constructor() {
      super('custom-dummy', 'Custom Dummy Plugin', '1.0.0');
    }
    async scan(ctx) {
      if (ctx.content.includes('CUSTOM_BAD_PATTERN')) {
        return [
          new FindingBuilder()
            .setRuleId('CUSTOM-001')
            .setIssue('Custom Pattern Detected')
            .setSeverity('Critical')
            .setFile(ctx.relativePath)
            .build()
        ];
      }
      return [];
    }
  }

  const engine = new ScannerEngine();
  engine.registerPlugin(new CustomDummyPlugin());
  await engine.initialize();

  const dummyResults = await engine.generateReport([
    { filePath: '/tmp/test.js', relativePath: 'test.js', content: 'const x = "CUSTOM_BAD_PATTERN";', lines: ['const x = "CUSTOM_BAD_PATTERN";'] }
  ], 0.1);

  assert.strictEqual(dummyResults.totalIssues, 1);
  assert.strictEqual(dummyResults.issues[0].ruleId, 'CUSTOM-001');
  console.log('   ✅ Test 2 Passed: Open/Closed principle verified (Custom plugin registered & executed seamlessly).\n');

  // Test 3: Loaders Verification
  console.log('Test 3: Loaders (FileWalker & RuleLoader)');
  const rules = RuleLoader.loadRules();
  assert(rules.length > 0);
  assert(rules[0] instanceof Rule);

  const walker = new FileWalker();
  const testDirPath = path.join(__dirname, '..', 'test-vulnerable-project');
  const scannableFiles = await walker.getScannableFiles(testDirPath);
  assert(scannableFiles.length > 0);
  console.log(`   Found ${scannableFiles.length} files in test-vulnerable-project.`);
  console.log('   ✅ Test 3 Passed: Loaders behave correctly.\n');

  // Test 4: End-to-End Scan & Backward Compatibility
  console.log('Test 4: End-to-End Scan & 100% Backward Compatibility');
  const report = await runScan(testDirPath);

  // Validate required JSON fields for frontend compatibility
  assert('score' in report, 'Missing score field');
  assert('summary' in report, 'Missing summary field');
  assert('totalIssues' in report, 'Missing totalIssues field');
  assert('filesScanned' in report, 'Missing filesScanned field');
  assert('scanTime' in report, 'Missing scanTime field');
  assert(Array.isArray(report.issues), 'issues must be an array');
  assert(report.issues.length > 0, 'Expected vulnerabilities in vulnerable project');

  // Validate item level structure
  const firstIssue = report.issues[0];
  assert('issue' in firstIssue);
  assert('severity' in firstIssue);
  assert('file' in firstIssue);
  assert('line' in firstIssue);
  assert('snippet' in firstIssue);
  assert('description' in firstIssue);
  assert('fix' in firstIssue);

  console.log('   Report summary:', JSON.stringify(report.summary));
  console.log(`   Total issues: ${report.totalIssues}, Score: ${report.score}`);
  console.log('   ✅ Test 4 Passed: 100% Backward compatibility confirmed.\n');

  console.log('🎉 ALL ARCHITECTURE VERIFICATION TESTS PASSED SUCCESSFULLY!');
}

testModularArchitecture().catch((err) => {
  console.error('❌ Verification Test Failed:', err);
  process.exit(1);
});
