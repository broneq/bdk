---
schema: 1
id: BDK-CQ-9
kind: house
severity: high
origin: bdk
since: 2026-10-04
applies:
  - "**/package-lock.json"
  - "**/npm-shrinkwrap.json"
  - "**/pnpm-lock.yaml"
  - "**/yarn.lock"
  - "**/bun.lock"
  - "**/bun.lockb"
  - "**/Cargo.lock"
  - "**/poetry.lock"
  - "**/uv.lock"
  - "**/Pipfile.lock"
  - "**/go.sum"
  - "**/Gemfile.lock"
  - "**/composer.lock"
  - "**/mix.lock"
  - "**/pubspec.lock"
  - "**/Package.resolved"
  - "**/packages.lock.json"
---

**Regenerate a lockfile, never merge it by hand.** A package manager's lockfile is generated from the manifests, and a hand-merged one can parse while it pins versions no install would choose or drops integrity hashes. On a conflict, take either side of the lockfile, merge the manifests it comes from, and run the package manager's install or lock command to write it again; commit the result it produces.
