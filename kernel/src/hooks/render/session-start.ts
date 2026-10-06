// The session context: the STARTUP text, a blank line and one `[BDK]` line
// per finding, the formatter guard first (`kernel-cli/hooks`, `bdk hooks session-start`).
import type { SessionFindings, SessionStartReport } from "../domain/report.ts";

export function renderSessionStart({ startup, project }: SessionFindings): SessionStartReport {
  if (project === undefined) return { content: startup };
  const lines = [
    // First: a guard that is not in force lets a formatter break recorded hashes.
    ...(project.formatterGuard === undefined
      ? []
      : [
          "[BDK] WARNING: .bdk/.prettierrc is missing or is not the BDK formatter guard, " +
            "so Prettier can rewrite files under .bdk/ and break their recorded hashes. " +
            `Restore it: write ${project.formatterGuard} to .bdk/.prettierrc and commit it.`,
        ]),
    ...project.errors.map(
      ({ why, instead }) => `[BDK] config: ${why} Instead: ${instead.join("; ")}`,
    ),
    ...project.warnings.map((warning) => `[BDK] config warning: ${warning}`),
    ...(project.v2Markers.length === 0
      ? []
      : [`[BDK] v2 layout detected (${project.v2Markers.join(", ")}): run /bdk:setup.`]),
    ...(project.rules === undefined
      ? []
      : [
          `[BDK] rules warning: ${project.rules.role} reads ${String(project.rules.rules)} rules ` +
            `(rules.warn-above: ${String(project.rules.limit)}); ` +
            "switch rules off with rules.disabled or narrow their paths or stages.",
        ]),
  ];
  return {
    content: lines.length === 0 ? startup : `${startup.trimEnd()}\n\n${lines.join("\n")}\n`,
    layout: project.layout,
    configProblems: project.errors.length + project.warnings.length,
  };
}
