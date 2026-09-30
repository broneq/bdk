// Keys the kernel knows about without accepting them (design D-3): the keys
// `kernel-settings` declares for tasks that have not landed their consumer,
// and the v2 keys v3 dropped. A contract test keeps both lists equal to the
// spec's tables; an owner task moves its keys out of PLANNED_KEYS when it
// registers its module.

import { isRecord } from "./values.ts";
import type { Mapping } from "./values.ts";

export interface PlannedKey {
  readonly key: string;
  readonly owner: string;
}

export interface RemovedKey {
  readonly key: string;
  readonly reason: string;
}

export const PLANNED_KEYS: readonly PlannedKey[] = [];

const MCP = "removed with the bundled MCP servers (ADR-0001)";

export const REMOVED_KEYS: readonly RemovedKey[] = [
  { key: "test-tools", reason: "use tools.test" },
  { key: "lint-tools", reason: "use tools.lint" },
  { key: "build-tools", reason: "use tools.build" },
  {
    key: "quality",
    reason:
      "use project rules in .bdk/rules/ (bdk rules import) and switch BDK rules off with rules.disabled",
  },
  {
    key: "language-rules",
    reason: "use the language packs selected by languages, and project rules with applies",
  },
  { key: "features.caveman", reason: "no consumer in v3 (#39)" },
  { key: "features.serena", reason: MCP },
  { key: "features.code-review-graph", reason: MCP },
  { key: "$schema", reason: "use the yaml-language-server modeline" },
];

/**
 * Prompt keys that are no longer prompt values: rules became files with ids
 * (T31), so a prompts file or `prompts.files` entry for one is refused with
 * where rules live now.
 */
const RETIRED_PROMPTS: readonly RemovedKey[] = [
  {
    key: "rules/",
    reason:
      "rules are no longer prompt values: add project rules as files in .bdk/rules/ (bdk rules accept, bdk rules import) and switch BDK rules off with rules.disabled",
  },
];

/** Why an unregistered prompt key is refused beyond "unknown", or undefined. */
export function retiredPromptReason(promptKey: string): string | undefined {
  return RETIRED_PROMPTS.find((entry) => promptKey.startsWith(entry.key))?.reason;
}

/** The layer with every removed v2 key taken out of its values. */
export function withoutRemovedKeys<L extends { readonly values: Readonly<Mapping> }>(layer: L): L {
  let values: Readonly<Mapping> = layer.values;
  for (const { key } of REMOVED_KEYS) values = without(values, key.split("."));
  return values === layer.values ? layer : { ...layer, values };
}

function without(values: Readonly<Mapping>, steps: readonly string[]): Readonly<Mapping> {
  const [first, ...rest] = steps;
  if (first === undefined || !(first in values)) return values;
  if (rest.length === 0) {
    return Object.fromEntries(Object.entries(values).filter(([key]) => key !== first));
  }
  const child = values[first];
  if (!isRecord(child)) return values;
  const next = without(child, rest);
  return next === child ? values : { ...values, [first]: next };
}

/** Whether `key` is `base` or lies below it. */
export function within(key: string, base: string): boolean {
  return key === base || key.startsWith(`${base}.`);
}

/** Why a key the registry does not declare is refused, or undefined for a plain unknown key. */
export function knownReason(
  key: string,
  planned: readonly PlannedKey[] = PLANNED_KEYS,
): string | undefined {
  const files = "prompts.files.";
  if (key.startsWith(files)) {
    const retired = retiredPromptReason(key.slice(files.length));
    if (retired !== undefined) return retired;
  }
  const removed = REMOVED_KEYS.find((entry) => within(key, entry.key));
  if (removed !== undefined) return `removed v2 key: ${removed.reason}`;
  const owners = planned
    .filter((entry) => within(key, entry.key) || within(entry.key, key))
    .map((entry) => entry.owner);
  if (owners.length === 0) return undefined;
  return `lands with ${[...new Set(owners)].sort().join(", ")}`;
}
