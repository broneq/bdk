// The tool groups a Change runs (`kernel-pipeline`, Tool group nodes; T49):
// which groups the nodes of a graph variant need, and the refusal of
// `change new` and `part start` when one of them is unset, so a run never
// reaches the not-run budget for a missing setting.
import type { KindRegistry } from "../domain/kinds/index.ts";
import type { Pipeline } from "../domain/pipeline.ts";
import { moduleValue, toolGroup, toolsModule } from "../../shared/config/index.ts";
import type { Mapping } from "../../shared/config/index.ts";
import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import { TOOL_GROUPS } from "../../shared/vocabulary/index.ts";
import type { ToolGroupName } from "../../shared/vocabulary/index.ts";
import type { ChangeGraph } from "./graph.ts";
import { loadPipeline } from "./pipeline.ts";
import { kindsOf } from "./graph.ts";
import type { GraphDeps } from "./deps.ts";

/** An unset group and the nodes that would run its commands. */
interface Unset {
  readonly group: ToolGroupName;
  readonly nodes: readonly string[];
}

const TIERS: Readonly<Record<ToolGroupName, string>> = { test: "fast", lint: "lint" };

/**
 * The refusal of `change new` for a Change of `kind`: the groups whose nodes
 * the kind's graph variant applies and the settings leave unset; undefined
 * when every such group is configured or declared none.
 */
export function unsetToolsForKind(
  deps: GraphDeps,
  settings: Mapping,
  kind: string,
): Refusal | undefined {
  const kinds = kindsOf(deps);
  const pipeline = loadPipeline(deps.store, deps.pluginRoot, deps.settings, kinds);
  return refusalOf(unsetGroups(settings, nodesOfKind(pipeline, kinds, kind)));
}

/** The refusal of `part start`: the unset groups of the graph's nodes that apply. */
export function unsetToolsOf(read: ChangeGraph): Refusal | undefined {
  const nodes = read.graph.nodes
    .filter((node) => node.state !== "skipped" && node.nn === undefined)
    .flatMap((node) => {
      const group = read.kinds.get(node.kind)?.toolGroup;
      return group === undefined ? [] : [{ id: node.id, group }];
    });
  return refusalOf(unsetGroups(read.resolved.value, nodes));
}

function nodesOfKind(
  pipeline: Pipeline,
  kinds: KindRegistry,
  kind: string,
): { readonly id: string; readonly group: ToolGroupName }[] {
  return pipeline.nodes.flatMap((node) => {
    const group = kinds.get(node.kind)?.toolGroup;
    if (group === undefined) return [];
    if (node.kinds !== undefined && !(node.kinds as readonly string[]).includes(kind)) return [];
    return [{ id: node.id, group }];
  });
}

function unsetGroups(
  settings: Mapping,
  nodes: readonly { readonly id: string; readonly group: ToolGroupName }[],
): Unset[] {
  const tools = moduleValue(toolsModule, settings);
  return TOOL_GROUPS.filter((group) => toolGroup(tools, group).state === "unset").flatMap(
    (group) => {
      const ids = nodes.filter((node) => node.group === group).map((node) => node.id);
      return ids.length === 0 ? [] : [{ group, nodes: ids }];
    },
  );
}

function refusalOf(unset: readonly Unset[]): Refusal | undefined {
  if (unset.length === 0) return undefined;
  const why = unset
    .map(
      ({ group, nodes }) =>
        `tools.${group} is unset: the Change runs ${nodes.join(" and ")}; configure the project's ${group} commands or declare that it has none`,
    )
    .join("; ");
  return refuse("policy/tools-unset", why, [
    ...unset.flatMap(({ group }) => [
      `bdk config set tools.${group}.<id> '{tier: ${TIERS[group]}, command: <command>}'`,
      `bdk config set tools.${group} none`,
    ]),
    "/bdk:setup",
  ]);
}
