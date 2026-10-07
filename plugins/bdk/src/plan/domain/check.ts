// The plan checks of `bdk plan check` (spec `bdk-cli/plan`, "Part limits", "Dependencies and
// waves", "Overlap and shared parts within a wave"; design D6): pure rules over the parts read
// from one directory. Waves are longest-path layers of `depends-on`; the CLI reports a `shared`
// part with company and never moves it, because which part goes first is a plan decision.

import type { Isolation, Part } from "./part.ts";

/** Every check, in the order problems are listed. */
export const CHECKS = [
  "no-parts",
  "name",
  "frontmatter",
  "no-tasks",
  "max-tasks",
  "max-files",
  "max-bytes",
  "unknown-dependency",
  "cycle",
  "overlap",
  "shared-not-alone",
] as const;
export type Check = (typeof CHECKS)[number];

export interface Problem {
  readonly check: Check;
  /** The part ids the problem concerns, ascending; empty for a stray file or no parts. */
  readonly parts: readonly string[];
  readonly message: string;
}

export interface Limits {
  readonly maxTasks: number;
  readonly maxFiles: number;
  readonly maxBytes: number;
}

export interface PartSummary {
  readonly id: string;
  readonly isolation: Isolation | null;
  readonly dependsOn: readonly string[];
  readonly tasks: number;
  readonly files: number;
  readonly bytes: number;
  readonly wave: number | null;
}

export interface Wave {
  readonly wave: number;
  readonly parts: readonly string[];
}

export interface Checked {
  readonly parts: readonly PartSummary[];
  readonly waves: readonly Wave[];
  readonly problems: readonly Problem[];
}

const byId = <T extends { readonly id: string }>(a: T, b: T): number =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

/** Parts of a cycle, one set per cycle: Tarjan's strongly connected components, in id order. */
function cycles(parts: readonly Part[], known: ReadonlySet<string>): string[][] {
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const edges = new Map(
    parts.map((part) => [part.id, part.dependsOn.filter((id) => known.has(id)).sort()]),
  );
  const found: string[][] = [];
  const visit = (id: string): void => {
    index.set(id, index.size);
    low.set(id, index.get(id) ?? 0);
    stack.push(id);
    onStack.add(id);
    for (const next of edges.get(id) ?? []) {
      if (!index.has(next)) {
        visit(next);
        low.set(id, Math.min(low.get(id) ?? 0, low.get(next) ?? 0));
      } else if (onStack.has(next)) {
        low.set(id, Math.min(low.get(id) ?? 0, index.get(next) ?? 0));
      }
    }
    if (low.get(id) !== index.get(id)) return;
    const component: string[] = [];
    for (let member = stack.pop(); member !== undefined; member = stack.pop()) {
      onStack.delete(member);
      component.push(member);
      if (member === id) break;
    }
    if (component.length > 1 || (edges.get(id) ?? []).includes(id)) found.push(component.sort());
  };
  for (const part of parts) if (!index.has(part.id)) visit(part.id);
  return found;
}

const list = (ids: readonly string[]): string =>
  ids.length <= 1 ? (ids[0] ?? "") : `${ids.slice(0, -1).join(", ")} and ${String(ids.at(-1))}`;

/** Checks the parts of one plan (any order) and the stray `.md` file names next to them. */
export function checkPlan(
  given: readonly Part[],
  strays: readonly string[],
  limits: Limits,
): Checked {
  const parts = [...given].sort(byId);
  const problems: Problem[] = [];
  const add = (check: Check, ids: readonly string[], message: string): void => {
    problems.push({ check, parts: [...ids].sort(), message });
  };

  if (parts.length === 0) add("no-parts", [], "the directory holds no part file NN.md");
  for (const name of strays) add("name", [], `${name} is not a part file; a part is NN.md`);

  const sizes = [
    ["max-tasks", "tasks", limits.maxTasks],
    ["max-files", "files", limits.maxFiles],
    ["max-bytes", "bytes", limits.maxBytes],
  ] as const;
  for (const part of parts) {
    for (const fault of part.faults) add("frontmatter", [part.id], fault);
    if (part.tasks === 0) add("no-tasks", [part.id], "has no numbered task under ## Tasks");
    const measured = { tasks: part.tasks, files: part.files.length, bytes: part.bytes };
    for (const [check, unit, limit] of sizes) {
      if (measured[unit] > limit) {
        add(
          check,
          [part.id],
          `${String(measured[unit])} ${unit}, above plan.part.${check} ${String(limit)}`,
        );
      }
    }
  }

  const known = new Set(parts.map((part) => part.id));
  const blocked = new Set<string>();
  for (const part of parts) {
    if (part.faults.length > 0) blocked.add(part.id);
    for (const dep of part.dependsOn) {
      if (known.has(dep)) continue;
      add("unknown-dependency", [part.id], `depends-on names ${dep}, which is no part`);
      blocked.add(part.id);
    }
  }
  for (const cycle of cycles(parts, known)) {
    for (const id of cycle) blocked.add(id);
    add(
      "cycle",
      cycle,
      cycle.length === 1
        ? `part ${String(cycle[0])} depends on itself`
        : `parts ${list(cycle)} depend on each other in a cycle`,
    );
  }

  const partOf = new Map(parts.map((part) => [part.id, part]));
  const waveOf = new Map<string, number | null>();
  const wave = (id: string): number | null => {
    const done = waveOf.get(id);
    if (done !== undefined) return done;
    let result: number | null = null;
    if (!blocked.has(id)) {
      result = 1;
      for (const dep of partOf.get(id)?.dependsOn ?? []) {
        const before = wave(dep);
        if (before === null) {
          result = null;
          break;
        }
        result = Math.max(result, before + 1);
      }
    }
    waveOf.set(id, result);
    return result;
  };
  const waves: Wave[] = [];
  for (const part of parts) {
    const at = wave(part.id);
    if (at === null) continue;
    const slot = at - 1;
    waves[slot] = { wave: at, parts: [...(waves[slot]?.parts ?? []), part.id] };
  }

  for (const { wave: at, parts: ids } of waves) {
    const listers = new Map<string, string[]>();
    for (const id of ids) {
      for (const path of partOf.get(id)?.files ?? []) {
        listers.set(path, [...(listers.get(path) ?? []), id]);
      }
    }
    for (const [path, by] of [...listers].sort(([a], [b]) => (a < b ? -1 : 1))) {
      if (by.length > 1)
        add("overlap", by, `${path} is listed by ${list(by)} in wave ${String(at)}`);
    }
    if (ids.length < 2) continue;
    for (const id of ids) {
      if (partOf.get(id)?.isolation !== "shared") continue;
      const others = ids.filter((other) => other !== id);
      add(
        "shared-not-alone",
        [id],
        `shared part ${id} runs in wave ${String(at)} with ${list(others)}`,
      );
    }
  }

  const order = (problem: Problem): number => CHECKS.indexOf(problem.check);
  problems.sort(
    (a, b) =>
      order(a) - order(b) ||
      (a.parts[0] ?? "").localeCompare(b.parts[0] ?? "") ||
      (a.message < b.message ? -1 : a.message > b.message ? 1 : 0),
  );

  return {
    parts: parts.map((part) => ({
      id: part.id,
      isolation: part.isolation,
      dependsOn: part.dependsOn,
      tasks: part.tasks,
      files: part.files.length,
      bytes: part.bytes,
      wave: waveOf.get(part.id) ?? null,
    })),
    waves,
    problems,
  };
}
