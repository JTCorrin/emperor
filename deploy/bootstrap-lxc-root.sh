#!/usr/bin/env bash
# One-time LXC bootstrap — run as root before the first Forgejo deploy.
#
#   scp deploy/bootstrap-lxc-root.sh root@192.168.5.112:/tmp/
#   ssh root@192.168.5.112 'DEPLOY_USER=deploy DEPLOY_PATH=/opt/emperor bash /tmp/bootstrap-lxc-root.sh'
#
set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/emperor}"

if [[ "$(id -u)" -ne 0 ]]; then
	echo "Run as root." >&2
	exit 1
fi

if ! id "${DEPLOY_USER}" >/dev/null 2>&1; then
	echo "User ${DEPLOY_USER} does not exist." >&2
	exit 1
fi

install -d -o "${DEPLOY_USER}" -g "${DEPLOY_USER}" -m 0755 "${DEPLOY_PATH}"
install -d -o "${DEPLOY_USER}" -g "${DEPLOY_USER}" -m 0755 /var/log/emperor 2>/dev/null || true

loginctl enable-linger "${DEPLOY_USER}"

# Retire the system-wide stub so Forgejo deploy owns a user service on port 3000.
if systemctl is-active emperor >/dev/null 2>&1; then
	systemctl stop emperor
fi
if systemctl is-enabled emperor >/dev/null 2>&1; then
	systemctl disable emperor
fi
rm -f /etc/systemd/system/emperor.service
systemctl daemon-reload

echo "Bootstrap complete for ${DEPLOY_USER}."
echo "  linger: enabled"
echo "  app root: ${DEPLOY_PATH}"
echo "Push to main to deploy via Forgejo (no sudo required for ${DEPLOY_USER})."
