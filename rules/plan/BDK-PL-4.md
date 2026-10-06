---
schema: 1
id: BDK-PL-4
kind: house
paths:
  - "**"
stages:
  - plan
severity: medium
origin: bdk
since: 2026-10-04
---

**A part that shares state outside its `Files:` runs in a worktree.** When two parts of one wave both change something no task lists - a lockfile both regenerate, a generated client, a migration sequence, a build cache, a port or a database a test binds - give one of them `isolation: worktree` and name that state in `isolation-reason`, so the kernel merges the two sides instead of letting them overwrite each other in one working tree. Every other part stays `shared`: a worktree costs a setup run and a merge, and disjoint `Files:` already keep parts apart.
