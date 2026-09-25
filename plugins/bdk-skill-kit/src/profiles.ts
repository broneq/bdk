// Frontmatter field lists per profile. One file, so a host that adds a field
// is a one-line release. Read on 2026-09-25 from:
// - Agent Skills specification: https://agentskills.io/specification
// - Claude Code skills: https://code.claude.com/docs/en/skills
// - Claude Code subagents: https://code.claude.com/docs/en/sub-agents
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
  "initialPrompt",
  "experimental",
] as const;

/** Known agent fields that Claude Code ignores when the agent ships in a plugin. */
export const PLUGIN_IGNORED_AGENT_FIELDS = ["hooks", "mcpServers", "permissionMode"] as const;

export function allowedFields(kind: TargetKind, profile: Profile): readonly string[] {
  if (kind === "agents") return CLAUDE_CODE_AGENT_FIELDS;
  return profile === "portable" ? PORTABLE_FIELDS : CLAUDE_CODE_SKILL_FIELDS;
}

/** Description caps: `description` + `when_to_use` in the skill listing, or the standard's cap. */
export function descriptionCap(profile: Profile): number {
  return profile === "portable" ? 1024 : 1536;
}
