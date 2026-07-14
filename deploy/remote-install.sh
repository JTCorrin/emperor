#!/usr/bin/env bash
# Idempotent remote install for Emperor on an LXC (or any systemd host).
# Expected env (set by Forgejo deploy workflow):
#   DEPLOY_PATH  APP_HOST  APP_PORT  APP_ORIGIN
# Uses systemd --user (no sudo). Run deploy/bootstrap-lxc-root.sh once as root first.
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:?DEPLOY_PATH is required}"
DEPLOY_USER="${DEPLOY_USER:-$(whoami)}"
APP_HOST="${APP_HOST:-0.0.0.0}"
APP_PORT="${APP_PORT:-3000}"
APP_ORIGIN="${APP_ORIGIN:?APP_ORIGIN is required}"

export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"

cd "${DEPLOY_PATH}"

if ! command -v pnpm >/dev/null 2>&1; then
	echo "pnpm not found on PATH for $(whoami); install Node 22+ and pnpm first." >&2
	exit 1
fi

NODE_BIN="$(command -v node)"
if [[ ! -x "${NODE_BIN}" ]]; then
	echo "node not found on PATH for $(whoami); install Node 22+ first." >&2
	exit 1
fi

# Ignore lifecycle scripts: prepare runs svelte-kit sync (devDependency), which is
# not installed under --prod. The CI build already produced build/.
pnpm install --prod --frozen-lockfile --ignore-scripts

UNIT_SRC="${DEPLOY_PATH}/deploy/emperor.service"
UNIT_DIR="${HOME}/.config/systemd/user"
UNIT_DST="${UNIT_DIR}/emperor.service"
UNIT_TMP="$(mktemp)"

mkdir -p "${UNIT_DIR}"

sed \
	-e "s|__DEPLOY_PATH__|${DEPLOY_PATH}|g" \
	-e "s|__DEPLOY_USER__|${DEPLOY_USER}|g" \
	-e "s|__NODE_BIN__|${NODE_BIN}|g" \
	-e "s|__APP_HOST__|${APP_HOST}|g" \
	-e "s|__APP_PORT__|${APP_PORT}|g" \
	-e "s|__APP_ORIGIN__|${APP_ORIGIN}|g" \
	"${UNIT_SRC}" > "${UNIT_TMP}"

mv "${UNIT_TMP}" "${UNIT_DST}"

if ! systemctl --user daemon-reload; then
	echo "systemctl --user failed. On the LXC, run once as root:" >&2
	echo "  DEPLOY_USER=${DEPLOY_USER} bash ${DEPLOY_PATH}/deploy/bootstrap-lxc-root.sh" >&2
	exit 1
fi

systemctl --user enable emperor
systemctl --user restart emperor

echo "Emperor restarted at ${APP_ORIGIN} (HOST=${APP_HOST} PORT=${APP_PORT})"
