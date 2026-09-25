// Keys the kernel knows about without accepting them (design D-3): the keys
// `kernel-settings` declares for tasks that have not landed their consumer,
// and the v2 keys v3 dropped. A contract test keeps both lists equal to the
// spec's tables; an owner task moves its keys out of PLANNED_KEYS when it
// registers its module.

export interface PlannedKey {
  readonly key: string;
  readonly owner: string;
}

export interface RemovedKey {
  readonly key: string;
  readonly reason: string;
}

export const PLANNED_KEYS: readonly PlannedKey[] = [
  { key: "policy.gates.design", owner: "T21" },
  { key: "policy.gates.review", owner: "T21" },
  { key: "policy.budgets.task-redispatch", owner: "T22" },
  { key: "policy.budgets.verify-fix", owner: "T22" },
  { key: "policy.budgets.review-fix", owner: "T22" },
  { key: "policy.budgets.verifier", owner: "T22" },
  { key: "policy.budgets.not-run", owner: "T22" },
  { key: "policy.oscillation.threshold", owner: "T22" },
  { key: "policy.escalation.enabled", owner: "T22" },
  { key: "policy.escalation.model", owner: "T22" },
  { key: "policy.checkpoint.enabled", owner: "T22" },
  { key: "policy.checkpoint.squash-at-close", owner: "T22" },
  { key: "policy.verifier.blocking-categories", owner: "T23" },
  { key: "policy.log.max-observations", owner: "T23" },
  { key: "execution.runner", owner: "T23" },
  { key: "execution.concurrency", owner: "T23" },
  { key: "execution.host", owner: "T23" },
  { key: "archive.keep-evidence", owner: "T23" },
  { key: "rules.propose-when.changes", owner: "T31" },
  { key: "rules.propose-when.authors", owner: "T31" },
  { key: "rules.propose-when.failed-attempts", owner: "T31" },
  { key: "rules.max-per-package", owner: "T31" },
  { key: "rules.max-learnings-per-change", owner: "T31" },
  { key: "rules.disabled", owner: "T31" },
  { key: "spec.normative-word", owner: "T30" },
];

const MCP = "removed with the bundled MCP servers (ADR-0001)";

export const REMOVED_KEYS: readonly RemovedKey[] = [
  { key: "test-tools", reason: "use tools.test" },
  { key: "lint-tools", reason: "use tools.lint" },
  { key: "build-tools", reason: "use tools.build" },
  {
    key: "quality",
    reason: "use prompts.files.rules/<category> or .bdk/prompts/rules/<category>.md",
  },
  { key: "language-rules", reason: "use prompts.files.rules/languages/<language>" },
  { key: "features.caveman", reason: "no consumer in v3 (#39)" },
  { key: "features.serena", reason: MCP },
  { key: "features.code-review-graph", reason: MCP },
  { key: "$schema", reason: "use the yaml-language-server modeline" },
];

/** Whether `key` is `base` or lies below it. */
export function within(key: string, base: string): boolean {
  return key === base || key.startsWith(`${base}.`);
}

/** Why a key the registry does not declare is refused, or undefined for a plain unknown key. */
export function knownReason(key: string): string | undefined {
  const removed = REMOVED_KEYS.find((entry) => within(key, entry.key));
  if (removed !== undefined) return `removed v2 key: ${removed.reason}`;
  const owners = PLANNED_KEYS.filter(
    (entry) => within(key, entry.key) || within(entry.key, key),
  ).map((entry) => entry.owner);
  if (owners.length === 0) return undefined;
  return `lands with ${[...new Set(owners)].sort().join(", ")}`;
}
