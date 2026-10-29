---
status: accepted
date: 2026-10-29
decision-makers: broneq
enforced-by:
  - scripts/docs-impact/rule.test.ts
---

# ADR-0005: The repository process runs without OpenSpec - decisions in ADRs, current state in code, tests and Concepts

## Context and Problem Statement

Until #442 every piece of work in this repository was an issue, an OpenSpec Change and a pull request: a proposal, spec deltas, a design and tasks under `openspec/changes/`, merged into main specs under `openspec/specs/` by `openspec archive`, with `openspec validate --specs --strict` as a required CI check. Two problems showed in daily use:

- **Heavy text for small changes.** A Change carried the same artifacts whatever its size; a change to two files came with about 1000 lines of proposal, deltas, design and tasks to write, review and archive.
- **Unreliable current truth.** The main specs were meant to say what the product does today, but the archive merges spec deltas by requirement name, and that merge can drop scenarios ([Fission-AI/OpenSpec#2033](https://github.com/Fission-AI/OpenSpec/issues/2033)). A reader could not trust the specs without checking them against the code, which defeats their purpose.

The main specs were converted into ADRs and Concepts pages by #437-#440 and deleted. What does the repository process use in their place, and what happens to the `bdk` product, which is built on OpenSpec?

## Decision Drivers

- **Cost per change** in proportion to the change: a small fix carries little text.
- **One trusted description of the current state**, checked by something that fails when it drifts.
- **Decisions kept with their reasons**, so a later contributor does not undo a trade-off by accident.
- **No change to the product** for its users.

## Considered Options

1. **No OpenSpec in the repository process:** issue, branch, one pull request; an ADR only for a decision that needs one; the current state in code, tests and Concepts.
2. **Keep OpenSpec, only for large changes.**
3. **Keep OpenSpec as it was** and work around the archive merge by reviewing every merged spec by hand.

## Decision Outcome

**Chosen option: 1.** A contributor or agent ships work as a GitHub issue, a branch from that issue and one pull request into `staging/v3` with one Conventional Commit. A decision that is hard to reverse, surprising without context and the result of a real trade-off is recorded as an ADR (format in `CONTRIBUTING.md`, "ADRs") in the same pull request. The current state of the product is described by its code, its tests and the Concepts pages of the docs site, which the name check and the docs-impact rule keep tied to the sources. `openspec/`, the `opsx` commands and `openspec-*` skills under `.claude/`, the `openspec` CI job and the `openspec/specs/` path of the docs-impact rule are removed.

The `bdk` product is not part of this decision: its skills, CLI and schema keep using OpenSpec in the projects it is installed in ([ADR-0003](0003-v3-architecture-skills-first.md); [OpenSpec Changes](../concepts/openspec-changes.md)). This ADR replaces only ADR-0003's step to initialise OpenSpec in this repository.

### Consequences

- ✅ A small change costs a small diff: no proposal, deltas, design or tasks to write for it.
- ✅ The current state has one source that tests check, instead of specs that could silently lose scenarios.
- ✅ Decisions keep their reasons in ADRs, written only when a decision earns one.
- ❌ Requirements that had scenarios are no longer collected in one place per capability; a reader finds them in tests and Concepts pages.
- ❌ The repository no longer uses the product's own spec flow on itself, so OpenSpec defects reach the product without this repository meeting them first; the product's tests and evals carry that.
- 🟡 The archived Changes stay in git history (last at commit `c4f2b2a0cb7c1bfe672c0a7a88e690221fba2dc0`).

## Pros and Cons of the Options

### 1 - No OpenSpec in the repository process

- Good: cost in proportion to the change; one checked description of the current state; fewer tools and CI jobs.
- Bad: no per-capability requirement list; the product's spec flow is no longer exercised here.

### 2 - OpenSpec only for large changes

- Good: small changes get lighter.
- Bad: the main specs drift as soon as small changes skip them, and the archive merge still drops scenarios; a rule for "large" to argue about on every issue.

### 3 - OpenSpec as it was

- Good: no change to the process.
- Bad: keeps both problems; a hand review of every merged spec adds the cost the specs were meant to save.

## More Information

- The required status checks of the `staging/v3` ruleset are GitHub settings, not repository files: the `openspec` check is removed there by the maintainer.
- Issue: #442 (parent #435).
