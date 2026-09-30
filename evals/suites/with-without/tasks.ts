// The task file of a with / without run (design D-9): a YAML list of
// `{id, prompt, assert}`, the assertions in promptfoo's syntax. Every error
// names the entry, so a long task file is fixed in one pass.
import { readFileSync } from "node:fs";

import { parse } from "yaml";

export interface WithWithoutTask {
  readonly id: string;
  readonly prompt: string;
  /** promptfoo assertions; the run's pass and score come from them. */
  readonly assert?: readonly unknown[];
}

export class TaskFileError extends Error {
  constructor(file: string, problems: readonly string[]) {
    super(`${file}: ${problems.join("; ")}`);
    this.name = "TaskFileError";
  }
}

const ID = /^[a-z0-9][a-z0-9-]*$/;
const FIELDS = new Set(["id", "prompt", "assert"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseTasks(text: string, file: string): WithWithoutTask[] {
  const data: unknown = parse(text);
  if (!Array.isArray(data) || data.length === 0) {
    throw new TaskFileError(file, ["a task file is a non-empty list of {id, prompt, assert}"]);
  }
  const problems: string[] = [];
  const seen = new Set<string>();
  const tasks: WithWithoutTask[] = [];
  data.forEach((entry: unknown, index) => {
    const at = `entry ${String(index + 1)}`;
    if (!isRecord(entry)) {
      problems.push(`${at} is not a mapping`);
      return;
    }
    const name = typeof entry.id === "string" ? `${at} (${entry.id})` : at;
    const before = problems.length;
    if (typeof entry.id !== "string" || !ID.test(entry.id)) {
      problems.push(`${name}: id must be lowercase letters, digits and dashes`);
    } else if (seen.has(entry.id)) {
      problems.push(`${name}: id is not unique`);
    } else {
      seen.add(entry.id);
    }
    if (typeof entry.prompt !== "string" || entry.prompt.trim() === "") {
      problems.push(`${name}: prompt must be a non-empty string`);
    }
    if (entry.assert !== undefined && !Array.isArray(entry.assert)) {
      problems.push(`${name}: assert must be a list of promptfoo assertions`);
    }
    for (const key of Object.keys(entry)) {
      if (!FIELDS.has(key)) problems.push(`${name}: unknown field ${key}`);
    }
    if (problems.length === before) {
      tasks.push({
        id: entry.id as string,
        prompt: entry.prompt as string,
        ...(entry.assert === undefined ? {} : { assert: entry.assert as unknown[] }),
      });
    }
  });
  if (problems.length > 0) throw new TaskFileError(file, problems);
  return tasks;
}

export function readTasks(file: string): WithWithoutTask[] {
  return parseTasks(readFileSync(file, "utf8"), file);
}
