// `bdk log add`: validates the input, then appends through `appendEntry`
// with deduplication. Nothing is written before every check has passed.
import { join, relative, sep } from "node:path";

import { parseReference } from "../../shared/ids/index.ts";
import { isRefusal, refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import {
  findChange,
  findEntry,
  openPackage,
  readAttempts,
  readPlanParts,
  refreshChange,
  TASK_ID,
  targetFiles,
} from "../../shared/store/index.ts";
import type { IndexDb } from "../../shared/store/index.ts";
import { appendEntry } from "./append.ts";
import type { AddResult } from "../domain/entry.ts";
import { classify, mayDowngrade } from "../domain/p8.ts";
import type { LogDeps } from "./deps.ts";
import { withChangeIndex } from "./deps.ts";
import { verifierPolicy } from "./verifier.ts";

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
  readonly category?: string;
  /** Only with `learning`; defaults to the `Files:` of the ticket's task. */
  readonly applies?: readonly string[];
}

const CATEGORY_TYPES: readonly string[] = ["finding", "blocker"];

export function addEntry(
  deps: LogDeps,
  change: ActiveChange,
  globalDir: string,
  input: AddInput,
): Promise<AddResult | Refusal> {
  const invalid = validate(input);
  if (invalid !== undefined) return Promise.resolve(invalid);
  return withChangeIndex(deps, change, async (index) => {
    if (input.supersedes !== undefined) {
      const missing = checkSupersedes(deps, change, index, input.supersedes);
      if (missing !== undefined) return missing;
    }
    const active =
      input.ticket === undefined
        ? undefined
        : openPackage(deps.store, change.projectRoot, change.dir, input.ticket);
    const role = active?.role;
    let report: ReportFields | undefined;
    if (input.type === "report" && active !== undefined) {
      const fields = reportFields(deps, change, input.refs, active.data);
      if ("refused" in fields) return fields;
      report = fields;
    }
    let blocking: readonly string[] = [];
    if (mayDowngrade(input.type, role)) {
      const policy = verifierPolicy(deps, change, globalDir);
      if (isRefusal(policy)) return policy;
      blocking = policy.blocking.map((category) => category.id);
    }
    const { downgraded, ...classified } = classify(input, role, blocking);
    const applies = input.applies ?? defaultApplies(deps, change, input);
    // A downgraded blocker is an observation, which carries no category field.
    const { category, ...rest } = applies === undefined ? input : { ...input, applies };
    const base = downgraded === undefined && category !== undefined ? { ...rest, category } : rest;
    // Each verification round is its own report, so a report is never deduplicated.
    const appended = await appendEntry(
      deps,
      change,
      index,
      { ...base, ...classified, ...report },
      { dedupe: report === undefined },
    );
    return "refused" in appended || downgraded === undefined
      ? appended
      : { ...appended, downgraded };
  });
}

interface ReportFields {
  readonly refs: readonly string[];
  readonly report: string;
}

/**
 * A `report` entry names the report `log ingest` stored at the package's
 * `report` path, relative to the Change directory, and the ticket's target,
 * so the verdict node of that target reads it (`kernel-pipeline`, Artifact kinds).
 */
function reportFields(
  deps: LogDeps,
  change: ActiveChange,
  refs: readonly string[],
  dispatch: { readonly target: string; readonly report: string },
): ReportFields | Refusal {
  const path = join(change.projectRoot, dispatch.report);
  if (deps.store.read(path) === undefined) {
    return refuse("input/not-found", `no report is stored at ${dispatch.report} yet`, [
      "store the report first: bdk log ingest --ticket <ticket>",
    ]);
  }
  return {
    refs: refs.includes(dispatch.target) ? refs : [...refs, dispatch.target],
    report: relative(change.dir, path).split(sep).join("/"),
  };
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
  if (input.category !== undefined && !CATEGORY_TYPES.includes(input.type)) {
    return refuse(
      "input/invalid-argument",
      `--category applies to finding and blocker, the types that carry it, not ${input.type}`,
      [
        `bdk log add ${input.type} "${input.summary}" --ref <ref>`,
        "bdk log add blocker ... --category <id>",
      ],
    );
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
  if (input.type === "report" && input.ticket === undefined) {
    return refuse(
      "input/missing-argument",
      "log add report needs --ticket: the report is the one log ingest stored under that ticket",
      [`bdk log add report "${input.summary}" --ref <target> --ticket <ticket>`],
    );
  }
  if (input.applies !== undefined && input.type !== "learning") {
    return refuse(
      "input/invalid-argument",
      `--applies names the files a lesson is about; it applies to learning, not ${input.type}`,
      [
        `bdk log add ${input.type} "${input.summary}" --ref <ref>`,
        "bdk log add learning ... --applies <glob>",
      ],
    );
  }
  return undefined;
}

/** A learning under a task ticket is about the task's `Files:`; any other entry has no default. */
function defaultApplies(
  deps: LogDeps,
  change: ActiveChange,
  input: AddInput,
): readonly string[] | undefined {
  if (input.type !== "learning" || input.ticket === undefined) return undefined;
  const target = readAttempts(deps.store, change.dir).find(
    (record) => record.data.ticket === input.ticket,
  )?.data.target;
  if (target === undefined || !TASK_ID.test(target)) return undefined;
  const files = targetFiles(readPlanParts(deps.store, change.dir), target);
  return files === undefined || files.length === 0 ? undefined : files;
}

/** Why `value` cannot be superseded, or undefined when it names an existing entry. */
interface SupersedesProblem {
  readonly rule: "input/invalid-argument" | "input/not-found";
  /** Completes a sentence whose subject is the entry id: "is not an entry id". */
  readonly why: string;
}

/** `supersedes` names an existing entry: bare in this Change, or qualified in any Change. */
function supersedesProblem(
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
