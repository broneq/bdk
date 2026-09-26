// The session context: the STARTUP text, a blank line and one `[BDK]` line
// per finding (`kernel-cli/hooks`, `bdk hooks session-start`).
import type { SessionFindings, SessionStartReport } from "../domain/report.ts";

export function renderSessionStart({ startup, project }: SessionFindings): SessionStartReport {
  if (project === undefined) return { content: startup };
  const lines = [
    ...project.errors.map(
      ({ why, instead }) => `[BDK] config: ${why} Instead: ${instead.join("; ")}`,
    ),
    ...project.warnings.map((warning) => `[BDK] config warning: ${warning}`),
    ...(project.v2Markers.length === 0
      ? []
      : [`[BDK] v2 layout detected (${project.v2Markers.join(", ")}): run bdk import.`]),
  ];
  return {
    content: lines.length === 0 ? startup : `${startup.trimEnd()}\n\n${lines.join("\n")}\n`,
    layout: project.layout,
    configProblems: project.errors.length + project.warnings.length,
  };
}
