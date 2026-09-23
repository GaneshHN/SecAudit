/**
 * Structured Logger
 * Provides structured JSON or formatted text logging while ensuring secrets
 * (passwords, JWTs, API keys, etc.) are strictly redacted.
 */

const SECRET_PATTERNS = [
  /(password|secret|apikey|token|jwt|auth)([\s=:'"]+)([^,;\s}]+)/gi,
  /(Bearer\s+)([A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*)/g,
  /(ghp_[a-zA-Z0-9]{36})/g, // GitHub PAT
  /(xox[baprs]-[0-9]{10,13}-[a-zA-Z0-9]{24})/g // Slack tokens
];

class Logger {
  constructor(options = {}) {
    this.level = options.level || process.env.LOG_LEVEL || 'info';
    this.format = options.format || process.env.LOG_FORMAT || 'text'; // 'json' or 'text'
  }

  /**
   * Redacts sensitive data from string or object
   */
  _redact(data) {
    if (typeof data === 'string') {
      let redacted = data;
      for (const pattern of SECRET_PATTERNS) {
        redacted = redacted.replace(pattern, (match, p1, p2) => {
          if (p2) return `${p1}${p2}[REDACTED]`; // matches generic key-value
          return '[REDACTED]'; // matches exact token structures
        });
      }
      return redacted;
    } else if (typeof data === 'object' && data !== null) {
      if (Array.isArray(data)) {
        return data.map(item => this._redact(item));
      }
      
      const redactedObj = {};
      for (const [key, value] of Object.entries(data)) {
        if (key.toLowerCase().match(/(password|secret|token|key|jwt)/)) {
          redactedObj[key] = '[REDACTED]';
        } else {
          redactedObj[key] = this._redact(value);
        }
      }
      return redactedObj;
    }
    return data;
  }

  _log(level, message, meta = {}) {
    // Basic level filtering
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    if (levels[level] < levels[this.level]) return;

    const timestamp = new Date().toISOString();
    const safeMessage = this._redact(message);
    const safeMeta = this._redact(meta);

    if (this.format === 'json') {
      console.log(JSON.stringify({ timestamp, level, message: safeMessage, ...safeMeta }));
    } else {
      const metaStr = Object.keys(safeMeta).length ? ` | ${JSON.stringify(safeMeta)}` : '';
      const color = level === 'error' ? '\x1b[31m' : level === 'warn' ? '\x1b[33m' : '\x1b[32m';
      console.log(`${color}[${timestamp}] [${level.toUpperCase()}]\x1b[0m ${safeMessage}${metaStr}`);
    }
  }

  debug(message, meta) { this._log('debug', message, meta); }
  info(message, meta) { this._log('info', message, meta); }
  warn(message, meta) { this._log('warn', message, meta); }
  error(message, meta) { this._log('error', message, meta); }
}

const logger = new Logger();

module.exports = { Logger, logger };
