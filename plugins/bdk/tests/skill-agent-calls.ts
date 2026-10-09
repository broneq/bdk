import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** One Agent call a skill text writes: the paragraph that starts `subagent_type: "bdk:<agent>"`. */
export interface SkillAgentCall {
  skill: string;
  agent: string;
  paragraph: string;
}

const PLUGIN = join(import.meta.dirname, "..");
// `subagent_type: "bdk:verifier"` as a skill text writes an Agent call.
const AGENT_CALL = /subagent_type: "bdk:([a-z0-9-]+)"/g;

/** Every Agent call of every `SKILL.md` of the plugin, one per agent a paragraph starts. */
export function skillAgentCalls(): SkillAgentCall[] {
  const skills = join(PLUGIN, "skills");
  return readdirSync(skills).flatMap((skill) => {
    const text = readFileSync(join(skills, skill, "SKILL.md"), "utf8");
    return text.split(/\n\s*\n/).flatMap((paragraph) =>
      [...paragraph.matchAll(AGENT_CALL)].map((match) => ({
        skill,
        agent: match[1] ?? "",
        paragraph,
      })),
    );
  });
}
