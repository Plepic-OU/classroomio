
# Runs Claude Code with all permission prompts off, but only in an unprivileged container.
cskip() {
  local cap_bnd full_cap_bnd device
  cap_bnd="$(awk '/^CapBnd:/ { print $2 }' /proc/self/status)"
  full_cap_bnd="$(printf '%016x' $(((1 << ($(cat /proc/sys/kernel/cap_last_cap) + 1)) - 1)))"

  if [ "$cap_bnd" = "000001ffffffffff" ] || [ "$cap_bnd" = "$full_cap_bnd" ]; then
    echo "cskip: refusing to run: this container has every Linux capability (CapBnd $cap_bnd)," >&2
    echo "cskip: so it is privileged and does not isolate the host. Rebuild the devcontainer" >&2
    echo "cskip: from the current repo (Dev Containers: Rebuild Container) and try again." >&2
    return 1
  fi

  for device in /dev/sd* /dev/nvme* /dev/vd*; do
    if [ -e "$device" ]; then
      echo "cskip: refusing to run: host block device $device is visible in this container," >&2
      echo "cskip: so it does not isolate the host disk. Rebuild the devcontainer from the" >&2
      echo "cskip: current repo (Dev Containers: Rebuild Container) and try again." >&2
      return 1
    fi
  done

  claude --permission-mode bypassPermissions "$@"
}
