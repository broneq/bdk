#!/usr/bin/env bash
# The recorded /bdk:debug run of the tally crash, with its transcripts in .git/bdk-eval/transcripts.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/diagnose-run.sh"
