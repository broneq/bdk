## MODIFIED Requirements

### Requirement: Blocks in order

The skill SHALL compose these steps in this order and never do a block's work itself:

1. commit the work left in the tree, when `git status --porcelain` lists any change, through the `commit` skill;
2. start `spec-conformance` on the `bdk:verifier` agent (`Agent`, `subagent_type: "bdk:verifier"`, prompt `Run the skill bdk:spec-conformance with the arguments: <change> --base <diff base>`, the diff base being `origin/<base>` when that remote branch exists, else `<base>`, and `model` `models.verifier` when the configuration sets it) and read the first line of `.bdk/runs/<change>/close/spec-conformance.md`;
3. archive the Change with `openspec archive <change> --yes`;
4. commit the archive through the `commit` skill;
5. push the branch and open the pull request.

Before each step it SHALL tell the user in one line what runs and what it writes.

#### Scenario: Conforming Change closed

- **WHEN** `/bdk:close add-total` runs on the branch `add-total` of a configured project whose Change conforms to the code, with a remote `origin` and the base `main`
- **THEN** the `bdk:verifier` agent runs before `openspec archive add-total --yes`, the archive is committed on `add-total`, the branch is pushed to `origin`, and `gh pr create` runs with `--base main` and `--head add-total`

#### Scenario: Work left in the tree

- **WHEN** `/bdk:close add-total` runs with uncommitted changes to the code of the Change
- **THEN** the `commit` skill commits them before the `bdk:verifier` agent starts, so the verifier's `git diff <base>...HEAD` holds them

#### Scenario: Verifier model

- **WHEN** `/bdk:close add-total` runs in a project whose configuration sets `models.verifier: sonnet`
- **THEN** the `bdk:verifier` agent starts with `model` `sonnet`
