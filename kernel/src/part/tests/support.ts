// The part tests' repository in memory: the graph harness's Change and
// plugin files, driven through the part, graph, change and log commands, with
// a git whose trailer commits, working-tree status and diff numbers a test sets.
import { changeRegistrations } from "../../change/index.ts";
import { graphRegistrations } from "../../graph/index.ts";
import { withPluginFiles } from "../../graph/tests/support.ts";
import { logRegistrations } from "../../log/index.ts";
import {
  AUTHOR,
  DIR,
  fakeGit,
  repository,
  runBdk,
  sequentialRandom,
  withTools,
} from "../../log/tests/support.ts";
import type { FakeGit, RunResult } from "../../log/tests/support.ts";
import type { Registration } from "../../shared/registry/index.ts";
import { settingsRegistry } from "../../registrations.ts";
import { fixedClock } from "../../shared/clock/index.ts";
import { memoryIndex, writeDocument } from "../../shared/store/index.ts";
import type { Store } from "../../shared/store/index.ts";
import { partRegistrations } from "../index.ts";
import type { PartDeps } from "../index.ts";

export { DIR };
const PLUGIN = "/plugins/bdk";

interface ScriptedGit extends FakeGit {
  /** Trailer commits, newest first: hash, part, task (either may be empty), and a BDK-Ticket. */
  commits: (readonly [string, string, string, string?])[];
  /**
   * Changed paths `git status` reports, relative to the work tree: untracked
   * unless the entry starts with its two status letters and a space (`M  a.ts`).
   */
  status: string[];
  /** The `git diff --numstat -z` output the tiny guard measures. */
  numstat: string;
  /** The argv of every `git commit` run. */
  committed: string[][];
  /** What `git commit` answers; a non-zero code is a rejecting hook. */
  commitResult: { code: number; stdout: string; stderr: string };
}

function scriptedGit(): ScriptedGit {
  const base = fakeGit();
  const git: ScriptedGit = {
    ...base,
    commits: [],
    status: [],
    numstat: "",
    committed: [],
    commitResult: { code: 0, stdout: "", stderr: "" },
    currentBranch: () => git.branch,
    run(args, cwd) {
      const ok = (stdout: string) => Promise.resolve({ code: 0, stdout, stderr: "" });
      if (args[0] === "log") {
        return ok(
          git.commits
            .map(
              ([hash, part, task, ticket = ""]) =>
                `${hash}\x1fp0\x1fTask ${task}\x1f2026-09-25-login\x1f${part}\x1f${task}\x1f${ticket}\x1e`,
            )
            .join(""),
        );
      }
      if (args[0] === "status") {
        const pathspecs = args.slice(args.indexOf("--") + 1);
        return ok(
          git.status
            .map((entry) => (/^[ MADRCU?]{2} /.test(entry) ? entry : `?? ${entry}`))
            .filter(
              (entry) =>
                pathspecs.length === 0 || pathspecs.some((spec) => entry.slice(3).startsWith(spec)),
            )
            .map((entry) => `${entry}\0`)
            .join(""),
        );
      }
      if (args[0] === "rev-parse")
        return ok(args[1] === "HEAD" ? "d8e4f21c0ffee000000000000000000000000000\n" : "");
      if (args[0] === "diff") return ok(git.numstat);
      if (args[0] === "commit") {
        git.committed.push([...args]);
        return Promise.resolve(git.commitResult);
      }
      return base.run(args, cwd);
    },
  };
  return git;
}

export interface Harness {
  readonly store: Store;
  readonly git: ScriptedGit;
  /** Runs `bdk <argv>` with the clock at `at` and `stdin` as the body. */
  run(argv: readonly string[], at?: string, stdin?: string): Promise<RunResult>;
}

/** `extra` adds the registrations of a slice built on this one (attempt, commit). */
export function harness(extra: (deps: PartDeps) => Registration[] = () => []): Harness {
  const store = withTools(withPluginFiles(repository()));
  const git = scriptedGit();
  const random = sequentialRandom();
  return {
    store,
    git,
    run: (argv, at = "2026-09-25T10:00:00.000Z", stdin = "") => {
      const deps: PartDeps = {
        store,
        git,
        openIndex: memoryIndex,
        clock: fixedClock(at),
        random,
        pluginRoot: PLUGIN,
        settings: settingsRegistry(),
      };
      return runBdk(
        [
          ...extra(deps),
          ...partRegistrations(deps),
          ...graphRegistrations(deps),
          ...changeRegistrations(deps),
          ...logRegistrations(deps),
        ],
        store,
        git,
        argv,
        stdin,
      );
    },
  };
}

/** An open attempt record of `target` in `loop`. */
export function openTicket(
  store: Store,
  ticket: string,
  target: string,
  loop = "task-redispatch",
): void {
  writeDocument(store, `${DIR}/attempts/${loop}-${target}-${ticket}.md`, {
    data: {
      schema: 1,
      ticket,
      loop,
      target,
      attempt: 1,
      of: 3,
      scope: "full",
      "opened-at": "2026-09-25T10:00:00.000Z",
      author: AUTHOR,
    },
    body: "",
  });
}

/** `count` tasks `<nn>-1`.. in the plan task grammar, each declaring `src/<nn>-<k>.ts`. */
export function tasks(nn: string, count: number): string {
  return Array.from({ length: count }, (_, at) => {
    const k = String(at + 1);
    return `## ${nn}-${k} Task ${k}\n\n**Files:**\n\n- \`src/${nn}-${k}.ts\`\n\n**Test cases:**\n\n- works\n`;
  }).join("\n");
}
