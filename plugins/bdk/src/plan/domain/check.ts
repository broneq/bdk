// The plan checks of `bdk plan check` (`docs/concepts/stages.md`; design D6): pure rules over the
// parts read from one directory. Waves are longest-path layers of `depends-on`; the parts run one
// at a time in wave order, so a file several parts of one wave list is no problem.

import { PRESENT_MARKER } from "./part.ts";
import type { Part } from "./part.ts";

/** The ending of the `Verified by:` line of a present scenario (spec `bdk-plan-blocks`). */
export const PRESENT_ENDING = "; it passes at its first run, the behaviour is present";

/** Every check, in the order problems are listed. */
export const CHECKS = [
  "no-parts",
  "name",
  "frontmatter",
  "no-tasks",
  "max-tasks",
  "max-files",
  "max-bytes",
  "present-scenario",
  "unknown-dependency",
  "cycle",
] as const;
export type Check = (typeof CHECKS)[number];

export interface ProblemDoc {
  /** What the problem means, for a user reading a failed check. */
  readonly meaning: string;
  /** What to do about it. */
  readonly fix: string;
}

/**
 * The user text of every check, in the order of `CHECKS`. The Reference renders it under
 * `bdk plan check` (`pnpm docs:reference`); a check without its text does not compile.
 */
export const PROBLEMS: Readonly<Record<Check, ProblemDoc>> = {
  "no-parts": {
    meaning: "The directory holds no part file `NN.md`, so there is no plan to check.",
    fix: "Check the path: it is `openspec/changes/<change>/plan/parts`. When it is right, run `/bdk:plan <change>` to write the parts.",
  },
  name: {
    meaning:
      "A `.md` file in the directory is not named `NN.md` (two digits), so it is not read as a part.",
    fix: "Rename it to the next free `NN.md` when it is a part, and set its `id` to match; otherwise move it out of the directory.",
  },
  frontmatter: {
    meaning:
      "The frontmatter of a part breaks a rule; the message names the key. The part gets no wave until it is fixed.",
    fix: 'Fix the key the message names: `id` is the quoted file stem (`"01"`), `depends-on` a list of quoted part ids (`[]` for none), and `files` lists exact repository-relative file paths, with no glob, directory, absolute path or `..`. Remove `isolation`: every part runs in the main checkout, one after another.',
  },
  "no-tasks": {
    meaning: "The part has no numbered task under its `## Tasks` heading.",
    fix: "Write its tasks as a numbered list under a level-2 `## Tasks` heading, or remove the part when it has nothing to build.",
  },
  "max-tasks": {
    meaning: "The part has more tasks than `plan.part.max-tasks` allows.",
    fix: "Split the part in two; parts that do not depend on each other share a wave. Raise `plan.part.max-tasks` only when your agents handle bigger parts well.",
  },
  "max-files": {
    meaning:
      "The part lists more files than `plan.part.max-files` allows; a file listed twice counts once.",
    fix: "Split the part in two by the files it touches. Raise `plan.part.max-files` only when your agents handle bigger parts well.",
  },
  "max-bytes": {
    meaning: "The part file is larger, in bytes, than `plan.part.max-bytes` allows.",
    fix: "Split the part in two, or cut text the implementer does not need. Raise `plan.part.max-bytes` only when your agents handle bigger parts well.",
  },
  "present-scenario": {
    meaning: `A scenario the part marks \`${PRESENT_MARKER}\` has no \`Verified by:\` line that names it and ends \`${PRESENT_ENDING}\`, or a line with that ending also names a scenario of the part that is not marked. The implementer reads the ending as a test that passes before any code; without it, it stops the part when the test passes, and on an unmarked scenario it takes a missing behaviour for a present one.`,
    fix: `Give each present scenario a \`Verified by:\` line of its own in the task that adds its test (a task may hold several): the scenario, the test with its exact input and expected result, and the ending \`${PRESENT_ENDING}\`. Name the other scenarios of the task on a line without it. When the behaviour is not present after all, remove the marker.`,
  },
  "unknown-dependency": {
    meaning:
      "`depends-on` names a part id that has no part file. The part gets no wave, and neither does any part that depends on it.",
    fix: "Correct the id, or remove it from `depends-on`.",
  },
  cycle: {
    meaning:
      "Parts depend on each other in a cycle, or a part depends on itself, so no order can build them. They get no wave.",
    fix: "Remove the edge that is not needed: `depends-on` lists only the parts whose output a part uses. When two parts truly need each other, move what both need into a part of its own that both depend on, or merge them.",
  },
};

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

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** True when `line` holds `name` as whole words. */
const names = (line: string, name: string): boolean =>
  new RegExp(`(?<!\\w)${escape(name)}(?!\\w)`).test(line);

/** The present-scenario problems of one part, one message each. */
function presentProblems(part: Part): string[] {
  const present = part.scenarios.filter((s) => s.present).map((s) => s.name);
  if (present.length === 0) return [];
  const others = part.scenarios
    .filter((s) => !s.present && !present.includes(s.name))
    .map((s) => s.name);
  const ending = part.verifiedBy.filter((line) => line.endsWith(PRESENT_ENDING));
  const messages: string[] = [];
  for (const name of present) {
    if (ending.some((line) => names(line, name))) continue;
    messages.push(
      `scenario "${name}" is marked${PRESENT_MARKER}, but no Verified by: line names it and ends "${PRESENT_ENDING}"`,
    );
  }
  // Only the scenarios a line names count, not a test's input or output (`Total: 0.00`): the
  // text before its first "; ", without code spans. A present name that holds an unmarked one
  // ("Total" in "Total of an empty ledger") is not it.
  const longestFirst = [...present].sort((a, b) => b.length - a.length);
  const mixed = new Set<string>();
  for (const line of ending) {
    const named = (line.split("; ")[0] ?? "").replace(/`[^`]*`/g, " ");
    const rest = longestFirst.reduce((text, name) => text.split(name).join(" "), named);
    for (const name of others) if (names(rest, name)) mixed.add(name);
  }
  for (const name of others.filter((other) => mixed.has(other))) {
    messages.push(
      `a Verified by: line that ends "${PRESENT_ENDING}" names "${name}", which is not marked${PRESENT_MARKER}`,
    );
  }
  return messages;
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
    for (const message of presentProblems(part)) add("present-scenario", [part.id], message);
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
