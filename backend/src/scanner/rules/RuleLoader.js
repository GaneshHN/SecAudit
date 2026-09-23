const { securityRules } = require('../../../utils/rules');
const Rule = require('../core/Rule');

/**
 * Single Responsibility: Loads and parses rules into standard Rule instances.
 */
class RuleLoader {
  /**
   * Load security rules into Rule instances.
   * @param {Array<Object>} customRules - Optional additional rules array
   * @returns {Array<Rule>}
   */
  static loadRules(customRules = null) {
    const rawRules = customRules || securityRules;
    return rawRules.map((r, index) => {
      return new Rule({
        id: r.id || `R-${index.toString().padStart(4, '0')}`,
        name: r.name,
        severity: r.severity || 'Medium',
        category: r.category || 'Security',
        owasp: r.owasp || '',
        description: r.description || '',
        fix: r.fix || '',
        regex: r.regex ? new RegExp(r.regex.source, r.regex.flags) : null,
      });
    });
  }
}

module.exports = RuleLoader;
