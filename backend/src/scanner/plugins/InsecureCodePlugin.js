const path = require('path');
const ScannerPlugin = require('../core/ScannerPlugin');
const FindingBuilder = require('../core/FindingBuilder');

const PATTERNS = [
  { name: 'eval() Usage', pattern: /\beval\s*\(/i, severity: 'High', langs: ['py', 'js', 'ts', 'rb', 'php'], fix: 'Avoid eval. Use safe parsing (JSON.parse, ast.literal_eval).' },
  { name: 'Command Injection Risk', pattern: /(?:os\.system|subprocess\.call|exec\(|child_process|shell_exec|system\()/i, severity: 'High', langs: ['py', 'js', 'ts', 'php', 'rb', 'c', 'cpp'], fix: 'Use parameterized commands. Never pass unsanitized user input to shell.' },
  { name: 'Weak Cryptography (MD5/SHA1)', pattern: /(?:md5|sha1)\s*\(/i, severity: 'Medium', langs: ['py', 'js', 'ts', 'php', 'java', 'go', 'rb'], fix: 'Use SHA-256 or stronger hash functions (bcrypt/argon2 for passwords).' },
  { name: 'SQL String Concatenation', pattern: /(?:SELECT|INSERT|UPDATE|DELETE).*\+\s*(?:req\.|request\.|params|input)/i, severity: 'High', langs: ['py', 'js', 'ts', 'java', 'php', 'go', 'rb'], fix: 'Use parameterized queries or prepared statements.' },
  { name: 'Unsafe Deserialization', pattern: /(?:pickle\.loads|yaml\.load\(|unserialize\(|ObjectInputStream)/i, severity: 'High', langs: ['py', 'js', 'java', 'php', 'rb'], fix: 'Use safe deserializers (yaml.safe_load, JSON.parse).' },
  { name: 'Insecure Random', pattern: /(?:Math\.random|random\.random|rand\(\)|srand\()/i, severity: 'Low', langs: ['py', 'js', 'ts', 'php', 'c', 'cpp', 'rb'], fix: 'Use cryptographically secure random generators (crypto.getRandomValues / secrets).' },
];

const EXT_MAP = {
  '.py': 'py', '.js': 'js', '.ts': 'ts', '.tsx': 'ts', '.jsx': 'js',
  '.java': 'java', '.go': 'go', '.php': 'php', '.rb': 'rb', '.c': 'c', '.cpp': 'cpp',
};

class InsecureCodePlugin extends ScannerPlugin {
  constructor() {
    super('insecure-code-v1', 'Insecure Code Pattern Plugin', '1.0.0');
  }

  async scan(context) {
    const findings = [];
    const { filePath, lines, relativePath } = context;

    if (!filePath || !lines || lines.length === 0) return findings;

    const ext = path.extname(filePath).toLowerCase();
    const lang = EXT_MAP[ext];
    if (!lang) return findings;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const stripped = line.trim();
      if (stripped.startsWith('//') || stripped.startsWith('#') || stripped.startsWith('/*')) continue;

      for (const pat of PATTERNS) {
        if (!pat.langs.includes(lang)) continue;
        const match = pat.pattern.exec(line);
        if (match) {
          findings.push(
            new FindingBuilder()
              .setRuleId(`INSECURE-${pat.name.toUpperCase().replace(/\s+/g, '-')}`)
              .setIssue(pat.name)
              .setSeverity(pat.severity)
              .setCategory('Code Quality & Security')
              .setOwasp('A03:2021 - Injection')
              .setFile(relativePath)
              .setLine(i + 1)
              .setSnippet(stripped.length > 120 ? stripped.substring(0, 120) + '...' : stripped)
              .setMatchedText(match[0])
              .setDescription(`${pat.name} detected in ${relativePath}:${i + 1}`)
              .setFix(pat.fix)
              .build()
          );
        }
      }
    }

    return findings;
  }
}

module.exports = InsecureCodePlugin;
