/**
 * Standardized Finding Model.
 * Every plugin must return instances of this class.
 */
class Finding {
  constructor({
    id = null,
    ruleId,
    issue, // name/title
    severity,
    confidence = 'High',
    category,
    owasp = '',
    file,
    line = 0,
    column = 0,
    snippet = '',
    matchedText = '',
    description,
    fix, // recommendation
    fingerprint = null,
  }) {
    this.id = id || Math.random().toString(36).substr(2, 9);
    this.ruleId = ruleId;
    this.issue = issue;
    this.severity = severity;
    this.confidence = confidence;
    this.category = category;
    this.owasp = owasp;
    this.file = file;
    this.line = line;
    this.column = column;
    this.snippet = snippet;
    this.matchedText = matchedText;
    this.description = description;
    this.fix = fix;
    this.fingerprint = fingerprint || `${ruleId}:${file}:${line}`;
    this.timestamp = new Date().toISOString();
  }

  // To remain 100% backward compatible with the current JSON format
  toJSON() {
    return {
      issue: this.issue,
      severity: this.severity,
      category: this.category,
      owasp: this.owasp,
      file: this.file,
      line: this.line,
      snippet: this.snippet,
      description: this.description,
      fix: this.fix,
      // Include new standardized fields implicitly
      id: this.id,
      ruleId: this.ruleId,
      confidence: this.confidence,
      column: this.column,
      matchedText: this.matchedText,
      fingerprint: this.fingerprint,
      timestamp: this.timestamp
    };
  }
}

module.exports = Finding;
