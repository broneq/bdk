// `plan/parts/<nn>-<slug>.md` and the generated `plan/index.md` (`kernel-state`,
// Plan part and plan index). Tasks live in the part body (T21, T22).
import * as z from "zod";

import { glob } from "./common.ts";
import type { DocumentKind } from "./common.ts";

const VERSION = 1;

export const partId = z
  .string()
  .regex(/^\d{2}$/)
  .meta({ description: "Two digits, equal to `<nn>` of the file name." });

const capability = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/);

export const planPartKind = {
  name: "plan-part",
  version: VERSION,
  schema: z
    .strictObject({
      schema: z.literal(VERSION),
      id: partId,
      title: z.string().min(1),
      goal: z.string().min(1),
      "success-measure": z.string().min(1).meta({ description: "What a reviewer can observe." }),
      "do-not-touch": z.array(glob),
      "depends-on": z.array(partId),
      "spec-impact": z.union([z.literal("none"), z.array(capability)]),
    })
    .meta({ title: "Plan part" }),
  migrations: [],
} as const satisfies DocumentKind;

export const planIndexKind = {
  name: "plan-index",
  version: VERSION,
  schema: z
    .strictObject({
      schema: z.literal(VERSION),
      generated: z.literal(true),
      parts: z.array(
        z.strictObject({
          id: partId,
          title: z.string().min(1),
          "depends-on": z.array(partId),
          wave: z.int().min(1),
        }),
      ),
    })
    .meta({ title: "Plan index", description: "Generated from the plan parts; never edited." }),
  migrations: [],
} as const satisfies DocumentKind;

/** One `Files:` item: a relative path and the template's optional action. */
export interface PlanFile {
  readonly path: string;
  readonly action?: "Create" | "Modify" | "Test" | "Delete";
}

/** A task of a plan part body (`kernel-state`, Plan part and plan index). */
export interface PlanTask {
  readonly id: string;
  readonly title: string;
  readonly files: readonly PlanFile[];
  readonly testCases?: readonly string[];
  readonly verification?: "none";
  readonly dependsOn: readonly string[];
  readonly stopRule?: string;
}

export interface ParsedTasks {
  readonly tasks: readonly PlanTask[];
  /** Grammar problems, one sentence each; empty when the body is well formed. */
  readonly problems: readonly string[];
}

export const TASK_ID = /^\d{2}-[1-9]\d*$/;

const HEADING = /^## (\S+)(?:\s+(.*?))?\s*$/;
const LABEL = /^\*\*(Files|Test cases|Verification|Depends on|Stop rule):\*\*\s*(.*?)\s*$/;
const ITEM = /^\s*[-*]\s+(.*?)\s*$/;
const FILE_ITEM = /^(?:(Create|Modify|Test|Delete):\s*)?`([^`]+)`/;

interface Draft {
  readonly id: string;
  readonly title: string;
  readonly labels: Map<string, { readonly value: string; readonly items: string[] }>;
}

/**
 * The tasks of a plan part body: each `## <nn>-<k> <title>` heading opens a
 * task that ends at the next level-2 heading; under it the bold labels of
 * the task grammar are read and any other text is free.
 */
export function parsePlanTasks(body: string): ParsedTasks {
  const problems: string[] = [];
  const drafts: Draft[] = [];
  let current: Draft | undefined;
  let items: string[] | undefined;
  for (const line of body.split(/\r?\n/)) {
    const heading = line.startsWith("## ") ? HEADING.exec(line) : null;
    if (heading !== null) {
      items = undefined;
      const [, id = "", title = ""] = heading;
      if (TASK_ID.test(id)) {
        current = { id, title, labels: new Map() };
        drafts.push(current);
      } else {
        current = undefined;
        if (/^\d/.test(id)) problems.push(`heading '${line}' is not '## <nn>-<k> <title>'`);
      }
      continue;
    }
    if (current === undefined) continue;
    const label = LABEL.exec(line);
    if (label !== null) {
      const [, name = "", value = ""] = label;
      items = [];
      current.labels.set(name, { value, items });
      continue;
    }
    const item = ITEM.exec(line);
    if (items !== undefined && item !== null) items.push(item[1] ?? "");
    else if (items !== undefined && /^\s{2,}\S/.test(line) && items.length > 0) {
      items[items.length - 1] = `${items.at(-1) ?? ""} ${line.trim()}`;
    } else if (line.trim() !== "") items = undefined;
  }

  const ids = new Set<string>();
  const tasks: PlanTask[] = [];
  for (const draft of drafts) {
    if (ids.has(draft.id)) problems.push(`task id ${draft.id} appears twice`);
    ids.add(draft.id);
    tasks.push(taskOf(draft, problems));
  }
  for (const task of tasks) {
    for (const dependency of task.dependsOn) {
      if (!ids.has(dependency)) {
        problems.push(`task ${task.id} depends on ${dependency}, which this part does not hold`);
      }
    }
  }
  return { tasks, problems };
}

