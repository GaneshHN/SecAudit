/**
 * Encapsulates sandbox resource limits.
 */
class SandboxResourcePolicy {
  constructor({ memoryMb = 1024, cpuCores = 1, diskMb = 5120, processLimit = 100, timeoutMs = 60000, gracePeriodMs = 5000 } = {}) {
    this.memoryMb = this._validatePositiveNumber('memoryMb', memoryMb, 10, 32768);
    this.cpuCores = this._validatePositiveNumber('cpuCores', cpuCores, 0.1, 64);
    this.diskMb = this._validatePositiveNumber('diskMb', diskMb, 10, 102400);
    this.processLimit = this._validatePositiveNumber('processLimit', processLimit, 10, 10000);
    this.timeoutMs = this._validatePositiveNumber('timeoutMs', timeoutMs, 1000, 3600000);
    this.gracePeriodMs = this._validatePositiveNumber('gracePeriodMs', gracePeriodMs, 1000, 30000);
  }

  _validatePositiveNumber(name, value, min, max) {
    if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
      throw new Error(`SandboxResourcePolicy: ${name} must be a valid number`);
    }
    if (value < min || value > max) {
      throw new Error(`SandboxResourcePolicy: ${name} must be between ${min} and ${max}`);
    }
    return value;
  }
}

module.exports = SandboxResourcePolicy;
