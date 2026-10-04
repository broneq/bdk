# Worktree parts

Parts of one plan wave run side by side in one working tree when their `Files:` are disjoint. Some state stays shared even then: two parts that each run `npm install` both rewrite `package.json` and `package-lock.json`, and two parts that each run codegen, a migration generator or a snapshot update write the same generated files. `/bdk:plan` marks such a part `isolation: worktree`, and the kernel builds it in its own git worktree on its own branch, then merges it back when the part is done.

## Marking a part

The planner decides per part, in the plan part's frontmatter:

```yaml
---
schema: 1
id: "02"
title: Problem equality
depends-on: []
isolation: worktree
isolation-reason: both parts add a dependency with npm install, which rewrites package.json and package-lock.json
---
```

`isolation` is `shared` (the default) or `worktree`. A worktree part needs an `isolation-reason` naming the state outside `Files:` that it shares with another part of its wave; `bdk done plan` refuses one without it. `/bdk:verify-plan` reports two shared parts of one wave that rewrite the same generated state as a blocker, so the planner either isolates one of them or orders them with `depends-on`.

## What the kernel does

- **Start.** `bdk part start <nn>` creates the worktree at `<dir>/<changeId>/<nn>` on branch `bdk-part/<changeId>/<nn>`, from the home checkout's `HEAD`. It copies the untracked, ignored files that `.worktreeinclude` names (below), then runs `execution.worktree.setup.command` there.
- **Work.** The dispatch package of every task of the part names the worktree in its `Work root` section. The role agents read, edit and run checks only inside it, and a hook refuses an edit outside it. Each task commits on the part branch with its usual trailers; evidence is hashed from the worktree's tree.
- **One ledger.** The Change's directory under `.bdk/changes/` stays in the home checkout. Every `bdk` command run from a worktree finds the home checkout itself, so the part branch never touches `.bdk/` and no ledger is merged.
- **Merge back.** `bdk part done <nn>` checks the merge off-tree with `git merge-tree --write-tree`, writes a merge commit `chore(bdk): merge part <nn> of <changeId>` with the trailers `BDK-Change` and `BDK-Part`, and fast-forwards the home checkout to it. The part's task commits keep their SHAs and trailers. The worktree and its branch are removed.
- **Recovery.** `bdk rebuild` removes the worktrees of merged parts, recreates the worktree of a started part whose directory is gone from its branch, and warns about a branch that holds commits the home checkout lacks. It never touches a worktree that the kernel did not create.

## Settings

All keys sit under `execution.worktree` in `.bdk/settings.yaml`:

| Key             | Default                   | Meaning                                                                                                                  |
| --------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `enabled`       | `true`                    | `false` builds a worktree part in the home checkout instead, alone in its wave                                           |
| `dir`           | `.bdk/.machine/worktrees` | Where the worktrees live, against the project root unless absolute                                                       |
| `setup.command` | none                      | A shell command run in each new worktree after the `.worktreeinclude` copy, for example `pnpm install --frozen-lockfile` |
| `setup.timeout` | `300`                     | Seconds the setup may run, 10 to 540                                                                                     |
| `max-live`      | `3`                       | Kernel worktrees alive at once, across the project's Changes; a further worktree part waits for a later wave             |

```bash
bdk config set execution.worktree.setup.command 'pnpm install --frozen-lockfile'
bdk config set execution.worktree.max-live 2
```

A new worktree is a fresh checkout: `node_modules/`, virtual environments and build output are absent. Set `setup.command` to whatever makes the project's tests run there.

!!! warning "Tools that crawl the project"

    The default `dir` sits inside the project, under the ignored `.bdk/.machine/`. A tool that walks the directory tree without reading `.gitignore` (a file watcher, an IDE indexer, a test runner with a broad glob, a monorepo tool) also sees a full copy of the project in each worktree. Exclude `.bdk/.machine/` in that tool, or set `dir` to a path outside the project, such as `../.bdk-worktrees`.

### `.worktreeinclude`

Ignored files that a worktree needs, such as `.env` or a local credentials file, are not checked out. List them in `.worktreeinclude` at the project root, one gitignore-style pattern per line. It is the same file Claude Code reads for its own worktrees:

```gitignore
.env
.env.local
config/secrets/*.json
```

Only files that match a pattern and that git ignores are copied. Without the file nothing is copied.

## Merge conflicts

When the part branch and the Change branch changed the same lines, `bdk part done` refuses with `policy/merge-conflict` naming the conflicting paths, and `/bdk:execute` opens a merge ticket with `bdk attempt open verify-fix <nn>`. The kernel starts the merge in the part's worktree, and the implementer's package gets a `Conflict` section with the conflicted paths and the project's conflict instruction. The implementer resolves only those paths; the scoped tests and lint run on the merged state. Closing the ticket checks that no conflict marker or unmerged path is left (`policy/merge-unresolved` otherwise), and the kernel commits the merge in the worktree. The next `bdk part done` is clean.

The default instruction, prompt key `fragments/merge-conflicts`, says:

- never hand-merge a package manager lockfile: take one side, merge the manifests and regenerate the lockfile with the package manager;
- regenerate other generated files by their command;
- renumber a migration that collides with another;
- in source and documentation, keep the intent of both sides, and report the conflict when the two sides are incompatible.

Add your project's own commands in `.bdk/prompts/fragments/merge-conflicts.md`. The file extends the default, so write only what is specific to the project:

```markdown
- `src/generated/` comes from `pnpm codegen`; run it after the merge instead of editing the files.
- Regenerate `pnpm-lock.yaml` with `pnpm install --lockfile-only`.
```

Give the file the frontmatter `mode: replace` to replace the default instead.

## Refusals

| Code                            | From                     | What to do                                                                                                          |
| ------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `runtime/git-too-old`           | `bdk part start`         | Upgrade git to 2.38 or later, or set `execution.worktree.enabled: false`                                            |
| `runtime/worktree-setup-failed` | `bdk part start`         | Fix `execution.worktree.setup` from the output tail it shows, then start the part again; or disable worktrees       |
| `policy/worktree-dirty`         | `bdk part done`          | A declared file of the part is still changed in the worktree: commit it with `bdk commit <task>`, or restore it     |
| `policy/merge-conflict`         | `bdk part done`          | `/bdk:execute` opens the merge ticket described above                                                               |
| `policy/merge-blocked`          | `bdk part done`          | The merge would overwrite a file changed in the home working tree: commit that task, then run `bdk part done` again |
| `policy/merge-unresolved`       | closing the merge ticket | Conflict markers or unmerged paths are left in the worktree: resolve them, then close the ticket again              |

No refusal falls back to the shared tree by itself. The only downgrade is the one you set: `execution.worktree.enabled: false`.
