#!/bin/bash
# Eval-only Claude Code shell prefix (CLAUDE_CODE_SHELL_PREFIX) for macOS without Homebrew git.
# The /usr/bin/git shim goes through xcrun, which fails inside the eval sandbox; the sandbox also
# denies stat of /Library/Developer, so PATH lookup cannot find the real binary. Executing it by
# absolute path works, so define git as a function after the shell snapshot has loaded.
fn='git() { /Library/Developer/CommandLineTools/usr/bin/git "$@"; }'
cmd="$*"
cmd="${cmd/&& eval /&& $fn && eval }"
exec /bin/zsh -c "$cmd"
