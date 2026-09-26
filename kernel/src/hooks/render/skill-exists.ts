// The content of `skill-exists`: nothing when the skill is installed, one
// `[BDK]` line otherwise (`kernel-cli/hooks`, `bdk hooks skill-exists`).
import type { SkillExistsReport } from "../domain/report.ts";

export function renderSkillExists(name: string, foundIn: string | undefined): SkillExistsReport {
  if (foundIn !== undefined) return { name, installed: true, foundIn, content: "" };
  return {
    name,
    installed: false,
    content: `[BDK] skill ${name} is not installed; the skill that needs it falls back to its own behaviour.`,
  };
}
