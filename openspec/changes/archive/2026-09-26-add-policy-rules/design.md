# Design

## Context

See proposal.md - Why. The source semantics are BDK's `bdk` plugin (`tools/skill-check/bdk-rules.ts` in BDK) and its unit tests, which cover code-fence handling, path and URL exclusions of slash references, fingerprints that survive volatile messages, and tool lists written as a YAML list or as a string.

## Goals / Non-Goals

**Goals:**

- No consumer name in the kit: every BDK-specific value becomes an option.
- One rule per check a consumer turns on or off independently.
- A misconfigured policy rule fails at load time, not silently at check time.

**Non-Goals:**

- A schema language for options. Each rule validates its own options in code.
- Deriving the required `allowed-tools` entries from the block commands. The host's permission matching is not specified tightly enough to reproduce.

## Decisions

**Policy rules are off by default and need options.** `block-form`, `block-allowed-tools`, `forbidden-text`, `required-fields`, `body-shape` and `namespaced-refs` encode a project's choices (which block forms, which terms, which skills are gates). Alternative: sensible defaults, such as `namespaced-refs` guessing the namespace from `.claude-plugin/plugin.json`. It lost because a guess that is wrong reports errors on correct files, and the kit checks trees that are not plugins. `portable-syntax` has no project choice in it, so it is on by default.

**`validateOptions` on the rule, called by the loader.** A rule may declare `validateOptions(options)`, returning a problem or `undefined`. The loader calls it with the merged options for every target whose kind the rule applies to, when the rule has `check` and is enabled for that target, and with the global settings when the rule has `checkProject` and is enabled globally. The tester calls the same function. Alternative: a declarative `requiredOptions` list. It lost because the policy rules also need shape checks (a regex that compiles, an enum, a non-empty list), which a list of names cannot express. Alternative: throw from `check`. It lost because the error would surface only when a document triggers it, and as a crash instead of exit 2.

**`portable-syntax` is a rule, not a `fields` extension.** `fields` is about frontmatter keys; this is about body syntax, and a consumer may want to set its severity apart. It reports `!` blocks and every `${CLAUDE_*}` substitution, because every Claude Code variable (`CLAUDE_SKILL_DIR`, `CLAUDE_PLUGIN_ROOT`, `CLAUDE_SESSION_ID` and the rest) reaches another host as literal text.

**The kit's `skill-check` skill moves to `claude-code`.** It runs `node ${CLAUDE_PLUGIN_ROOT}/dist/skill-check.mjs`, which is Claude Code plugin syntax, so `portable-syntax` rightly reports it. Alternatives: exempt frontmatter and fences from `portable-syntax` (lost: a portable skill with a fenced `${CLAUDE_PLUGIN_ROOT}` command still breaks on other hosts), or add a per-skill filter to targets (lost: new config surface for one file). A test copies `skills/skill-authoring` into a portable target and requires a clean run, so that skill keeps its portable guarantee.

**`forbidden-text` matches words or substrings, per term.** A term lists `words`, a `match` mode (`word`: not part of a longer word or hyphenated name; `substring`: anywhere), a `where` scope (`anywhere`, or `code`: backticked spans and fenced lines only) and names exempt via `allow`. Internal whitespace in a word matches any run of whitespace. Alternative: raw regexes. It lost because every consumer would re-derive the boundary and fence logic, which is the part BDK's tests pin down.

**Stable fingerprints.** Messages that carry counts or missing entries (`block-allowed-tools`, `required-fields`, `body-shape`) report a fixed `match`, so a baseline entry survives a partial fix. Line-based findings (`block-form`, `forbidden-text`, `portable-syntax`) match the construct and the line text, as BDK's did.

**A shared tool-list parser.** `required-fields` `includes` and `block-allowed-tools` read a list field either as a YAML list or as a string split on spaces and commas outside parentheses, so `Bash(git add *, git commit *)` stays one entry. It lives in `src/rules/shared.ts` with the name resolution (frontmatter `name`, else the skill directory or the agent file name).

## Risks / Trade-offs

- [`portable-syntax` is new on by default] → Consumers with portable skills may see new errors on upgrade. The release is a minor pre-1.0 version marked breaking, and the baseline covers adoption.
- [Sentence counting in `body-shape` is punctuation-based] → Abbreviations such as "e.g." count as sentence ends. The rule targets one-line bodies, where this is rare, and the message states the counts it saw.
