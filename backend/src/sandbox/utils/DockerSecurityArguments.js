const path = require('path');
const SecurityProfileValidator = require('./SecurityProfileValidator');

class DockerSecurityArguments {
  static getArgs(profile) {
    SecurityProfileValidator.validate(profile);

    const args = [];

    // User
    if (profile.user) {
      args.push('--user', profile.user);
    }

    // No new privileges
    if (profile.noNewPrivileges) {
      args.push('--security-opt', 'no-new-privileges');
    }

    // Capabilities
    if (profile.capabilities.drop) {
      for (const cap of profile.capabilities.drop) {
        args.push(`--cap-drop=${cap}`);
      }
    }
    if (profile.capabilities.add) {
      for (const cap of profile.capabilities.add) {
        args.push(`--cap-add=${cap}`);
      }
    }

    // Seccomp
    if (profile.seccompProfile !== 'unconfined' && profile.seccompProfile !== 'default') {
      const seccompPath = path.resolve(__dirname, '../profiles', profile.seccompProfile);
      args.push('--security-opt', `seccomp=${seccompPath}`);
    } else if (profile.seccompProfile === 'unconfined') {
      args.push('--security-opt', 'seccomp=unconfined');
    }

    // AppArmor
    if (profile.appArmorProfile !== 'unconfined') {
      // In a real environment we would load the profile, but for docker run we pass the name if loaded, 
      // or we can pass a specific apparmor profile name assuming it's loaded in the host.
      // Docker expects: --security-opt apparmor=profile_name
      // For this sandbox we will just pass the profile file name without extension as the profile name
      const profileName = path.parse(profile.appArmorProfile).name;
      args.push('--security-opt', `apparmor=${profileName}`);
    }

    // Read-only rootfs
    if (profile.readOnlyRootFs) {
      args.push('--read-only');
    }

    return args;
  }
}

module.exports = DockerSecurityArguments;
