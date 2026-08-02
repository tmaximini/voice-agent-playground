#!/usr/bin/env bash
# One-command cloud dev stack: agent (bare venv) + worker + frontend, all
# against a LiveKit Cloud project. Credentials come from .env.cloud at the
# repo root (copy .env.cloud.example). Ctrl-C stops everything.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env.cloud ]; then
  echo "Missing .env.cloud — copy .env.cloud.example and fill in your LiveKit Cloud project:"
  echo "  cp .env.cloud.example .env.cloud"
  exit 1
fi
set -a
# shellcheck disable=SC1091
source .env.cloud
set +a
: "${LIVEKIT_URL:?LIVEKIT_URL missing in .env.cloud (wss://<project>.livekit.cloud)}"
: "${LIVEKIT_API_KEY:?LIVEKIT_API_KEY missing in .env.cloud}"
: "${LIVEKIT_API_SECRET:?LIVEKIT_API_SECRET missing in .env.cloud}"

if [ ! -x agent/.venv/bin/python ]; then
  echo "Agent venv missing. One-time setup:"
  echo "  cd agent && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt \\"
  echo "    && .venv/bin/python src/main.py download-files"
  exit 1
fi

# Kill the whole process group on exit so no stray dev servers linger.
trap 'kill 0' EXIT INT TERM

(cd agent && exec .venv/bin/python src/main.py dev) &
(cd packages/worker && exec pnpm exec wrangler dev \
  --var LIVEKIT_URL:"$LIVEKIT_URL" \
  --var LIVEKIT_API_KEY:"$LIVEKIT_API_KEY" \
  --var LIVEKIT_API_SECRET:"$LIVEKIT_API_SECRET") &
(cd packages/frontend && exec pnpm exec vite) &

echo ""
echo "cloud dev stack starting → frontend http://localhost:5173, worker http://localhost:8787"
echo "waiting for agent 'registered worker' in the logs above…"
wait
