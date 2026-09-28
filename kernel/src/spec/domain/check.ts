// The semantic checks of a delta against the current living spec
// (`kernel-cli/spec`, bdk spec delta check; D2b, C1-C3). An operation the
// file already shows as merged by this Change is not a problem (T30-D5), so
// the check still passes after `spec merge`.
import { blockText, hasBullet, statement } from "./grammar.ts";
import type { Delta, LivingSpec, Requirement } from "./grammar.ts";
import type { Problem, ProblemCode } from "./reports.ts";

export interface CheckInput {
  readonly delta: Delta;
  /** Undefined when the capability has no spec file yet. */
  readonly current: LivingSpec | undefined;
  readonly changeId: string;
  /** `spec.normative-word`. */
  readonly word: string;
}

/** The shortest purpose that describes a capability (`kernel-state`, Spec delta). */
const PURPOSE_MIN = 50;

export function checkDelta(input: CheckInput): Problem[] {
  const { delta, current, changeId } = input;
  const problems: Problem[] = [...delta.problems];
  const add = (line: number, code: ProblemCode, message: string): void => {
    problems.push({ line, code, message });
  };
  if (
    delta.added.length + delta.modified.length + delta.removed.length === 0 &&
    delta.purpose === undefined
  ) {
    add(1, "delta-empty", "the delta has no requirement and no purpose");
    return sorted(problems);
  }

  const merged = current?.change === changeId;
  const held = new Map((current?.requirements ?? []).map((item) => [item.name, item]));
  const wholeRemovals = new Set(
    delta.removed.filter((removal) => removal.scenarios.length === 0).map((item) => item.name),
  );
  const listed = new Map(
    delta.removed.map((removal) => [
      removal.name,
      new Set(removal.scenarios.map((scenario) => scenario.name)),
    ]),
  );

  duplicates(delta, add);
  const word = normativeWord(input.word);
  for (const requirement of [...delta.added, ...delta.modified]) {
    if (!word.test(statement(requirement))) {
      add(
        requirement.line,
        "normative-word",
        `requirement "${requirement.name}" states no "${input.word}"`,
      );
    }
    if (requirement.scenarios.length === 0) {
      add(
        requirement.line,
        "scenario-missing",
        `requirement "${requirement.name}" has no scenario`,
      );
    }
    for (const scenario of requirement.scenarios) {
      for (const bullet of ["WHEN", "THEN"] as const) {
        if (hasBullet(scenario, bullet)) continue;
        add(
          scenario.line,
          bullet === "WHEN" ? "when-missing" : "then-missing",
          `scenario "${scenario.name}" has no "- **${bullet}**" bullet`,
        );
      }
    }
  }

  for (const requirement of delta.added) {
    const existing = held.get(requirement.name);
    if (
      existing !== undefined &&
      !merged &&
      !wholeRemovals.has(requirement.name) &&
      blockText(existing) !== blockText(requirement)
    ) {
      add(
        requirement.line,
        "requirement-exists",
        `requirement "${requirement.name}" exists; change it under MODIFIED Requirements`,
      );
    }
  }

  for (const requirement of delta.modified) {
    const existing = held.get(requirement.name);
    if (existing === undefined) {
      add(requirement.line, "requirement-unknown", unknown(requirement.name));
      continue;
    }
    const kept = new Set(requirement.scenarios.map((scenario) => scenario.name));
    const removed = listed.get(requirement.name) ?? new Set<string>();
    for (const scenario of existing.scenarios) {
      if (kept.has(scenario.name) || removed.has(scenario.name)) continue;
      add(
        requirement.line,
        "scenario-lost",
        `requirement "${requirement.name}" drops scenario "${scenario.name}"; list it under REMOVED Requirements to remove it`,
      );
    }
  }

  for (const removal of delta.removed) {
    const existing = held.get(removal.name);
    if (existing === undefined) {
      if (!merged) add(removal.line, "requirement-unknown", unknown(removal.name));
      continue;
    }
    const names = new Set(existing.scenarios.map((scenario) => scenario.name));
    for (const scenario of removal.scenarios) {
      if (names.has(scenario.name) || merged) continue;
      add(
        scenario.line,
        "requirement-unknown",
        `requirement "${removal.name}" has no scenario "${scenario.name}"`,
      );
    }
    const modified = delta.modified.some((requirement) => requirement.name === removal.name);
    const left = existing.scenarios.filter(
      (scenario) => !removal.scenarios.some((listedOne) => listedOne.name === scenario.name),
    );
    if (removal.scenarios.length > 0 && !modified && left.length === 0) {
      add(
        removal.line,
        "scenario-missing",
        `removing the listed scenarios leaves requirement "${removal.name}" none; remove the requirement instead`,
      );
    }
  }

  if (delta.purpose !== undefined && delta.purpose.text.length < PURPOSE_MIN) {
    add(
      delta.purpose.line,
      "purpose-missing",
      `the purpose is shorter than ${PURPOSE_MIN} characters`,
    );
  } else if (current === undefined && delta.purpose === undefined) {
    add(1, "purpose-missing", "a new capability needs a ## Purpose section");
  }
  return sorted(problems);
}

/** The word as a whole, case-sensitive word. */
function normativeWord(word: string): RegExp {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, "u");
}

function unknown(name: string): string {
  return `the current spec holds no requirement "${name}"`;
}

function duplicates(
  delta: Delta,
  add: (line: number, code: ProblemCode, message: string) => void,
): void {
  const report = (item: { readonly name: string; readonly line: number }, where: string): void => {
    add(item.line, "requirement-duplicate", `requirement "${item.name}" is named twice ${where}`);
  };
  for (const [name, items] of [
    ["in ADDED Requirements", delta.added],
    ["in MODIFIED Requirements", delta.modified],
    ["in REMOVED Requirements", delta.removed],
  ] as const) {
    const seen = new Set<string>();
    for (const item of items) {
      if (seen.has(item.name)) report(item, name);
      seen.add(item.name);
    }
  }
  const later = <T extends { readonly line: number }>(a: T, b: T): T => (a.line > b.line ? a : b);
  const added = new Map(delta.added.map((item: Requirement) => [item.name, item]));
  const wholeRemovals = new Map(
    delta.removed.filter((item) => item.scenarios.length === 0).map((item) => [item.name, item]),
  );
  for (const modified of delta.modified) {
    const inAdded = added.get(modified.name);
    if (inAdded !== undefined) report(later(inAdded, modified), "in ADDED and MODIFIED");
    const removal = wholeRemovals.get(modified.name);
    if (removal !== undefined) {
      const at = removal.line > modified.line ? removal : modified;
      report(at, "in MODIFIED and as a whole in REMOVED");
    }
  }
}

function sorted(problems: readonly Problem[]): Problem[] {
  return [...problems].sort((a, b) => a.line - b.line);
}
