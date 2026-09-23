/**
 * Interface and Base Class for Security Rules.
 * Represents a single security detection rule.
 */
class Rule {
  constructor({
    id,
    name,
    severity = 'Medium',
    category = 'Security',
    owasp = '',
    description = '',
    fix = '',
    regex = null,
  }) {
    if (!id || !name) {
      throw new Error('Rule requires both id and name');
    }
    this.id = id;
    this.name = name;
    this.severity = severity;
    this.category = category;
    this.owasp = owasp;
    this.description = description;
    this.fix = fix;
    this.regex = regex;
  }

  /**
   * Check if rule matches a given text content or context.
   * @param {string} content - Text content to test against
   * @returns {RegExpExecArray | null}
   */
  matches(content) {
    if (!this.regex || !content) return null;
    const re = new RegExp(this.regex.source, this.regex.flags);
    return re.exec(content);
  }
}

module.exports = Rule;
