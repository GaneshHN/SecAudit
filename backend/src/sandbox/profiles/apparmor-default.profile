#include <tunables/global>

profile docker-secaudit-sandbox flags=(attach_disconnected,mediate_deleted) {
  #include <abstractions/base>
  #include <abstractions/node-base>

  # Allow read access to workspace and app
  /app/** r,
  /workspace/** rw,

  # Deny dangerous operations
  deny mount,
  deny ptrace,
  deny signal,
  deny /sys/** w,
  deny /proc/sys/** w,
  deny /proc/sysrq-trigger rw,

  # Minimal network if enabled
  network inet stream,
  network inet6 stream,
}
