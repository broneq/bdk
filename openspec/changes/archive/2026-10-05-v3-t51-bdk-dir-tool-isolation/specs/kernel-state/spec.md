## ADDED Requirements

### Requirement: Committed state is hashed byte for byte

The kernel SHALL hash committed state over its exact bytes and SHALL NOT normalise it for any formatter: the graph input hashes over a Change's artifacts (`kernel-pipeline`, Artifact kinds) and the `bdk-merge-hash` of a living spec (`Living spec file`). A tool that rewrites a file under `.bdk/` therefore shows as a stale node, whose `explain` names the recorded and the current hash, and as the `merge-hash` finding of `bdk doctor`; the ledger, attempt records and evidence manifests carry no hash of their own bytes and still read. The protection is that the project's tools exclude `.bdk/` (`stage-skills`, setup keeps .bdk/ out of the project's tools) and that no role rewrites `.bdk/` files (`role-contracts`, Contracts leave BDK's own files to setup).

#### Scenario: prettier over a reviewed Change

- **WHEN** the repository's pinned `prettier --write .` runs over a project whose `tiny` Change passed `gate:review` and whose living spec `auth/login` was merged and committed
- **THEN** files under `.bdk/` change, `plan-part:01` is `stale` with both hashes in its `why`, `bdk doctor --json` reports the `merge-hash` finding at level `fail` for `.bdk/specs/auth/login/spec.md`, and `bdk log list --json` exits 0

#### Scenario: prettier with .bdk/ ignored

- **WHEN** the same run happens with `.bdk/` listed in the project's `.prettierignore`
- **THEN** no file under `.bdk/` changes, `plan-part:01` stays `done`, and `bdk doctor --json` reports no `merge-hash` finding
