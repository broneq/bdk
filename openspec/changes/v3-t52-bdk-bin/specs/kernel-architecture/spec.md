## ADDED Requirements

### Requirement: Plugin launcher

The plugin SHALL ship `bin/bdk`, a tracked POSIX `sh` script with the executable bit (git mode `100755`) and LF line endings (pinned in `.gitattributes`), that runs the bundle: it finds the plugin root from its own path, checks that `node` is on `PATH` and that `dist/bdk.mjs` exists, and then replaces itself with `node "<plugin root>/dist/bdk.mjs"` and its own arguments, so the kernel sees the same argv, stdin, working directory and exit code as when it is run by path. When a check fails, it SHALL write one line `bdk: kernel unavailable: <cause>; <repair>` to stderr, with the repair `install Node >= 22.13 and run /bdk:setup` for a missing `node` and `reinstall the BDK plugin` for a missing bundle, write nothing to stdout, and exit 5. It SHALL NOT check the Node version: the kernel refuses a Node below the minimum itself (`kernel-cli`, Invocation). `bin/` holds no other file. The launcher is not a build output: it is tracked on every branch and runs the bundle whether `dist/bdk.mjs` was built or committed (`Distribution ref`).

#### Scenario: arguments, stdin and exit code pass through

- **WHEN** `bin/bdk log add --body - finding "x y"` runs with a body on stdin, and a command that refuses with exit 2 runs through it
- **THEN** the kernel receives the arguments as separate words and the body on stdin, and the launcher exits with the kernel's exit code, 2 for the refusal

#### Scenario: launcher without Node

- **WHEN** `bin/bdk version` runs with a `PATH` that holds no `node`
- **THEN** it exits 5, stdout is empty, and stderr is `bdk: kernel unavailable: node is not on PATH; install Node >= 22.13 and run /bdk:setup`

#### Scenario: launcher without the bundle

- **WHEN** `bin/bdk version` runs in a plugin directory without `dist/bdk.mjs`
- **THEN** it exits 5 and stderr names the missing bundle path and `reinstall the BDK plugin`

#### Scenario: launcher tracked as an executable

- **WHEN** `git ls-files -s bin/bdk` and `git check-attr eol bin/bdk` run
- **THEN** the mode is `100755` and `eol` is `lf`

#### Scenario: plugin validates with bin/

- **WHEN** `claude plugin validate .` runs in the repository root
- **THEN** it reports `Validation passed`
