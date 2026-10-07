// The attempt E2E fixtures through the built bundle: a tiny Change in a
// real repository with part 01 started, the attempt commands, the dispatch
// package from `dispatch build`, a report envelope written by hand for
// `attempt close --envelope`, and a part delivered as its agent delivers it:
// each task checked and committed with the command `bdk check run` prints.
import { join } from "node:path";
import { expect } from "vitest";

import { answered, bdk, ingestArgs, repository, shell } from "../../../tests/support/repo.ts";
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
 * Both tool groups configured, so the post-task steps and the full checks
 * apply (T49); the fixture's global layer declares them none. Their commands
 * pass, so `bdk check run` records `pass`.
 */
const PROJECT_TOOLS =
  "tools:\n" +
  '  test:\n    - { id: unit, tier: fast, command: "true" }\n' +
  '  lint:\n    - { id: eslint, tier: lint, command: "true" }\n';

/**
 * A tiny Change with part 01 (tasks 01-1, 01-2; do-not-touch `src/billing/**`)
 * started and part 02 after it; `settings` is the project settings file,
 * starting with PROJECT_TOOLS unless it sets `tools` itself. With `parallel`,
 * part 02 depends on nothing and is started too, as two part agents of one
 * wave run.
 */
export function started(settings = "", { parallel = false } = {}): Started {
  const project = /^tools:/m.test(settings) ? settings : `${PROJECT_TOOLS}${settings}`;
  const root = repository({ ".bdk/settings.yaml": project });
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
  part("02", tasks("02", 1), `do-not-touch: []\ndepends-on: [${parallel ? "" : '"01"'}]\n`);
  answered(bdk(["done", "plan", "--json"], root), "output/done.json");
  for (const nn of parallel ? ["01", "02"] : ["01"]) {
    answered(bdk(["part", "start", nn, "--json"], root), "output/part-start.json");
  }
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
  const file = `reports/01-implementer-${ticket}.md`;
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
  const file = `.bdk/.machine/checks/${ticket.replace(/@.*$/, "")}/${kind}.json`;
  fileStore().write(join(change.root, file), `{"failed":${verdict === "fail" ? "1" : "0"}}\n`);
  const cite = verdict === "not-run" ? [] : ["--cite", "/failed"];
  const result = bdk(
    ["evidence", "record", kind, file, "--ticket", ticket, "--verdict", verdict, ...cite, "--json"],
    change.root,
  );
  return answered(result, "output/evidence-record.json").evidence as string;
}

/** The conformer's package and its stored report under `ticket`. */
export function conformed(change: Started, ticket: string, target = "01"): void {
  dispatched(change, ticket, target, "conformer");
  answered(
    bdk(
      [
        ...ingestArgs(
          change.root,
          ticket,
          "---\nstatus: done\nfiles: []\nentries: []\nevidence: []\n---\n## Conformance\n\n- none apply\n",
        ),
        "--json",
      ],
      change.root,
    ),
    "output/log-ingest.json",
  );
}

/**
 * The post-task steps of a part ticket through the kernel (#166): the
 * conformer's stored report, then cited `tests-scoped` and `lint` evidence.
 */
export function stepsDone(change: Started, ticket: string, target = "01"): void {
  conformed(change, ticket, target);
  recorded(change, ticket, "tests-scoped");
  recorded(change, ticket, "lint");
}

/** `bdk check run <target> --ticket`, then the commit command it printed, when it printed one. */
export function checkedIn(change: Started, ticket: string, target: string): void {
  const report = answered(
    bdk(["check", "run", target, "--ticket", ticket, "--json"], change.root),
    "output/check-run.json",
  ) as { verdict: string; commit?: { command: string } };
  expect(report.verdict, JSON.stringify(report)).not.toBe("fail");
  if (report.commit !== undefined) shell(change.root, report.commit.command);
}

/** Each task of `part` written and committed under `ticket`, as the part's implementer does. */
export function tasksCommitted(change: Started, ticket: string, part: string): void {
  for (const task of part === "01" ? ["01-1", "01-2"] : [`${part}-1`]) {
    fileStore().write(join(change.root, `src/${task}.ts`), `export const value = "${task}";\n`);
    checkedIn(change, ticket, task);
  }
}

/** One part through its ticket: the implementer's commits, the conformer, the part's checks, `attempt close ok`. */
function partDone(change: Started, part: string): void {
  const ticket = opened(change, "part", part);
  dispatched(change, ticket, part);
  answered(
    bdk(["rules", "show", "--ticket", ticket, "--json"], change.root),
    "output/rules-show.json",
  );
  tasksCommitted(change, ticket, part);
  conformed(change, ticket, part);
  checkedIn(change, ticket, part);
  closed(change, ticket, "ok");
}

/**
 * The Change of `started` executed: every task of parts 01 and 02 committed
 * and both parts done, so the review stage is next and `attempt open
 * review-fix <change>` opens a round.
 */
export function executed(change: Started): Started {
  partDone(change, "01");
  answered(bdk(["part", "done", "01", "--json"], change.root), "output/part-done.json");
  answered(bdk(["part", "start", "02", "--json"], change.root), "output/part-start.json");
  partDone(change, "02");
  answered(bdk(["part", "done", "02", "--json"], change.root), "output/part-done.json");
  return change;
}
