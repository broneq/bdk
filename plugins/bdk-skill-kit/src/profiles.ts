// Frontmatter field lists per profile. One file, so a host that adds a field
// is a one-line release. Read on 2026-09-25 from:
// - Agent Skills specification: https://agentskills.io/specification
// - Claude Code skills: https://code.claude.com/docs/en/skills
// - Claude Code subagents: https://code.claude.com/docs/en/sub-agents
// Re-read on 2026-10-07 for the plugin-ignored agent fields (sub-agents and
// plugins/components) and `permissionMode`.
import type { Profile, TargetKind } from "./index.ts";

export const PORTABLE_FIELDS = [
  "name",
  "description",
  "license",
  "compatibility",
  "metadata",
  "allowed-tools",
] as const;

const CLAUDE_CODE_SKILL_FIELDS = [
  ...PORTABLE_FIELDS,
  "when_to_use",
  "argument-hint",
  "arguments",
  "disable-model-invocation",
  "user-invocable",
  "disallowed-tools",
  "model",
  "effort",
  "context",
  "agent",
  "background",
  "hooks",
  "paths",
  "shell",
] as const;

const CLAUDE_CODE_AGENT_FIELDS = [
  "name",
  "description",
  "tools",
  "disallowedTools",
  "model",
  "maxTurns",
  "skills",
  "memory",
  "background",
  "omitClaudeMd",
  "effort",
  "isolation",
  "color",
  "experimental",
] as const;

/** Known agent fields that Claude Code ignores when the agent ships in a plugin. */
export const PLUGIN_IGNORED_AGENT_FIELDS = [
  "hooks",
  "mcpServers",
  "permissionMode",
  "initialPrompt",
] as const;

export const PERMISSION_MODES = [
  "default",
  "manual",
  "acceptEdits",
  "auto",
  "dontAsk",
  "bypassPermissions",
  "plan",
] as const;

/** The fields a target admits: `plugin` only matters for agents. Skills read it in `name-format`. */
export function allowedFields(
  kind: TargetKind,
  profile: Profile,
  plugin = true,
): readonly string[] {
  if (kind === "agents") {
    return plugin
      ? CLAUDE_CODE_AGENT_FIELDS
      : [...CLAUDE_CODE_AGENT_FIELDS, ...PLUGIN_IGNORED_AGENT_FIELDS];
  }
  return profile === "portable" ? PORTABLE_FIELDS : CLAUDE_CODE_SKILL_FIELDS;
}

/** Description caps: `description` + `when_to_use` in the skill listing, or the standard's cap. */
export function descriptionCap(profile: Profile): number {
  return profile === "portable" ? 1024 : 1536;
}
