// The deterministic merge of one delta into one living spec (`kernel-cli/spec`,
// bdk spec merge; T30-D5): REMOVED first, whole or listed scenarios only, then
// MODIFIED in place, then ADDED appended in delta order (in place when the
// name is held: the same Change merging an edited delta), then the purpose.
// Pure, so a second run over its own output yields the same content.
import type { Delta, Requirement } from "./grammar.ts";
import type { SpecContent } from "./render.ts";

export interface MergeResult extends SpecContent {
  readonly counts: { readonly added: number; readonly modified: number; readonly removed: number };
}

export function mergeDelta(current: SpecContent | undefined, delta: Delta): MergeResult {
  let requirements: Requirement[] = [...(current?.requirements ?? [])];
  let scenarioOnly = 0;
  for (const removal of delta.removed) {
    if (removal.scenarios.length === 0) {
      requirements = requirements.filter((item) => item.name !== removal.name);
      continue;
    }
    const listed = new Set(removal.scenarios.map((scenario) => scenario.name));
    requirements = requirements.map((item) =>
      item.name === removal.name
        ? { ...item, scenarios: item.scenarios.filter((scenario) => !listed.has(scenario.name)) }
        : item,
    );
    if (!delta.modified.some((item) => item.name === removal.name)) scenarioOnly++;
  }
  const place = (requirement: Requirement): void => {
    const at = requirements.findIndex((item) => item.name === requirement.name);
    if (at === -1) requirements.push(requirement);
    else requirements[at] = requirement;
  };
  delta.modified.forEach(place);
  delta.added.forEach(place);
  return {
    purpose: delta.purpose?.text ?? current?.purpose ?? "",
    requirements,
    counts: {
      added: delta.added.length,
      modified: delta.modified.length + scenarioOnly,
      removed: delta.removed.length - scenarioOnly,
    },
  };
}
