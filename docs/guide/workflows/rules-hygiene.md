# Rules hygiene

Rules cost context in every package that carries them, and a rule nobody needs still costs it. Left alone, a rule set turns into a changelog: incident stories written as rules, near-duplicates, and rules for code that no longer exists.

BDK keeps two things apart. A **lesson** is what happened: it goes into the ledger as a `learning` entry and never becomes a rule by itself. A **rule** is a choice you decide to keep: you adopt it explicitly, and it gets an id. The audit in between is where you decide.

## Record lessons, not rules

When an agent or you learn something the hard way, record it as a learning in the current Change:

```bash
bdk log add learning "forms lost the pending state on retry" --ref 02-3 --ticket A-7f3k9m2q
```

`--applies <glob>` names the files the lesson is about; under a task ticket it defaults to the task's `Files:`. The kernel stamps a fingerprint, so the same lesson in several Changes can be counted. Closing a Change writes no rule.

## Audit what recurs

```bash
bdk rules stats
bdk rules stats --entries
```

`rules stats` looks at every Change the index holds, archived ones included:

- **recurring**: lessons and findings with the same fingerprint in at least `rules.audit.min-changes` Changes (3 by default);
- **entries** (with `--entries`): the raw learnings, findings and blockers, newest first, each marked when a rule was already adopted from it;
- **citations**: how often each rule id was cited by an entry, and in how many Changes.

A lesson that recurs is a candidate, not a rule. Before you adopt it, check it against the definition in [Quality and language rules](../concepts/quality-and-language-rules.md#what-a-rule-is): a fact about your own system belongs in code or documentation, and a process lesson stays a lesson.

## Adopt a rule

```bash
bdk rules accept "Keep the pending state in the form's own store." \
  --prefix FORM --applies "web/forms/**" \
  --from 2026-09-25-login/L-00000012
```

`rules accept` is the only way to create a rule file. It writes `.bdk/rules/FORM-<n>.md` with the next free number (tombstones included), and records the entries of `--from` as its `origin` and `evidence`. Other flags: `--kind knowledge` with `--source` and `--verified`, `--severity`, and `--role` to name the roles that read it.

## Remove what no longer pays

```bash
bdk rules prune
```

`rules prune` reports rules whose `applies` globs match no file of the work tree, and, once the project has at least `rules.prune.uncited-changes` Changes (20 by default), rules that no entry of those Changes cites. It only reports. To remove a project rule, turn its file into a tombstone: add `removed: <reason>` to the frontmatter and keep the body, so the id is never reused. To stop reading a shipped rule, list its id in `rules.disabled`.

## Hand-written `.claude/rules/`

Files you wrote in `.claude/rules/` are Claude Code's, not BDK's: they load in a session by their `paths:`, and BDK never reads, writes or reports them. BDK agents do not see them in their packages and cannot cite them. When an agent must follow one of them, adopt that one rule with `bdk rules accept`, scoped with the narrowest `--applies` glob.

## Let the skill run it

`/bdk:rules` runs this cycle with you. `/bdk:rules audit` (the default) reads `bdk rules stats --entries`, groups the recurring lessons by meaning, drops what is not a rule and says why, proposes the rest, adopts the ones you accept with `bdk rules accept --from`, and then offers what `bdk rules prune` lists for removal. `/bdk:rules capture <lesson>` records one lesson as a `learning` entry of the active Change, or, without a Change, proposes it as a rule. `/bdk:rules check` runs `bdk rules check`. The skill removes a project rule only as the tombstone above, and only after you approve it.

## A working rhythm

| Moment                                               | Command                                        |
| ---------------------------------------------------- | ---------------------------------------------- |
| You just learned something the hard way              | `bdk log add learning ...`                     |
| Every few Changes                                    | `/bdk:rules audit`                             |
| Session start warns that a role reads too many rules | `bdk rules prune`, `rules.disabled`, `applies` |
| Before a big refactor                                | `bdk rules prune`                              |

## What you get

| Artifact      | Path                                           |
| ------------- | ---------------------------------------------- |
| Lessons       | `learning` entries in `.bdk/changes/<id>/log/` |
| Project rules | `.bdk/rules/<ID>.md`                           |

## Next step

Back to the [tier table](../index.md#how-you-work-with-it) for the next change, or [Quality and language rules](../concepts/quality-and-language-rules.md) for the pack BDK ships and how agents read rules.
