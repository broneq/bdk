// The text of `bdk diagnostics report`, written for the analyst reading a Bash result: exact
// numbers, one line per stage, agent, model and finding, every line with its citation.

import type { ReportResult } from "../schema/report.ts";

type Session = ReportResult["sessions"][number];
type Tokens = Session["stages"][number]["tokens"];

export function duration(ms: number | null): string {
  if (ms === null) return "?";
  const seconds = Math.round(ms / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number): string => String(n).padStart(2, "0");
  return h > 0
    ? `${String(h)}h${pad(m)}m${pad(s)}s`
    : m > 0
      ? `${String(m)}m${pad(s)}s`
      : `${String(s)}s`;
}

function usd(value: number | null): string {
  return value === null ? "$?" : `$${value.toFixed(2)}`;
}

function clock(at: string | null): string {
  return at === null ? "?" : at.replace(/^\d{4}-\d{2}-\d{2}T/, "").replace(/\.\d+Z$|Z$/, "");
}

function tokens(t: Tokens): string {
  return `in ${String(t.input)} out ${String(t.output)} cache-read ${String(t.cacheRead)} cache-write ${String(t.cacheWrite5m + t.cacheWrite1h)}`;
}

function sum(models: readonly Tokens[]): Tokens {
  return models.reduce<Tokens>(
    (acc, t) => ({
      input: acc.input + t.input,
      output: acc.output + t.output,
      cacheRead: acc.cacheRead + t.cacheRead,
      cacheWrite5m: acc.cacheWrite5m + t.cacheWrite5m,
      cacheWrite1h: acc.cacheWrite1h + t.cacheWrite1h,
    }),
    { input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 },
  );
}

function session(s: Session): string[] {
  const cost =
    s.cost === null ? "cost unknown (no cost-state)" : `cost ${usd(s.cost.totalUSD)} (host)`;
  const lines = [
    `session ${s.id}  ${s.start ?? "?"} - ${clock(s.end)}  wall ${duration(s.wallMs)}  ${cost}  ${s.file}`,
    "models:",
  ];
  for (const model of s.models)
    lines.push(
      `  ${model.model}  turns ${String(model.turns)}  ${tokens(model)}  ${usd(model.costUSD)}`,
    );
  lines.push(`stages:${s.stages.length === 0 ? " none (no Skill call in the main thread)" : ""}`);
  for (const stage of s.stages) {
    lines.push(
      `  ${String(stage.n)} ${stage.skill}  ${clock(stage.start)}  wall ${duration(stage.wallMs)}  agents ${String(stage.agents.length)}  ${tokens(stage.tokens)}  ${usd(stage.costUSD)}  ${stage.cite}`,
    );
  }
  lines.push("agents:");
  for (const agent of s.agents) {
    const label = agent.description === null ? agent.type : `${agent.type} "${agent.description}"`;
    const where =
      agent.state === "missing"
        ? `MISSING, started at ${agent.startedBy ?? "?"}`
        : (agent.file ?? "?");
    lines.push(
      `  ${agent.id}  ${label}  stage ${agent.stage === null ? "-" : String(agent.stage)}  parent ${agent.parent ?? "-"}  ${clock(agent.start)}  wall ${duration(agent.wallMs)}  turns ${String(agent.turns)}  tools ${String(agent.toolCalls)}  errors ${String(agent.errors)}  ${tokens(sum(agent.models))}  ${usd(agent.costUSD)}  ${where}`,
    );
  }
  lines.push(`findings:${s.findings.length === 0 ? " none" : ""}`);
  for (const finding of s.findings) {
    lines.push(
      `  ${finding.detector}  ${finding.agent} (${finding.agentType})  x${String(finding.count)}  ${finding.summary}  ${finding.cites.join(" ")}`,
    );
  }
  return lines;
}

export function renderReport(result: ReportResult): string {
  const lines = [
    `transcripts: ${result.transcripts}`,
    `change: ${result.change ?? "-"}  sessions: ${String(result.sessions.length)}`,
    "cost: the session's is the host's (cost-state); an agent's or stage's is its share by weighted tokens",
  ];
  for (const s of result.sessions) lines.push("", ...session(s));
  if (result.warnings.length > 0) {
    lines.push("", "warnings:");
    for (const warning of result.warnings) lines.push(`  ${warning}`);
  }
  return `${lines.join("\n")}\n`;
}
