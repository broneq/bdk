# Testing Protocol — How to Verify BDK Changes

## Testing Skills

Never test skills inside BDK repo — BDK is meta-project, won't exercise skills naturally.

**Standard workflow:**
1. Make changes in this repo
2. Open Claude Code in separate test project (any language/stack)
3. Install BDK: `/plugin install ~/projects/bdx`
4. Invoke changed skill: `/bdk:<skill-name>`
5. Verify correct behavior in that project's context

## Skill Evals

For repeatable testing, use eval format defined in `rules/skill-test-eval.md`.

Evals live in `tests/skills/<skill-name>/`. Each eval contains:
- Prompt exercising the skill
- Assertions about expected output or behavior

Run evals in test project after installing BDK locally.

## Testing STARTUP_INSTRUCTIONS.md Changes

Shared foundation injected at session start. After changing:
1. Start fresh Claude Code session in test project (with BDK installed)
2. Verify session context reflects updated instructions
3. Run any skill relying on modified section

## Hooks

After changing `hooks/hooks.json` or hook scripts:
1. Install BDK into test project
2. Start new Claude Code session to trigger `SessionStart`
3. Confirm hook executed (check output or side effects)