function taskOf(draft: Draft, problems: string[]): PlanTask {
  const { id, labels } = draft;
  const files: PlanFile[] = [];
  const listed = labels.get("Files");
  if (listed === undefined || listed.items.length === 0) {
    problems.push(`task ${id} has no **Files:** list`);
  }
  for (const item of listed?.items ?? []) {
    const match = FILE_ITEM.exec(item);
    if (match === null) {
      problems.push(`task ${id}: **Files:** item '${item}' holds no backticked path`);
      continue;
    }
    const action = match[1] as PlanFile["action"];
    files.push({ path: match[2] ?? "", ...(action === undefined ? {} : { action }) });
  }

  const testCases = labels.get("Test cases")?.items ?? [];
  const verification = labels.get("Verification")?.value;
  if (verification !== undefined && verification !== "none") {
    problems.push(`task ${id}: **Verification:** must be none, not '${verification}'`);
  } else if (testCases.length === 0 && verification === undefined) {
    problems.push(`task ${id} has neither **Test cases:** nor **Verification:** none`);
  }

  const depends = labels.get("Depends on")?.value ?? "none";
  const dependsOn =
    depends === "none" || depends === ""
      ? []
      : depends.split(",").map((dependency) => dependency.trim());
  const stopRule = labels.get("Stop rule")?.value;
  return {
    id,
    title: draft.title,
    files,
    ...(testCases.length > 0 ? { testCases } : {}),
    ...(verification === "none" ? { verification } : {}),
    dependsOn,
    ...(stopRule === undefined || stopRule === "" ? {} : { stopRule }),
  };
}

/** Whether an executable field holds a placeholder (`kernel-state`, Plan part and plan index). */
export function hasPlaceholder(text: string): boolean {
  const trimmed = text.trim();
  return (
    /\b(?:TODO|TBD|FIXME)\b/.test(trimmed) ||
    trimmed.includes("<fill in>") ||
    trimmed.includes("[...]") ||
    trimmed === "..." ||
    trimmed === "…" ||
    /^\[[^\]]*\]$/.test(trimmed)
  );
}

/** The executable fields of a part holding a placeholder, named for a refusal. */
export function planPlaceholders(
  frontmatter: { readonly goal: string; readonly "success-measure": string },
  tasks: readonly PlanTask[],
): string[] {
  const found: string[] = [];
  if (hasPlaceholder(frontmatter.goal)) found.push("goal");
  if (hasPlaceholder(frontmatter["success-measure"])) found.push("success-measure");
  for (const task of tasks) {
    if (hasPlaceholder(task.title)) found.push(`task ${task.id} title`);
    task.files.forEach((file, at) => {
      if (hasPlaceholder(file.path))
        found.push(`task ${task.id} **Files:** item ${String(at + 1)}`);
    });
    (task.testCases ?? []).forEach((testCase, at) => {
      if (hasPlaceholder(testCase)) {
        found.push(`task ${task.id} **Test cases:** item ${String(at + 1)}`);
      }
    });
    if (task.stopRule !== undefined && hasPlaceholder(task.stopRule)) {
      found.push(`task ${task.id} **Stop rule:**`);
    }
  }
  return found;
}
