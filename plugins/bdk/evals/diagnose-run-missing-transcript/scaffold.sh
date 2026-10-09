#!/usr/bin/env bash
# diagnose-run.sh with the judge's transcript gone and its .meta.json kept, as when the host
# writes no transcript for an agent (#157).
set -euo pipefail
bash "$(dirname "$0")/../fixtures/diagnose-run.sh"
rm .git/bdk-eval/transcripts/*/subagents/agent-a8825458cd75f6395.jsonl
