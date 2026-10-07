#!/usr/bin/env bash
# A small Node app with an src/api fetch layer and no ADR directory.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/tiny-ledger.sh"
mkdir -p src/api
cat > src/api/client.js <<'JS'
export async function getJson(path) {
  const response = await fetch(`/api${path}`);
  if (!response.ok) throw new Error(`GET ${path} failed: ${response.status}`);
  return response.json();
}
JS
