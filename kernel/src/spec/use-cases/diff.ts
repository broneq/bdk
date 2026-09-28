// `bdk spec diff [<capability>]` (`kernel-cli/spec`): per requirement a delta
// names, in delta order, what the merge does to it. No check applies.
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import type { Delta, LivingSpec } from "../domain/grammar.ts";
import type { DiffItem, DiffReport } from "../domain/reports.ts";
import { notFound } from "./check.ts";
import type { SpecDeps } from "./deps.ts";
import { listDeltas, readCurrent } from "./files.ts";

export function diffSpecs(
  deps: SpecDeps,
  change: ActiveChange,
  capability: string | undefined,
): DiffReport | Refusal {
  const all = listDeltas(deps.store, change.dir);
  const deltas = capability === undefined ? all : all.filter((d) => d.capability === capability);
  if (capability !== undefined && deltas.length === 0) return notFound(change, capability);
  return {
    capabilities: deltas.map((file) => ({
      capability: file.capability,
      requirements: diffDelta(
        readCurrent(deps.store, change.projectRoot, file.capability).living,
        file.delta,
      ),
    })),
  };
}

function diffDelta(current: LivingSpec | undefined, delta: Delta): DiffItem[] {
  const held = new Map((current?.requirements ?? []).map((item) => [item.name, item]));
  const scenarioNames = (name: string): string[] =>
    held.get(name)?.scenarios.map((scenario) => scenario.name) ?? [];
  const order = [...delta.added, ...delta.modified, ...delta.removed]
    .sort((a, b) => a.line - b.line)
    .map((item) => item.name)
    .filter((name, index, names) => names.indexOf(name) === index);
  return order.map((name): DiffItem => {
    const before = scenarioNames(name);
    const modified = delta.modified.find((item) => item.name === name);
    const added = delta.added.find((item) => item.name === name);
    const removal = delta.removed.find((item) => item.name === name);
    const block = modified ?? added;
    if (block !== undefined) {
      const after = block.scenarios.map((scenario) => scenario.name);
      return {
        name,
        change: modified === undefined && removal === undefined ? "added" : "modified",
        scenarios: {
          added: after.filter((item) => !before.includes(item)).length,
          removed: before.filter((item) => !after.includes(item)).length,
        },
      };
    }
    if (removal !== undefined && removal.scenarios.length > 0) {
      const listed = removal.scenarios.map((scenario) => scenario.name);
      return {
        name,
        change: "modified",
        scenarios: { added: 0, removed: before.filter((item) => listed.includes(item)).length },
      };
    }
    return { name, change: "removed", scenarios: { added: 0, removed: before.length } };
  });
}
