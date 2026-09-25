import type { DoctorOutput } from "../schema/doctor.ts";
import { renderVersion } from "./version.ts";

export function renderDoctor(output: DoctorOutput): string {
  const lines = [renderVersion(output.version).trimEnd(), `layout: ${output.layout ?? "unknown"}`];
  if (output.findings.length === 0) lines.push("no findings");
  for (const finding of output.findings) {
    lines.push(`${finding.level} ${finding.id}: ${finding.summary}`, `  repair: ${finding.repair}`);
  }
  return `${lines.join("\n")}\n`;
}
