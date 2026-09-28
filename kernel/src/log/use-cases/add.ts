// `bdk log add`: validates the input, then appends through `appendEntry`
// with deduplication. Nothing is written before every check has passed.
import { parseReference } from "../../shared/ids/index.ts";
import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import { findChange, findEntry, refreshChange } from "../../shared/store/index.ts";
import type { IndexDb } from "../../shared/store/index.ts";
import { appendEntry } from "./append.ts";
import type { AppendResult } from "../domain/entry.ts";
import type { LogDeps } from "./deps.ts";
import { withChangeIndex } from "./deps.ts";

const SUMMARY_MAX = 120;

export interface AddInput {
  readonly type: string;
  readonly summary: string;
  readonly refs: readonly string[];
  /** The body text, already read from stdin for `--body -`. */
  readonly body: string;
  readonly status?: string;
  readonly ticket?: string;
  readonly review: boolean;
  readonly supersedes?: string;
}

export function addEntry(
  deps: LogDeps,
  change: ActiveChange,
  input: AddInput,
): Promise<AppendResult | Refusal> {
  const invalid = validate(input);
  if (invalid !== undefined) return Promise.resolve(invalid);
  return withChangeIndex(deps, change, async (index) => {
    if (input.supersedes !== undefined) {
      const missing = checkSupersedes(deps, change, index, input.supersedes);
      if (missing !== undefined) return missing;
    }
    return appendEntry(deps, change, index, input, { dedupe: true });
  });
}

function validate(input: AddInput): Refusal | undefined {
  const summary = input.summary.trim();
  if (summary === "" || input.summary.length > SUMMARY_MAX) {
    return refuse(
      "input/invalid-argument",
      `<summary> has ${input.summary.length} characters; it needs 1 to ${SUMMARY_MAX}`,
      ["move the detail into --body"],
    );
  }
  if (input.refs.length === 0 || input.refs.some((ref) => ref.trim() === "")) {
    return refuse("input/missing-argument", "log add needs at least one non-empty --ref", [
      `bdk log add ${input.type} "${input.summary}" --ref <file|symbol|part|task|rule|entry>`,
    ]);
  }
  if (input.status === "superseded") {
    return refuse(
      "input/invalid-argument",
      "--status superseded is derived from --supersedes, never written",
      [
        `bdk log add ${input.type} "..." --supersedes <id>`,
        "bdk log resolve <id> superseded --by <id>",
      ],
    );
  }
  if (input.status === "routed") {
    return refuse("input/invalid-argument", "--status routed is set only by log route", [
      "bdk log route <id> rule|spec|nothing",
    ]);
  }
  return undefined;
}

/** Why `value` cannot be superseded, or undefined when it names an existing entry. */
export interface SupersedesProblem {
  readonly rule: "input/invalid-argument" | "input/not-found";
  /** Completes a sentence whose subject is the entry id: "is not an entry id". */
  readonly why: string;
}

/** `supersedes` names an existing entry: bare in this Change, or qualified in any Change. */
export function supersedesProblem(
  deps: LogDeps,
  change: ActiveChange,
  index: IndexDb,
  value: string,
): SupersedesProblem | undefined {
  const reference = parseReference(value);
  if (!reference?.id.startsWith("L-")) {
    return { rule: "input/invalid-argument", why: "is not an entry id" };
  }
  const changeId = reference.changeId ?? change.id;
  if (changeId !== change.id) {
    const location = findChange(deps.store, change.projectRoot, changeId);
    if (location === undefined)
      return { rule: "input/not-found", why: `names no Change ${changeId}` };
    refreshChange(index, location);
  }
  return findEntry(index, changeId, reference.id) === undefined
    ? { rule: "input/not-found", why: `names no entry of ${changeId}` }
    : undefined;
}

function checkSupersedes(
  deps: LogDeps,
  change: ActiveChange,
  index: IndexDb,
  value: string,
): Refusal | undefined {
  const problem = supersedesProblem(deps, change, index, value);
  if (problem === undefined) return undefined;
  return problem.rule === "input/invalid-argument"
    ? refuse(problem.rule, `--supersedes ${value} ${problem.why}`, [
        "--supersedes L-xxxxxxxx",
        "--supersedes <changeId>/L-xxxxxxxx",
      ])
    : refuse(problem.rule, `--supersedes ${value} ${problem.why}`, [
        "bdk log list",
        "bdk log show <id>",
      ]);
}
