const Finding = require('../models/Finding');

/**
 * Single Responsibility: Construct and validate Finding instances.
 * Follows the Builder design pattern.
 */
class FindingBuilder {
  constructor() {
    this.reset();
  }

  reset() {
    this._data = {
      id: null,
      ruleId: 'CUSTOM-RULE',
      issue: 'Security Vulnerability',
      severity: 'Medium',
      confidence: 'High',
      category: 'Security',
      owasp: '',
      file: '',
      line: 0,
      column: 0,
      snippet: '',
      matchedText: '',
      description: '',
      fix: '',
      fingerprint: null,
    };
    return this;
  }

  setRuleId(ruleId) {
    this._data.ruleId = ruleId;
    return this;
  }

  setIssue(issue) {
    this._data.issue = issue;
    return this;
  }

  setSeverity(severity) {
    this._data.severity = severity || 'Medium';
    return this;
  }

  setConfidence(confidence) {
    this._data.confidence = confidence || 'High';
    return this;
  }

  setCategory(category) {
    this._data.category = category || 'Security';
    return this;
  }

  setOwasp(owasp) {
    this._data.owasp = owasp || '';
    return this;
  }

  setFile(file) {
    this._data.file = file || '';
    return this;
  }

  setLine(line) {
    this._data.line = parseInt(line, 10) || 0;
    return this;
  }

  setColumn(column) {
    this._data.column = parseInt(column, 10) || 0;
    return this;
  }

  setSnippet(snippet) {
    this._data.snippet = snippet || '';
    return this;
  }

  setMatchedText(matchedText) {
    this._data.matchedText = matchedText || '';
    return this;
  }

  setDescription(description) {
    this._data.description = description || '';
    return this;
  }

  setFix(fix) {
    this._data.fix = fix || '';
    return this;
  }

  setFingerprint(fingerprint) {
    this._data.fingerprint = fingerprint;
    return this;
  }

  /**
   * Build the Finding instance.
   * @returns {Finding}
   */
  build() {
    const finding = new Finding(this._data);
    this.reset();
    return finding;
  }

  /**
   * Static helper to build directly from an object.
   * @param {Object} obj 
   * @returns {Finding}
   */
  static fromObject(obj) {
    const builder = new FindingBuilder();
    if (obj.ruleId) builder.setRuleId(obj.ruleId);
    if (obj.issue) builder.setIssue(obj.issue);
    if (obj.severity) builder.setSeverity(obj.severity);
    if (obj.confidence) builder.setConfidence(obj.confidence);
    if (obj.category) builder.setCategory(obj.category);
    if (obj.owasp) builder.setOwasp(obj.owasp);
    if (obj.file) builder.setFile(obj.file);
    if (obj.line !== undefined) builder.setLine(obj.line);
    if (obj.column !== undefined) builder.setColumn(obj.column);
    if (obj.snippet) builder.setSnippet(obj.snippet);
    if (obj.matchedText) builder.setMatchedText(obj.matchedText);
    if (obj.description) builder.setDescription(obj.description);
    if (obj.fix) builder.setFix(obj.fix);
    if (obj.fingerprint) builder.setFingerprint(obj.fingerprint);
    return builder.build();
  }
}

module.exports = FindingBuilder;
