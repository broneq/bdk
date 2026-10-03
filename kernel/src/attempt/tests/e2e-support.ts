// The attempt E2E fixtures through the committed bundle: a tiny Change in a
// real repository with part 01 started, the attempt commands, the dispatch
// package from `dispatch build`, and a report envelope written by hand for
// `attempt close --envelope`.
import { join } from "node:path";
import { expect } from "vitest";

import { answered, bdk, repository } from "../../../tests/support/repo.ts";
import { fileStore, writeDocument } from "../../shared/store/index.ts";

export interface Started {
  readonly root: string;
  readonly dir: string;
  readonly id: string;
}

/** `count` tasks `<nn>-1`.. in the plan task grammar. */
export function tasks(nn: string, count: number): string {
  return Array.from({ length: count }, (_, at) => {
    const k = String(at + 1);
    return `## ${nn}-${k} Task ${k}\n\n**Files:**\n\n- \`src/${nn}-${k}.ts\`\n\n**Test cases:**\n\n- works\n`;
  }).join("\n");
}

/**
 * A tiny Change with part 01 (tasks 01-1, 01-2; do-not-touch `src/billing/**`)
 * started and part 02 after it; `settings` is the project settings file.
 */
export function started(settings = ""): Started {
  const root = repository(settings === "" ? {} : { ".bdk/settings.yaml": settings });
  const result = bdk(
    ["change", "new", "Fix the login typo", "--profile", "tiny", "--reason", "a typo", "--json"],
    root,
  );
  expect(result.code, result.stdout).toBe(0);
  const id = (result.json as { change: string }).change;
  const dir = join(root, ".bdk/changes", id);
  const part = (nn: string, body: string, fields: string) => {
    fileStore().write(
      join(dir, `plan/parts/${nn}-part.md`),
      `---\nschema: 1\nid: "${nn}"\ntitle: Part ${nn}\ngoal: g\nsuccess-measure: m\n${fields}spec-impact: none\n---\n${body}`,
    );
  };
  part("01", tasks("01", 2), 'do-not-touch: ["src/billing/**"]\ndepends-on: []\n');
  part("02", tasks("02", 1), 'do-not-touch: []\ndepends-on: ["01"]\n');
  answered(bdk(["done", "plan", "--json"], root), "output/done.json");
  answered(bdk(["part", "start", "01", "--json"], root), "output/part-start.json");
  return { root, dir, id };
}

export function open(change: Started, loop: string, target: string, ...flags: string[]) {
  return bdk(["attempt", "open", loop, target, ...flags, "--json"], change.root);
}

export function opened(change: Started, loop: string, target: string, ...flags: string[]): string {
  return answered(open(change, loop, target, ...flags), "output/attempt-open.json")
    .ticket as string;
}

export function close(change: Started, ticket: string, outcome: string, ...flags: string[]) {
  return bdk(["attempt", "close", ticket, outcome, ...flags, "--json"], change.root);
}

export function closed(change: Started, ticket: string, outcome: string, ...flags: string[]) {
  return answered(close(change, ticket, outcome, ...flags), "output/attempt-close.json");
}

/** The ticket's package from `dispatch build`, so `log add --ticket` finds the role. */
export function dispatched(
  change: Started,
  ticket: string,
  target: string,
  role = "implementer",
): string {
  const result = bdk(["dispatch", "build", target, role, ticket, "--json"], change.root);
  return answered(result, "output/dispatch-build.json").path as string;
}

export function logUnder(change: Started, ticket: string, summary: string, ref: string): string {
  const result = bdk(
    ["log", "add", "finding", summary, "--ref", ref, "--ticket", ticket, "--json"],
    change.root,
  );
  return (answered(result, "output/log-add.json").entry as { id: string }).id;
}

/** The report envelope declaring `entries`; its path relative to the project root. */
export function envelope(change: Started, ticket: string, entries: string[]): string {
  const file = `reports/01-1-implementer-${ticket}.md`;
  writeDocument(fileStore(), join(change.dir, file), {
    data: {
      schema: 1,
      ticket,
      role: "implementer",
      status: "done",
      files: ["src/01-1.ts"],
      entries,
      evidence: [],
    },
    body: "",
  });
  return `.bdk/changes/${change.id}/${file}`;
}

/** `evidence record <kind>` under `ticket`, citing the result unless `verdict` is not-run. */
export function recorded(change: Started, ticket: string, kind: string, verdict = "pass"): string {
  const file = `.bdk/.machine/${kind}-${ticket}.json`;
  fileStore().write(join(change.root, file), `{"failed":${verdict === "fail" ? "1" : "0"}}\n`);
  const cite = verdict === "not-run" ? [] : ["--cite", "/failed"];
  const result = bdk(
    ["evidence", "record", kind, file, "--ticket", ticket, "--verdict", verdict, ...cite, "--json"],
    change.root,
  );
  return answered(result, "output/evidence-record.json").evidence as string;
}

/**
 * The post-task steps of a code ticket through the kernel (T23-D41): the
 * simplifier's stored report, then the runner's cited `tests-scoped` and
 * `lint` evidence.
 */
export function stepsDone(change: Started, ticket: string, target = "01-1"): void {
  dispatched(change, ticket, target, "simplifier");
  answered(
    bdk(["log", "ingest", "--ticket", ticket, "--json"], change.root, {
      stdin: "---\nstatus: done\nfiles: []\nentries: []\nevidence: []\n---\n# Simplify\n",
    }),
    "output/log-ingest.json",
  );
  dispatched(change, ticket, target, "runner");
  recorded(change, ticket, "tests-scoped");
  recorded(change, ticket, "lint");
}

/** One task through its ticket: the implementer's file, the steps, `attempt close ok` and `commit`. */
function taskDone(change: Started, task: string): void {
  const ticket = opened(change, "task-redispatch", task);
  dispatched(change, ticket, task);
  fileStore().write(join(change.root, `src/${task}.ts`), `export const value = "${task}";\n`);
  stepsDone(change, ticket, task);
  closed(change, ticket, "ok");
  answered(bdk(["commit", task, "--json"], change.root), "output/commit.json");
}

/**
 * The Change of `started` executed: every task of parts 01 and 02 committed
 * and both parts done, so the review stage is next and `attempt open
 * review-fix <change>` opens a round.
 */
export function executed(change: Started): Started {
  for (const task of ["01-1", "01-2"]) taskDone(change, task);
  answered(bdk(["part", "done", "01", "--json"], change.root), "output/part-done.json");
  answered(bdk(["part", "start", "02", "--json"], change.root), "output/part-start.json");
  taskDone(change, "02-1");
  answered(bdk(["part", "done", "02", "--json"], change.root), "output/part-done.json");
  return change;
}
