const ScannerPlugin = require('../core/ScannerPlugin');
const FindingBuilder = require('../core/FindingBuilder');

const SECRET_PATTERNS = [
  { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/, severity: 'High', owasp: 'A02:2021 - Cryptographic Failures', fix: 'Use environment variables or secrets manager.' },
  { name: 'AWS Secret Key', pattern: /aws_secret_access_key\s*=\s*['"]?[A-Za-z0-9/+=]{40}['"]?/i, severity: 'High', owasp: 'A02:2021 - Cryptographic Failures', fix: 'Use environment variables or secrets manager.' },
  { name: 'GitHub Token', pattern: /gh[ps]_[A-Za-z0-9_]{36,}/, severity: 'High', owasp: 'A02:2021 - Cryptographic Failures', fix: 'Revoke and replace GitHub personal access token.' },
  { name: 'Generic API Key', pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"]?[A-Za-z0-9_\-]{20,}['"]?/i, severity: 'High', owasp: 'A02:2021 - Cryptographic Failures', fix: 'Store API keys in environment variables.' },
  { name: 'Private Key Header', pattern: /-----BEGIN (?:RSA |DSA |EC )?PRIVATE KEY-----/, severity: 'High', owasp: 'A02:2021 - Cryptographic Failures', fix: 'Do not commit private keys into repository.' },
  { name: 'JWT Token', pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, severity: 'Medium', owasp: 'A02:2021 - Cryptographic Failures', fix: 'Do not hardcode JWT tokens.' },
  { name: 'Database Password URL', pattern: /(?:postgres|mysql|mongodb):\/\/[^\s'"]+:[^\s'"]+@/i, severity: 'High', owasp: 'A02:2021 - Cryptographic Failures', fix: 'Inject database connection strings from environment variables.' },
];

function calculateEntropy(str) {
  if (!str) return 0;
  const freq = {};
  for (let i = 0; i < str.length; i++) {
    freq[str[i]] = (freq[str[i]] || 0) + 1;
  }
  let entropy = 0;
  for (const char in freq) {
    const p = freq[char] / str.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

class SecretDetectorPlugin extends ScannerPlugin {
  constructor() {
    super('secret-detector-v1', 'Secret & High-Entropy Detector Plugin', '1.0.0');
  }

  async scan(context) {
    const findings = [];
    const { lines, relativePath } = context;

    if (!lines || lines.length === 0) return findings;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      const stripped = line.trim();

      for (const pat of SECRET_PATTERNS) {
        const match = pat.pattern.exec(line);
        if (match) {
          findings.push(
            new FindingBuilder()
              .setRuleId(`SECRET-${pat.name.toUpperCase().replace(/\s+/g, '-')}`)
              .setIssue(`Hardcoded Secret: ${pat.name}`)
              .setSeverity(pat.severity)
              .setCategory('Secrets')
              .setOwasp(pat.owasp)
              .setFile(relativePath)
              .setLine(lineNum)
              .setSnippet(stripped.length > 120 ? stripped.substring(0, 120) + '...' : stripped)
              .setMatchedText(match[0])
              .setDescription(`${pat.name} detected in source code line ${lineNum}.`)
              .setFix(pat.fix)
              .build()
          );
          break;
        }
      }

      // Check high entropy string candidates
      const tokens = line.match(/["']([A-Za-z0-9+/=_-]{32,})["']/g);
      if (tokens) {
        for (const rawToken of tokens) {
          const token = rawToken.replace(/['"]/g, '');
          if (calculateEntropy(token) > 4.5) {
            const exists = findings.some((f) => f.file === relativePath && f.line === lineNum);
            if (!exists) {
              findings.push(
                new FindingBuilder()
                  .setRuleId('SECRET-HIGH-ENTROPY')
                  .setIssue('High-Entropy String (Possible Secret)')
                  .setSeverity('Medium')
                  .setCategory('Secrets')
                  .setOwasp('A02:2021 - Cryptographic Failures')
                  .setFile(relativePath)
                  .setLine(lineNum)
                  .setSnippet(stripped.length > 120 ? stripped.substring(0, 120) + '...' : stripped)
                  .setMatchedText(token)
                  .setDescription(`High-entropy string (entropy > 4.5) detected in source file.`)
                  .setFix('Verify if string contains secrets and move to environment configuration.')
                  .build()
              );
            }
          }
        }
      }
    }

    return findings;
  }
}

module.exports = SecretDetectorPlugin;
