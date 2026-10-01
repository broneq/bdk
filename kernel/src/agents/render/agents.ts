// The text mode of the `agents` commands (`kernel-cli/agents`).
import type {
  AgentsListReport,
  AgentsShowReport,
  AgentsWaitReport,
  WaitEvent,
} from "../domain/reports.ts";

const dash = (value: string | null): string => value ?? "-";

export function renderList(report: AgentsListReport): string {
  if (report.agents.length === 0) return "No agents.\n";
  return report.agents
    .map(
      (agent) =>
        `${agent.id}  ${dash(agent.type)}  ${agent.state}  parent ${dash(agent.parent)}  target ${dash(agent.target)}  ticket ${dash(agent.ticket)}\n`,
    )
    .join("");
}

export function renderShow(report: AgentsShowReport): string {
  const lines = [
    `${report.id}  ${dash(report.type)}  ${report.state}`,
    `parent: ${dash(report.parent)}`,
    `package: ${dash(report.package)}`,
    `ticket: ${dash(report.ticket)}  target: ${dash(report.target)}`,
    `started: ${dash(report.startedAt)}  last seen: ${dash(report.lastSeenAt)}`,
    `open call since: ${dash(report.openCallSince)}`,
    `ended: ${report.endedBy === null ? "-" : `${report.endedBy} at ${dash(report.endedAt)}`}`,
    `continuations: ${String(report.continuations)}`,
    report.children.length === 0 ? "children: none" : "children:",
    ...report.children.map(
      (child) => `- ${child.id}  ${dash(child.type)}  ${child.state}  target ${dash(child.target)}`,
    ),
  ];
  return `${lines.join("\n")}\n`;
}

function eventLine(event: WaitEvent): string {
  switch (event.kind) {
    case "message":
      return `- message from ${event.from}: read ledger entry ${event.entry}`;
    case "report":
      return `- report of ${event.agent} for ${event.ticket}: status ${event.status}`;
    case "ended":
      return `- ${event.agent} ended without a report (${event.by})`;
    case "suspect":
      return `- ${event.agent} is suspect: no tool call within agents.ttl`;
    case "timeout":
      return "- timeout: nothing happened";
  }
}

export function renderWait(report: AgentsWaitReport): string {
  const { starting, running, suspect, ended } = report.children;
  return [
    ...report.events.map(eventLine),
    `elapsed ${String(report.elapsed)}s; children: ${String(starting)} starting, ${String(running)} running, ${String(suspect)} suspect, ${String(ended)} ended`,
    "Read each message and report, act on it, then dispatch or wait again.",
    "",
  ].join("\n");
}
