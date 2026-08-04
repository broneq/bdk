---
paths:
  - "skills/**/*.md"
  - "agents/**/*.md"
  - "hooks/**/*"
  - "STARTUP_INSTRUCTIONS.md"
---

# Testing Protocol — How to Verify BDK Changes

## Testing Skills

Never test skills inside BDK repo — BDK meta-project, won't exercise skills naturally.

**Standard workflow:**
1. Make changes in this repo
2. Open Claude Code in separate test project (any language/stack)
3. Install BDK: `/plugin install ~/projects/bdk`
4. Invoke changed skill: `/bdk:<skill-name>`
5. Verify correct behavior in that project's context

## Skill Evals

For repeatable testing, use eval format defined in `.claude/rules/skill-test-eval.md`.

Evals live in `tests/evals/skills/<skill-name>/`. Each eval contains:
- Prompt exercising skill
- Assertions about expected output or behavior

Run evals in test project after installing BDK locally.

## Testing STARTUP_INSTRUCTIONS.md Changes

Shared foundation injected at session start. After changing:
1. Start fresh Claude Code session in test project (with BDK installed)
2. Verify session context reflects updated instructions
3. Run any skill relying on modified section

Content gated on runtime conditions (`env.*`, `cmd.*`) must be verified from a session that actually satisfies the gate. Rendering the file by hand with a faked environment proves the injection resolves, not that the guidance reaches the model or that the described commands work. Verify both gate states: content present when satisfied, absent when not.

## Hooks

After changing `hooks/hooks.json` or hook scripts:
1. Install BDK into test project
2. Start new Claude Code session to trigger `SessionStart`
3. Confirm hook executed (check output or side effects)