# The shared foundation

!!! warning "Describes BDK v2"

    This page describes BDK v2. The v3 documentation replaces it (T50).

Every BDK skill starts with the same line: *relies on BDK foundation (`STARTUP_INSTRUCTIONS.md`)*. That file is the contract each skill inherits instead of restating. It is what makes a plain session, with no BDK skill invoked at all, still behave like a BDK session.

## What gets injected, and when

`STARTUP_INSTRUCTIONS.md` is delivered by a `SessionStart` hook that prints the file as is. The text reaches the model before your first prompt, so it is in context for the whole session.

It carries four things:

| Section | What it settles |
|---|---|
| Agents | The subagent fleet, each one's model, and when to continue one rather than spawn a new one. See [Agents](agents.md). |
| Verification Proportionality | How much checking a change of a given size deserves. See [Verification scoping](verification-scoping.md). |
| Quality Rules | That BDK ships language-agnostic rule sets and how to override them. See [Quality and language rules](quality-and-language-rules.md). |
| Capture Conventions | Where a lesson or convention belongs, including the case where the answer is "nowhere". |

Everything else that could vary per project, including the test runner, the lint command, and the build tool, is deliberately absent. Skills never name a runner. The commands live in `.bdk/settings.json` and reach the agents that need them through preloaded meta-skills, which is what keeps a single skill body correct in a Python repo and a TypeScript repo at once.

## Why it is static

The hook prints the file without rendering it. Claude Code evaluates dynamic `` !`...` `` blocks in skill bodies only, never in hook output, so a dynamic block in `STARTUP_INSTRUCTIONS.md` would reach the model as literal text. Everything in the file is therefore plain prose that holds for every project, and it reaches the model even in an unconfigured project.

## Subagents do not inherit it

This is the part that surprises people. Skills are not inherited from the parent conversation, so a subagent spawned by `/bdk:cr` or `/bdk:subagent-execute-plan` starts without the foundation the orchestrator received. A reviewer that does not know the project's quality rules reviews against none, and nothing errors.

Plugin subagents cannot fix this with their own hook: the `hooks`, `mcpServers`, and `permissionMode` frontmatter fields are ignored when an agent ships inside a plugin. The supported field is `skills:`, which preloads full skill content into the subagent's context at startup.

So BDK ships a set of internal meta-skills whose only job is to be preloaded. Each is a frontmatter block plus a single dynamic line, for example:

```markdown
!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject-rules.py code-quality`
```

Because that line lives in a skill body, it does resolve at preload time, and the subagent receives the same rules the orchestrator works by.

```mermaid
flowchart TB
    hook["SessionStart hook<br/>prints STARTUP_INSTRUCTIONS.md"] --> orch["Orchestrator session<br/>has the foundation"]
    orch -->|"Agent tool dispatch"| fm["agents/&lt;name&gt;.md frontmatter"]
    fm -->|"skills: list"| meta["Meta-skills<br/>bdk-rules-*,<br/>bdk-lint-tools, bdk-test-tools"]
    meta -->|"! blocks resolve at preload"| sub["Subagent context<br/>same rules"]
    fm -->|"static markdown"| body["Agent body<br/>system prompt"]
    body --> sub
    settings[("BDK settings")] --> meta
```

The meta-skills are marked `user-invocable: false`. They are listed in [Skills](../reference/skills.md) as a group rather than individually, because you never call them.

## Capture conventions

The last section of the foundation is a routing table for knowledge. Before recording a convention or a lesson anywhere, decide where it belongs:

| The knowledge | Where it goes |
|---|---|
| Cross-cutting invariant whose violation fails silently | `.claude/rules/`, scoped by the narrowest path glob that covers it |
| Trap visible at the code site where the mistake happens | a doc comment there |
| Something a test or a linter already enforces | one line naming the enforcer |
| Anything else | nothing |

A line that a rename or a file move would force you to edit is a mirror of the code, not a rule. The fourth row is the frequent and correct answer: never write something down just to have written it. `/bdk:add-rule` runs this routing properly and `/bdk:refine-rules` cleans up what accumulated anyway; see [Rules hygiene](../workflows/rules-hygiene.md).

This table is in the foundation rather than in those two skills because the decision usually happens in the middle of other work, at the moment you notice something, and not while you are running a rules skill.

## What this buys you

- **One place to change a convention.** Edit the foundation and every existing skill, plus every skill written afterwards, inherits the change.
- **A safe trivial tier.** Built-in plan mode plus a hand edit is still governed by verification proportionality and the quality rules, which is why [the trivial workflow](../workflows/trivial.md) needs no BDK skill at all.
- **No prompt drift between orchestrator and subagent.** Both read the same rules, resolved from the same settings.

!!! warning
    The foundation occupies context in every single session. Keep additions to it short, and prefer putting detail in a skill that loads on demand.
