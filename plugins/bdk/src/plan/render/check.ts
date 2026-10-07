// The text of `bdk plan check` (spec `bdk-cli/plan`, "Check output"; design D7), written for a
// model reading a Bash result: the summary first, then waves, parts and problems.

import type { CheckResult } from "../schema/check.ts";

const plural = (count: number, noun: string): string =>
  `${String(count)} ${noun}${count === 1 ? "" : "s"}`;

export function renderCheck(result: CheckResult): string {
  const { limits, parts, waves, problems } = result;
  const verdict = problems.length === 0 ? "ok" : plural(problems.length, "problem");
  const lines = [
    `plan: ${plural(parts.length, "part")}, ${plural(waves.length, "wave")}, ${verdict}`,
  ];

  if (waves.length === 0) lines.push("waves: none");
  else {
    lines.push("waves:");
    for (const wave of waves) lines.push(`  ${String(wave.wave)}: ${wave.parts.join(" ")}`);
  }

  if (parts.length > 0) {
    const rows = parts.map((part) => [
      part.id,
      part.isolation ?? "-",
      `tasks ${String(part.tasks)}/${String(limits.maxTasks)}`,
      `files ${String(part.files)}/${String(limits.maxFiles)}`,
      `bytes ${String(part.bytes)}/${String(limits.maxBytes)}`,
      `wave ${part.wave === null ? "-" : String(part.wave)}`,
      `depends-on ${part.dependsOn.length === 0 ? "-" : part.dependsOn.join(",")}`,
    ]);
    const widths = rows[0]?.map((_, column) =>
      Math.max(...rows.map((row) => row[column]?.length ?? 0)),
    );
    lines.push("parts:");
    for (const row of rows) {
      const cells = row.map((cell, column) =>
        column === row.length - 1 ? cell : cell.padEnd(widths?.[column] ?? 0),
      );
      lines.push(`  ${cells.join("  ")}`);
    }
  } else lines.push("parts: none");

  if (problems.length > 0) {
    lines.push("problems:");
    for (const problem of problems) {
      const ids = problem.parts.length === 0 ? "" : ` ${problem.parts.join(",")}`;
      lines.push(`  ${problem.check}${ids}: ${problem.message}`);
    }
  }
  return `${lines.join("\n")}\n`;
}
