// The Markdown fallback of `bdk review render --format md` (`kernel-cli/review`;
// T42-H): the sections of the HTML report in the same order, without the form.
import type { PrPage } from "../domain/pr.ts";
import { NOT_USED_GATE } from "../domain/report.ts";
import type { ChangeReport, DecisionEntry, Lines } from "../domain/report.ts";
import type { ToolGroupName } from "../../shared/vocabulary/index.ts";
import { markdown } from "./escape.ts";
import { shortRange } from "./report-html.ts";

export function changeReportMd(report: ChangeReport): string {
  const blocks = [
    `# ${markdown(report.change)}`,
    markdown(report.intent),
    [
      `- Kind: ${markdown(report.kind)}`,
      `- Range: \`${shortRange(report.range)}\``,
      `- Files: ${String(report.totals.files)}, lines ${lines(report.totals)}`,
      `- Open entries by level: ${counted(report.levels)}`,
      `- By disposition: ${counted(report.dispositions)}`,
    ].join("\n"),
    "## Parts and areas",
    grid(report),
    "## Change map",
    ...(report.cards.length === 0
      ? ["No configured risk area is touched."]
      : report.cards.flatMap((card) => [
          `### ${card.id === "unplanned" ? "Outside the plan" : markdown(card.id)}`,
          ...(card.summary === undefined ? [] : [markdown(card.summary)]),
          card.files.length === 0
            ? "No changed file matches its paths."
            : card.files
                .map((file) =>
                  [
                    `- \`${file.path}\` ${lines(file)}${file.tags
                      .map(
                        (tag) =>
                          ` [${[tag.id, tag.level ?? "untriaged", tag.disposition].filter(Boolean).join(" · ")}]`,
                      )
                      .join("")}`,
                    ...file.tasks.map((task) => `  - Task ${task.id} ${markdown(task.title)}`),
                    ...file.commits.map(
                      (commit) => `  - ${commit.sha.slice(0, 7)} ${markdown(commit.subject)}`,
                    ),
                  ].join("\n"),
                )
                .join("\n"),
        ])),
    "## Gate",
    [
      gateLine(report, "test", report.gate.tests),
      gateLine(report, "lint", report.gate.lint),
      ...report.gate.coverage.map(
        (item) =>
          `- Coverage ${markdown(item.tool)}: ${item.percent === null ? "n/a" : `${String(item.percent)}%`}${
            item.min === null ? "" : ` (min ${String(item.min)}%)`
          } ${item.verdict ?? "not recorded"}`,
      ),
    ].join("\n"),
    "## Decisions",
    ...report.decisions.flatMap((group) => [
      `### ${group.group} (${String(group.entries.length)})`,
      group.entries.length === 0 ? "None." : group.entries.map(decision).join("\n\n"),
    ]),
    "## Settled",
    report.settled.length === 0
      ? "None."
      : report.settled
          .map(
            (entry) =>
              `- ${entry.id} ${markdown(entry.summary)}${entry.reason === undefined ? "" : ` (${markdown(entry.reason)})`}`,
          )
          .join("\n"),
    "## Context",
    report.context.length === 0
      ? "None."
      : report.context
          .map((entry) => `- ${entry.id} ${entry.type}: ${markdown(entry.summary)}`)
          .join("\n"),
  ];
  return `${blocks.join("\n\n")}\n`;
}

export function prPageMd(page: PrPage): string {
  const blocks = ["# Pull request review"];
  for (const pr of page.prs) {
    blocks.push(
      `## #${String(pr.number)} ${markdown(pr.title)}`,
      `${pr.url}\n\nVerdict: ${pr.verdict}`,
    );
    for (const finding of pr.findings) {
      blocks.push(
        [
          `- **${finding.id}** \`${finding.path}:${String(finding.line)}\` ${finding.severity} · ${markdown(finding.category)} · ${finding.choice}`,
          `  - Problem: ${markdown(finding.problem)}`,
          ...(finding.why === undefined ? [] : [`  - Why it matters: ${markdown(finding.why)}`]),
          `  - Suggested fix: ${markdown(finding.fix)}`,
        ].join("\n"),
      );
    }
  }
  return `${blocks.join("\n\n")}\n`;
}

function decision(entry: DecisionEntry): string {
  const meta = [
    entry.type,
    entry.severity,
    entry.category,
    `by ${entry.writer}`,
    entry.disposition === undefined ? "undecided" : `decided ${entry.disposition}`,
    entry.review ? "to be reviewed" : undefined,
    entry.issue === undefined ? undefined : `issue ${entry.issue}`,
  ].filter((part): part is string => part !== undefined);
  const details =
    entry.body.kind === "labelled"
      ? [
          `  - Problem: ${markdown(entry.body.problem)}`,
          `  - Why it matters: ${markdown(entry.body.why)}`,
          `  - Suggested fix: ${markdown(entry.body.fix)}`,
        ]
      : entry.body.text === ""
        ? []
        : [`  - ${markdown(entry.body.text)}`];
  return [
    `- **${entry.id}** ${markdown(entry.summary)}`,
    `  - ${markdown(meta.join(" · "))}`,
    `  - Refs: ${entry.refs.map((ref) => `\`${ref}\``).join(" ")}`,
    ...details,
  ].join("\n");
}

function grid(report: ChangeReport): string {
  if (report.grid.modules.length === 0) return "The range changes no file.";
  const head = `| | ${report.grid.modules.map((module) => `\`${module}\``).join(" | ")} |`;
  const rule = `|---|${report.grid.modules.map(() => "---").join("|")}|`;
  const rows = report.grid.rows.map(
    (row) =>
      `| ${markdown(row.label)} | ${row.cells
        .map((cell) => (cell === undefined ? "" : `${lines(cell)} (${String(cell.files.length)})`))
        .join(" | ")} |`,
  );
  return [head, rule, ...rows].join("\n");
}

function counted(values: Readonly<Record<string, number>>): string {
  const parts = Object.entries(values)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => `${key} ${String(count)}`);
  return parts.length === 0 ? "none" : parts.join(", ");
}

function lines(value: Lines): string {
  return `+${String(value.added)} -${String(value.removed)}`;
}

/** A tool group's Gate line: its verdict, or not used when declared none (T49). */
function gateLine(report: ChangeReport, group: ToolGroupName, verdict: string | undefined): string {
  const { label, text } = NOT_USED_GATE[group];
  if (report.gate.notUsed.includes(group)) return `- ${label}: ${text}`;
  return `- ${label}: ${verdict ?? "not recorded"}`;
}
