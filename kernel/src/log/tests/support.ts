// A repository in memory for the log and change tests: one Change bound to
// `feat/login`, a fake git with an author identity, a fixed clock and the
// in-memory index, driven through the real registry.
import commands from "../../../../schema/cli/commands.json" with { type: "json" };
import { fixedClock } from "../../shared/clock/index.ts";
import type { Git, GitResult } from "../../shared/git/index.ts";
import { createRegistry, loadIndex } from "../../shared/registry/index.ts";
import type { Registration } from "../../shared/registry/index.ts";
import {
  memoryIndex,
  memoryStore,
  resolveActiveChange,
  stampPackage,
  writeDocument,
  writeMarker,
} from "../../shared/store/index.ts";
import type { Store } from "../../shared/store/index.ts";
import type { LogDeps } from "../index.ts";
import { settingsRegistry } from "../../registrations.ts";

export const ROOT = "/work/repo";
export const CHANGE = "2026-09-25-login";
export const DIR = `${ROOT}/.bdk/changes/${CHANGE}`;
export const BRANCH = "feat/login";
export const AUTHOR = "Ada Lovelace <ada@example.com>";
export const AT = "2026-09-25T10:15:02.000Z";

export interface FakeGit extends Git {
  branch: string | undefined;
  ident: GitResult;
  /** Paths `git check-ignore` reports as ignored; none by default. */
  ignored: Set<string>;
}

export function fakeGit(): FakeGit {
  const git: FakeGit = {
    branch: BRANCH,
    ident: { code: 0, stdout: `${AUTHOR} 1758795302 +0200\n`, stderr: "" },
    ignored: new Set(),
    currentBranch: () => git.branch,
    run(args) {
      if (args[0] === "var") return Promise.resolve(git.ident);
      if (args[0] === "check-ignore") {
        const code = git.ignored.has(args.at(-1) ?? "") ? 0 : 1;
        return Promise.resolve({ code, stdout: "", stderr: "" });
      }
      return Promise.resolve({ code: 0, stdout: "", stderr: "" });
    },
  };
  return git;
}

export function writeChangeDoc(
  store: Store,
  id = CHANGE,
  dir = `${ROOT}/.bdk/changes/${id}`,
): void {
  writeDocument(store, `${dir}/change.md`, {
    data: {
      schema: 1,
      id,
      kind: "feature",
      profile: "small",
      intent: "Users log in with a one-time link.",
      source: "user",
      at: "2026-09-25T09:00:00.000Z",
      author: AUTHOR,
      overridden: [],
    },
    body: "",
  });
}

/** One Change with change.md, bound to BRANCH. */
export function repository(): Store {
  const store = memoryStore();
  writeChangeDoc(store);
  writeMarker(store, ROOT, BRANCH, CHANGE);
  return store;
}

/** Draws the ids `L-00000001`, `L-00000002`, ... in order. */
export function sequentialRandom(): () => number {
  let digit = 0;
  let calls = 0;
  return () => {
    // newId draws eight digits per id; the last one counts up.
    calls++;
    if (calls % 8 === 0) digit++;
    return calls % 8 === 0 ? digit / 36 + 0.001 : 0;
  };
}

export function logDeps(store: Store, git: Git = fakeGit(), at = AT): LogDeps {
  return {
    store,
    git,
    openIndex: memoryIndex,
    clock: fixedClock(at),
    random: sequentialRandom(),
    pluginRoot: "/plugin",
    settings: settingsRegistry(),
  };
}

export interface RunResult {
  readonly code: number;
  readonly stdout: string;
  readonly json: unknown;
}

/** Runs `bdk <argv>` through the registry; `--json` output is parsed. */
export async function runBdk(
  registrations: readonly Registration[],
  store: Store,
  git: Git,
  argv: readonly string[],
  stdin = "",
): Promise<RunResult> {
  const registry = createRegistry(loadIndex(commands), [...registrations], {
    activeChange: (where) => resolveActiveChange(store, git, where),
  });
  let stdout = "";
  const code = await registry.run({
    argv,
    cwd: ROOT,
    runtime: {
      nodeVersion: "24.21.0",
      env: {},
      platform: "linux",
      home: "/home/dev",
      workTree: () => ROOT,
      which: () => undefined,
      readStdin: () => stdin,
    },
    streams: { stdout: (text) => (stdout += text), stderr: () => undefined },
  });
  let json: unknown;
  if (argv.includes("--json")) json = JSON.parse(stdout);
  return { code, stdout, json };
}

/**
 * What `dispatch build` leaves for `role` on an open ticket of `target`: the
 * package at `dispatch/<target>-<role>-<ticket>.md`, stamped as the ticket's
 * active one (T23-D42).
 */
export function writePackage(
  store: Store,
  ticket: string,
  role: string,
  target = "02-3",
  extra: Readonly<Record<string, unknown>> = {},
): void {
  const path = `.bdk/changes/${CHANGE}/dispatch/${target}-${role}-${ticket}.md`;
  writeDocument(store, `${ROOT}/${path}`, {
    data: {
      schema: 1,
      ticket,
      target,
      role,
      adapter: role === "implementer" || role === "simplifier" ? "worker" : "reader",
      attempt: 1,
      of: 3,
      scope: "full",
      at: "2026-09-25T10:00:01.000Z",
      "kernel-version": "3.0.0-dev",
      "template-hash": `sha256:${"a".repeat(64)}`,
      report: `.bdk/changes/${CHANGE}/reports/${target}-${role}-${ticket}.md`,
      rules: [],
      ...extra,
    },
    body: "",
  });
  stampPackage(store, `${ROOT}/.bdk/changes/${CHANGE}`, ticket, path);
}
