#!/bin/bash
# Eval-only Claude Code shell prefix (CLAUDE_CODE_SHELL_PREFIX) for macOS without Homebrew git.
# The /usr/bin/git shim goes through xcrun, which fails inside the eval sandbox; the sandbox also
# denies stat of /Library/Developer, so PATH lookup cannot find the real binary. Executing it by
# absolute path works, so define git as a function after the shell snapshot has loaded.
real=/Library/Developer/CommandLineTools/usr/bin/git
# Copied as git next to this script, it is that git for the processes git starts by name
# (a push's pack-objects and receive-pack side), which the function cannot reach. The run's
# sandbox reads this directory only because evals/run.ts puts it first on PATH.
if [ "$(basename "$0")" = git ]; then exec "$real" "$@"; fi
bin="$(cd "$(dirname "$0")" && pwd)"
fn="export PATH=\"$bin:\$PATH\" && git() { $real \"\$@\"; }"
cmd="$*"
cmd="${cmd/&& eval /&& $fn && eval }"
exec /bin/zsh -c "$cmd"
