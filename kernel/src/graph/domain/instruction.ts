// The instruction `next` hands to a stage skill (`kernel-pipeline`,
// Instruction; design D-9): a fixed skeleton, the kind's template with its
// literal placeholders, the rules of the node's stage and a capped ledger
// summary.
// Pure, so the same inputs give the same bytes.
import type { GraphNode } from "./engine.ts";
import type { GraphEntry, Kind, PartLimits } from "./kinds/index.ts";

const LEDGER_CAP = 20;

export interface InstructionParts {
  readonly node: GraphNode;
  readonly kind: Kind;
  readonly change: string;
  readonly profile: string;
  readonly partLimits: PartLimits;
  readonly template: string;
  /** Paths relative to the project root. */
  readonly paths: readonly string[];
  /** The `- [<id>] <text>` lines of the node's stage; empty omits the section. */
  readonly rules: string;
  /** Newest first, uncapped. */
  readonly ledger: readonly GraphEntry[];
}

export function composeInstruction(parts: InstructionParts): string {
  const { node } = parts;
  const template = fillTemplate(parts.template, {
    change: parts.change,
    node: node.id,
    profile: parts.profile,
    paths: parts.paths,
    partLimits: parts.partLimits,
  });
  const shown = parts.ledger.slice(0, LEDGER_CAP);
  const omitted = parts.ledger.length - shown.length;
  const sections = [
    `# ${node.id} (${node.kind})`,
    template.trimEnd(),
    "## Write to",
    parts.paths.length === 0
      ? "- no file of the Change: the kernel records the result"
      : parts.paths.map((path) => `- ${path}`).join("\n"),
    ...(parts.rules === "" ? [] : ["## Rules", parts.rules.trimEnd()]),
    "## Ledger",
    shown.length === 0
      ? "none"
      : [
          ...shown.map((entry) => `- ${entry.id} ${entry.type}: ${entry.summary}`),
          ...(omitted > 0 ? [`- ${omitted} more: bdk log list`] : []),
        ].join("\n"),
    "## When finished",
    finish(node, parts.kind),
  ];
  return `${sections.join("\n\n")}\n`;
}

/** The placeholders, replaced literally; no template language (design D-9). */
export function fillTemplate(
  template: string,
  values: {
    readonly change: string;
    readonly node: string;
    readonly profile: string;
    readonly paths: readonly string[];
    readonly partLimits: PartLimits;
  },
): string {
  return template
    .replaceAll("{change}", values.change)
    .replaceAll("{node}", values.node)
    .replaceAll("{profile}", values.profile)
    .replaceAll("{paths}", values.paths.join(", "))
    .replaceAll("{max-tasks}", String(values.partLimits.maxTasks))
    .replaceAll("{max-files}", String(values.partLimits.maxFiles));
}

/** The command that completes the node, as the "When finished" line. */
function finish(node: GraphNode, kind: Kind): string {
  const { doneBy } = kind;
  if (doneBy.through === "command") {
    const command = doneBy.command.replaceAll("{nn}", node.nn ?? "<nn>");
    return command.startsWith("bdk ")
      ? `Run \`${command}\`.`
      : `Completed by ${command}; do not run bdk done.`;
  }
  if (node.instances !== undefined) {
    return `Run \`bdk done ${node.id}\` to mark every part, or \`bdk done ${kind.name}:<nn>\` for one part.`;
  }
  return `Run \`bdk done ${node.id}\`.`;
}
