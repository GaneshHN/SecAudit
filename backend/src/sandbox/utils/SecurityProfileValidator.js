const fs = require('fs');
const path = require('path');

class SecurityProfileValidator {
  static validate(profile) {
    if (profile.privileged) {
      throw this._createError('PRIVILEGE_ESCALATION_BLOCKED', 'Privileged execution is strictly blocked.');
    }

    if (!profile.noNewPrivileges) {
      throw this._createError('PRIVILEGE_ESCALATION_BLOCKED', 'no-new-privileges must be enforced.');
    }

    // Validate capabilities
    const unsafeCaps = ['SYS_ADMIN', 'SYS_PTRACE', 'NET_ADMIN', 'SYS_MODULE', 'DAC_READ_SEARCH'];
    if (profile.capabilities.add) {
      for (const cap of profile.capabilities.add) {
        if (unsafeCaps.includes(cap)) {
          throw this._createError('CAPABILITY_CONFIGURATION_ERROR', `Unsafe capability ${cap} is not allowed.`);
        }
      }
    }

    if (!profile.capabilities.drop || !profile.capabilities.drop.includes('ALL')) {
      throw this._createError('CAPABILITY_CONFIGURATION_ERROR', 'Capabilities must drop ALL by default.');
    }

    // Validate user
    if (!profile.user || typeof profile.user !== 'string' || profile.user === 'root' || profile.user.startsWith('0:')) {
      throw this._createError('SECURITY_PROFILE_INVALID', 'Container must run as a non-root user.');
    }

    // Validate Seccomp
    if (profile.seccompProfile !== 'unconfined' && profile.seccompProfile !== 'default') {
      const seccompPath = path.resolve(__dirname, '../profiles', profile.seccompProfile);
      if (!fs.existsSync(seccompPath)) {
        throw this._createError('SECCOMP_CONFIGURATION_ERROR', `Seccomp profile ${profile.seccompProfile} not found.`);
      }
      try {
        const content = fs.readFileSync(seccompPath, 'utf8');
        JSON.parse(content);
      } catch (e) {
        throw this._createError('SECCOMP_CONFIGURATION_ERROR', `Seccomp profile ${profile.seccompProfile} is invalid JSON.`);
      }
    }

    // Validate AppArmor
    if (profile.appArmorProfile !== 'unconfined') {
      const apparmorPath = path.resolve(__dirname, '../profiles', profile.appArmorProfile);
      if (!fs.existsSync(apparmorPath)) {
        throw this._createError('APPARMOR_CONFIGURATION_ERROR', `AppArmor profile ${profile.appArmorProfile} not found.`);
      }
    }
  }

  static _createError(reason, message) {
    const err = new Error(message);
    err.reason = reason;
    return err;
  }
}

module.exports = SecurityProfileValidator;
