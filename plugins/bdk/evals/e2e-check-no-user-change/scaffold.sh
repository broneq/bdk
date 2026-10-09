#!/usr/bin/env bash
# The tally project whose Change only moves code: its proposal adds or changes nothing a user
# does, so E2E has no process to drive and must not start the product. The refactor is done:
# `src/store.js` holds the ledger file access.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/tally-cli.sh"
rm -rf openspec/changes/add-total
mkdir -p openspec/changes/extract-ledger-store
cat > openspec/changes/extract-ledger-store/.openspec.yaml <<'YAML'
schema: spec-driven
created: 2026-10-01
skip_specs: true
YAML
cat > openspec/changes/extract-ledger-store/proposal.md <<'MD'
## Why

`bin/tally.js` reads and writes `ledger.json` itself, so a second storage format would touch every command.

## What Changes

- Reading and writing `ledger.json` moves into `src/store.js`, behind `load()` and `save(entries)`.
- `bin/tally.js` calls the store; its commands, output and exit codes stay as they are.
MD
cat > src/store.js <<'JS'
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const FILE = "ledger.json";

export function load() {
  return JSON.parse(readFileSync(FILE, "utf8"));
}

export function exists() {
  return existsSync(FILE);
}

export function save(entries) {
  writeFileSync(FILE, JSON.stringify(entries));
}
JS
perl -0pi -e 's/import \{ existsSync, readFileSync, writeFileSync \} from "node:fs";/import { exists, load, save } from "..\/src\/store.js";/; s/const FILE = "ledger.json";\n//; s/function load\(\) \{\n  return JSON.parse\(readFileSync\(FILE, "utf8"\)\);\n\}\n\n//; s/existsSync\(FILE\)/exists()/g; s/writeFileSync\(FILE, JSON.stringify\(entries\)\)/save(entries)/' bin/tally.js
git add -A
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "chore: extract-ledger-store change"
