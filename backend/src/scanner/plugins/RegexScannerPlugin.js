const ScannerPlugin = require('../core/ScannerPlugin');
const FindingBuilder = require('../core/FindingBuilder');
const RuleLoader = require('../rules/RuleLoader');

/**
 * Legacy & Custom Regex Security Rule Scanner Plugin.
 */
class RegexScannerPlugin extends ScannerPlugin {
  constructor() {
    super('regex-v1', 'Regex Security Scanner', '1.0.0');
    this.rules = [];
    this.MAX_ISSUES_PER_FILE = 50;
  }

  async initialize() {
    this.rules = RuleLoader.loadRules();
  }

  /**
   * Build array of newline byte offsets for fast line number lookup.
   */
  _buildLineIndex(content) {
    const offsets = [0];
    for (let i = 0; i < content.length; i++) {
      if (content[i] === '\n') {
        offsets.push(i + 1);
      }
    }
    return offsets;
  }

  /**
   * Binary search for line number.
   */
  _getLineNumber(lineIndex, offset) {
    let lo = 0, hi = lineIndex.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      if (lineIndex[mid] <= offset) lo = mid + 1;
      else hi = mid - 1;
    }
    return lo; // 1-indexed
  }

  async scan(context) {
    const findings = [];
    const { content, lines, relativePath } = context;

    if (!content || !lines || lines.length === 0) return findings;

    const lineIndex = this._buildLineIndex(content);

    for (const rule of this.rules) {
      if (!rule.regex) continue;
      const regex = new RegExp(rule.regex.source, rule.regex.flags);
      let match;

      while ((match = regex.exec(content)) !== null) {
        const lineNumber = this._getLineNumber(lineIndex, match.index);
        const lineContent = lines[lineNumber - 1]?.trim() || '';

        const finding = new FindingBuilder()
          .setRuleId(rule.id)
          .setIssue(rule.name)
          .setSeverity(rule.severity)
          .setCategory(rule.category)
          .setOwasp(rule.owasp)
          .setFile(relativePath)
          .setLine(lineNumber)
          .setSnippet(lineContent.length > 120 ? lineContent.substring(0, 120) + '...' : lineContent)
          .setDescription(rule.description)
          .setFix(rule.fix)
          .setMatchedText(match[0])
          .build();

        findings.push(finding);

        if (findings.length >= this.MAX_ISSUES_PER_FILE) {
          return findings;
        }

        if (match.index === regex.lastIndex) regex.lastIndex++;
      }
    }

    return findings;
  }
}

module.exports = RegexScannerPlugin;
