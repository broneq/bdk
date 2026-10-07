import type { Finding } from "./index.ts";

export interface Outcome {
  version: string;
  findings: Finding[];
  files: number;
  suppressed: number;
  stale: number;
}

export function formatHuman(outcome: Outcome, github: boolean): string {
  const { errors, warnings } = count(outcome.findings);
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const files = plural(outcome.files, "file");
  if (outcome.findings.length === 0) {
    const suppressed = outcome.suppressed
      ? ` (${plural(outcome.suppressed, "baselined finding")})`
      : "";
    return `No findings in ${files}${suppressed}.\n`;
  }
  const lines = outcome.findings.map(
    (f) => `${f.file}:${f.line}  ${f.severity}  ${f.rule}  ${f.message}`,
  );
  if (github) {
    for (const f of outcome.findings) {
      lines.push(
        `::${f.severity} file=${f.file},line=${f.line},title=${f.rule}::${escape(f.message)}`,
      );
    }
  }
  const suppressed = outcome.suppressed
    ? `, ${plural(outcome.suppressed, "baselined finding")} suppressed`
    : "";
  return `${lines.join("\n")}\n\n${plural(errors, "error")}, ${plural(warnings, "warning")} in ${files}${suppressed}.\n`;
}

export function formatJson(outcome: Outcome): string {
  const { errors, warnings } = count(outcome.findings);
  return `${JSON.stringify(
    {
      version: outcome.version,
      findings: outcome.findings,
      baseline: { suppressed: outcome.suppressed, stale: outcome.stale },
      summary: { files: outcome.files, errors, warnings },
    },
    null,
    2,
  )}\n`;
}

export function exitCode(findings: Finding[], strict: boolean): 0 | 1 {
  const { errors, warnings } = count(findings);
  return errors > 0 || (strict && warnings > 0) ? 1 : 0;
}

function count(findings: Finding[]) {
  const errors = findings.filter((f) => f.severity === "error").length;
  return { errors, warnings: findings.length - errors };
}

/** Workflow-command data escaping (GitHub Actions toolkit). */
function escape(text: string): string {
  return text.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}
