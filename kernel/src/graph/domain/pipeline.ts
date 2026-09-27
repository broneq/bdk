// The shipped `pipeline/pipeline.yaml` as data (`kernel-pipeline`, Pipeline
// file; design D-1, D-6): the shape the schema admits and the cross-checks a
// schema cannot express, which need the kind registry and the settings.
import type { ChangeKind, Profile } from "../../shared/vocabulary/index.ts";

/** The loop names a node's `budget` may carry; their values live in `policy.budgets` (T22). */
export const LOOPS = [
  "task-redispatch",
  "verify-fix",
  "review-fix",
  "verifier",
  "not-run",
] as const;

type Loop = (typeof LOOPS)[number];

interface Stage {
  readonly id: string;
  readonly command: string;
}

export interface PipelineNode {
  readonly id: string;
  readonly kind: string;
  readonly stage: string;
  readonly requires?: readonly string[] | undefined;
  readonly profiles?: readonly Profile[] | undefined;
  readonly kinds?: readonly ChangeKind[] | undefined;
  readonly if?: string | undefined;
  readonly budget?: Loop | undefined;
  readonly rules?: readonly string[] | undefined;
  readonly policy?: string | undefined;
  readonly opens?: string | undefined;
}

export interface Pipeline {
  readonly schema: 1;
  readonly stages: readonly Stage[];
  readonly nodes: readonly PipelineNode[];
}

/** What the file may name: registered kinds, declared settings and rule sets. */
export interface Declared {
  readonly kinds: ReadonlySet<string>;
  /** Names of the boolean `features` keys. */
  readonly features: ReadonlySet<string>;
  /** Names of the `policy.gates` keys. */
  readonly gates: ReadonlySet<string>;
  /** Rule categories with a declared `rules/<category>` prompt key. */
  readonly rules: ReadonlySet<string>;
}

/** The kind of every gate node. */
export const GATE_KIND = "gate";

/** Each problem names the node and the key; empty for a valid pipeline. */
export function pipelineProblems(pipeline: Pipeline, declared: Declared): string[] {
  const problems: string[] = [];
  const stages = new Set<string>();
  for (const stage of pipeline.stages) {
    if (stages.has(stage.id)) problems.push(`stages: ${stage.id} appears twice`);
    stages.add(stage.id);
  }
  const ids = new Set<string>();
  pipeline.nodes.forEach((node, n) => {
    const at = `nodes[${n}] (${node.id})`;
    if (ids.has(node.id)) problems.push(`${at}.id: ${node.id} appears twice`);
    ids.add(node.id);
    if (!declared.kinds.has(node.kind)) problems.push(`${at}.kind: ${node.kind} is not a kind`);
    if (!stages.has(node.stage)) problems.push(`${at}.stage: ${node.stage} is not a stage`);
    const feature = node.if?.slice("features.".length);
    if (feature !== undefined && !declared.features.has(feature)) {
      problems.push(`${at}.if: features.${feature} is not a declared features key`);
    }
    for (const rule of node.rules ?? []) {
      if (!declared.rules.has(rule)) problems.push(`${at}.rules: rules/${rule} is not declared`);
    }
    problems.push(...gateProblems(node, at, stages, declared));
  });
  pipeline.nodes.forEach((node, n) => {
    for (const required of node.requires ?? []) {
      if (!ids.has(required)) {
        problems.push(`nodes[${n}] (${node.id}).requires: ${required} is not a node`);
      }
    }
  });
  const cycle = cycleOf(pipeline.nodes, ids);
  if (cycle !== undefined) problems.push(`requires: ${cycle.join(" -> ")} form a cycle`);
  return problems;
}

function gateProblems(
  node: PipelineNode,
  at: string,
  stages: ReadonlySet<string>,
  declared: Declared,
): string[] {
  if (node.kind !== GATE_KIND) {
    return node.policy === undefined && node.opens === undefined
      ? []
      : [`${at}: policy and opens belong to gate nodes only`];
  }
  const problems: string[] = [];
  if (node.policy === undefined) problems.push(`${at}.policy: a gate needs policy`);
  else if (!declared.gates.has(node.policy)) {
    problems.push(`${at}.policy: policy.gates.${node.policy} is not declared`);
  }
  if (node.opens === undefined) problems.push(`${at}.opens: a gate needs opens`);
  else if (!stages.has(node.opens)) problems.push(`${at}.opens: ${node.opens} is not a stage`);
  return problems;
}

/** The first `requires` cycle found, as node ids, or undefined. */
function cycleOf(nodes: readonly PipelineNode[], ids: ReadonlySet<string>): string[] | undefined {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const finished = new Set<string>();
  const path: string[] = [];
  const visit = (id: string): string[] | undefined => {
    if (finished.has(id) || !ids.has(id)) return undefined;
    const start = path.indexOf(id);
    if (start >= 0) return [...path.slice(start), id];
    path.push(id);
    for (const required of byId.get(id)?.requires ?? []) {
      const found = visit(required);
      if (found !== undefined) return found;
    }
    path.pop();
    finished.add(id);
    return undefined;
  };
  for (const node of nodes) {
    const found = visit(node.id);
    if (found !== undefined) return found;
  }
  return undefined;
}

/**
 * The stage of a transition's `to` (design D-12): a stage id is itself, a node
 * id its node's stage, an instance id `<kind>:<nn>` the stage of the node of
 * that kind; anything else is answered unchanged.
 */
export function stageOfTarget(pipeline: Pipeline, to: string): string {
  if (pipeline.stages.some((stage) => stage.id === to)) return to;
  const node = pipeline.nodes.find((candidate) => candidate.id === to);
  if (node !== undefined) return node.stage;
  const kind = to.split(":")[0] ?? "";
  return pipeline.nodes.find((candidate) => candidate.kind === kind)?.stage ?? to;
}

/** The command of a stage, the one the user types to enter it. */
export function stageCommand(pipeline: Pipeline, stage: string): string | undefined {
  return pipeline.stages.find((candidate) => candidate.id === stage)?.command;
}
