// The case files of the stages suite (design D-8 of v3-t41-setup-change): per
// stage skill a YAML list of cases. A case types one slash command in a fresh
// copy of its base that its `prepare` commands set up, answers the skill's
// questions, and states the kernel state the run must leave. Every error names the
// entry, so a case file is fixed in one pass.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

import { SEEDS, isSeed } from "./seeds.ts";
import type { SeedName } from "./seeds.ts";

/**
 * A kernel command and what its JSON answer must hold, a shell command for
 * the git state no kernel command reports, or a pattern the final reply must
 * match.
 */
export type Expectation =
  | {
      readonly run: string;
      readonly exit?: number;
      /** Dotted path in the `--json` answer -> expected value; `null` also matches an absent path. */
      readonly json?: Readonly<Record<string, unknown>>;
      /** Dotted path in the `--json` answer -> a pattern its string value matches. */
      readonly match?: Readonly<Record<string, string>>;
    }
  | {
      /** Run with `sh -c` in the working copy, `$BDK` set as in `prepare`. */
      readonly shell: string;
      /** The expected exit code; 0 when absent. */
      readonly exit?: number;
      /** A pattern its stdout matches. */
      readonly stdout?: string;
    }
  | { readonly reply: string };

/** What a run starts from: the pinned fixture, or an empty git repository. */
type Base = "fixture" | "empty";

export interface StageCase {
  readonly id: string;
  readonly base: Base;
  /** What the user types, a `/bdk:` slash command with its arguments. */
  readonly command: string;
  /** A seed run in the fresh working copy before `prepare` (seeds.ts). */
  readonly seed?: SeedName;
  /** Shell commands run in the fresh working copy before the session. */
  readonly prepare: readonly string[];
  /** A pattern of a question's header or text -> a pattern of the option to choose (answer.ts). */
  readonly answers: Readonly<Record<string, string>>;
  readonly expect: readonly Expectation[];
}

export class CaseFileError extends Error {
  constructor(file: string, problems: readonly string[]) {
    super(`${file}: ${problems.join("; ")}`);
    this.name = "CaseFileError";
  }
}

const ID = /^[a-z0-9][a-z0-9-]*$/;
const FIELDS = new Set(["id", "base", "command", "seed", "prepare", "answers", "expect"]);

export function caseFile(skill: string): string {
  return fileURLToPath(new URL(`./cases/${skill}.yaml`, import.meta.url));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function expectationProblems(value: unknown, at: string): string[] {
  if (!isRecord(value)) return [`${at} is not a mapping`];
  const problems: string[] = [];
  const keys = Object.keys(value);
  if ("shell" in value) {
    if (typeof value.shell !== "string" || value.shell.trim() === "") {
      problems.push(`${at}: shell must be a non-empty command`);
    }
    if (value.exit !== undefined && !Number.isInteger(value.exit)) {
      problems.push(`${at}: exit must be an integer`);
    }
    if (value.stdout !== undefined && typeof value.stdout !== "string") {
      problems.push(`${at}: stdout must be a pattern`);
    }
    for (const key of keys) {
      if (!["shell", "exit", "stdout"].includes(key)) problems.push(`${at}: unknown field ${key}`);
    }
    return problems;
  }
  if ("reply" in value) {
    if (typeof value.reply !== "string" || value.reply === "") {
      problems.push(`${at}: reply must be a non-empty pattern`);
    }
    for (const key of keys) if (key !== "reply") problems.push(`${at}: unknown field ${key}`);
    return problems;
  }
  if (typeof value.run !== "string" || value.run.trim() === "") {
    problems.push(`${at}: run must name a kernel command, shell a command, or reply a pattern`);
  }
  if (value.exit !== undefined && !Number.isInteger(value.exit)) {
    problems.push(`${at}: exit must be an integer`);
  }
  if (value.json !== undefined && !isRecord(value.json)) {
    problems.push(`${at}: json must map dotted paths to values`);
  }
  if (
    value.match !== undefined &&
    !(isRecord(value.match) && Object.values(value.match).every((v) => typeof v === "string"))
  ) {
    problems.push(`${at}: match must map dotted paths to patterns`);
  }
  for (const key of keys) {
    if (!["run", "exit", "json", "match"].includes(key))
      problems.push(`${at}: unknown field ${key}`);
  }
  return problems;
}

function entryProblems(entry: Record<string, unknown>, name: string): string[] {
  const problems: string[] = [];
  if (typeof entry.id !== "string" || !ID.test(entry.id)) {
    problems.push(`${name}: id must be lowercase letters, digits and dashes`);
  }
  if (entry.base !== undefined && entry.base !== "fixture" && entry.base !== "empty") {
    problems.push(`${name}: base must be fixture or empty`);
  }
  if (typeof entry.command !== "string" || !entry.command.startsWith("/bdk:")) {
    problems.push(`${name}: command must be a /bdk: slash command`);
  }
  if (entry.seed !== undefined && !isSeed(entry.seed)) {
    problems.push(`${name}: seed must be one of ${SEEDS.join(", ")}`);
  }
  if (entry.prepare !== undefined && !isStringList(entry.prepare)) {
    problems.push(`${name}: prepare must be a list of shell commands`);
  }
  if (
    entry.answers !== undefined &&
    !(isRecord(entry.answers) && Object.values(entry.answers).every((v) => typeof v === "string"))
  ) {
    problems.push(`${name}: answers must map a question pattern to an option pattern`);
  }
  if (!Array.isArray(entry.expect) || entry.expect.length === 0) {
    problems.push(`${name}: expect must be a non-empty list`);
  } else {
    entry.expect.forEach((item: unknown, index) => {
      problems.push(...expectationProblems(item, `${name}: expect ${String(index + 1)}`));
    });
  }
  for (const key of Object.keys(entry)) {
    if (!FIELDS.has(key)) problems.push(`${name}: unknown field ${key}`);
  }
  return problems;
}

export function parseCases(text: string, file: string): StageCase[] {
  const data: unknown = parse(text);
  if (!Array.isArray(data) || data.length === 0) {
    throw new CaseFileError(file, ["a case file is a non-empty list of cases"]);
  }
  const problems: string[] = [];
  const seen = new Set<string>();
  const cases: StageCase[] = [];
  data.forEach((entry: unknown, index) => {
    const at = `entry ${String(index + 1)}`;
    if (!isRecord(entry)) {
      problems.push(`${at} is not a mapping`);
      return;
    }
    const name = typeof entry.id === "string" ? `${at} (${entry.id})` : at;
    const found = entryProblems(entry, name);
    if (typeof entry.id === "string" && seen.has(entry.id)) found.push(`${name}: id is not unique`);
    if (typeof entry.id === "string") seen.add(entry.id);
    problems.push(...found);
    if (found.length === 0) {
      cases.push({
        id: entry.id as string,
        base: (entry.base as Base | undefined) ?? "fixture",
        command: entry.command as string,
        ...(isSeed(entry.seed) ? { seed: entry.seed } : {}),
        prepare: (entry.prepare as string[] | undefined) ?? [],
        answers: (entry.answers as Record<string, string> | undefined) ?? {},
        expect: entry.expect as Expectation[],
      });
    }
  });
  if (problems.length > 0) throw new CaseFileError(file, problems);
  return cases;
}

export function readCases(file: string): StageCase[] {
  return parseCases(readFileSync(file, "utf8"), file);
}
