// Text renderings of the graph commands (`kernel-cli`, Output modes): `next`
// prints Markdown for the stage skill; the others print plain lines.
import type {
  DoneReport,
  ExplainReport,
  GateView,
  NextOutcome,
  NodeView,
  ValidateReport,
} from "../domain/reports.ts";

export function renderNext(outcome: NextOutcome): string {
  const { report } = outcome;
  if (report.instruction !== undefined) return report.instruction;
  if (outcome.parked !== undefined) {
    const lines = [
      `# ${report.change} is parked`,
      "",
      `${outcome.parked.entry}: ${outcome.parked.summary}`,
      "",
      ...outcome.parked.options.map((option, i) => `${String(i + 1)}. ${option}`),
      "",
      `Ask the user for an option, then run \`bdk change resume ${report.change} --option <n>\`.`,
    ];
    return `${lines.join("\n")}\n`;
  }
  const gate = report.gates.find((candidate) => candidate.ready && !candidate.done);
  if (report.waiting === "gate" && gate !== undefined) return gateText(gate, outcome.gateText);
  return `# ${report.change}: every node is done\n\nNothing waits; the Change is complete.\n`;
}

function gateText(gate: GateView, template: string | undefined): string {
  const lines = [`# Waiting for ${gate.gate}`, ""];
  if (template !== undefined) lines.push(template.trimEnd(), "");
  lines.push(`The user passes the gate by typing \`${gate.command ?? "the next stage command"}\`.`);
  lines.push("", "## Pending review entries", "");
  if (gate.pending.length === 0) lines.push("none");
  for (const entry of gate.pending) lines.push(`- ${entry.id} ${entry.type}: ${entry.summary}`);
  return `${lines.join("\n")}\n`;
}

function nodeLine(node: NodeView): string {
  const requires = node.requires === undefined ? "" : ` <- ${node.requires.join(", ")}`;
  const why = node.why === undefined ? "" : ` (${node.why})`;
  return `${node.id} [${node.kind}] ${node.state}${requires}${why}`;
}

export function renderExplain(report: ExplainReport): string {
  const lines = [`${report.artifact}: ${report.state} (profile ${report.profile})`];
  for (const node of report.chain) {
    lines.push(`  ${nodeLine(node)}`);
    if (node.inputHash !== undefined) lines.push(`    hash ${node.inputHash}`);
  }
  if (report.conditions !== undefined) lines.push(`conditions: ${report.conditions.join(", ")}`);
  return `${lines.join("\n")}\n`;
}

export function renderValidate(report: ValidateReport): string {
  const lines = [`${report.artifact}: ${report.valid ? "valid" : "invalid"}`];
  for (const check of report.checks) {
    lines.push(
      `  ${check.ok ? "ok  " : "FAIL"} ${check.id}${check.why === undefined ? "" : `: ${check.why}`}`,
    );
  }
  if (report.inputHash !== undefined) lines.push(`hash ${report.inputHash}`);
  return `${lines.join("\n")}\n`;
}

export function renderDone(report: DoneReport): string {
  const entry = report.entry === undefined ? "" : ` in ${report.entry}`;
  return `${report.artifact} done${entry} (${report.inputHash})\nnext: ${report.next}\n`;
}
