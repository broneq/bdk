// Spec E2E fixtures through the built bundle: a `tiny` Change walked to
// a passed `gate:review` (one task committed with its trailers, its post-task
// steps, the spec deltas done, one clean review round, the user's gate
// transition), so `spec merge` and `change close` run as a user runs them.
import { join } from "node:path";
import { expect } from "vitest";

import { answered, bdk, git, repository, ingestArgs } from "../../../tests/support/repo.ts";
import {
  closed,
  dispatched,
  opened,
  recorded,
  stepsDone,
} from "../../attempt/tests/e2e-support.ts";
import { passGate } from "../../graph/tests/e2e-support.ts";
import { fileStore, secondStamp, writeDocument } from "../../shared/store/index.ts";
import { parseDelta } from "../domain/grammar.ts";
import { renderLiving } from "../use-cases/living.ts";

export interface Reviewed {
  readonly root: string;
  readonly dir: string;
  readonly id: string;
}

export const PURPOSE = "Signing in without a password, through a link sent by e-mail.";

export function block(
  name: string,
  scenarios: readonly string[],
  statement = "SHALL work",
): string {
  return [
    `### Requirement: ${name}`,
    "",
    `The system ${statement} for ${name.toLowerCase()}.`,
    "",
    ...scenarios.flatMap((scenario) => [
      `#### Scenario: ${scenario}`,
      "",
      `- **WHEN** ${scenario} happens`,
      "- **THEN** it is handled",
      "",
    ]),
  ].join("\n");
}

/** A delta creating a capability with `requirements` as [name, scenarios]. */
export function creating(...requirements: (readonly [string, readonly string[]])[]): string {
  return `## Purpose\n\n${PURPOSE}\n\n## ADDED Requirements\n\n${requirements
    .map(([name, scenarios]) => block(name, scenarios))
    .join("\n")}`;
}

export function writeDelta(change: Reviewed, capability: string, text: string): void {
  fileStore().write(join(change.dir, "spec-delta", `${capability}.md`), text);
}

export interface Options {
  /** Capability -> delta text; part 01's `spec-impact` lists the capabilities. */
  readonly deltas?: Readonly<Record<string, string>>;
  /** The project settings file. */
  readonly settings?: string;
  /** Capability -> requirement blocks of a living spec written before the Change. */
  readonly living?: Readonly<Record<string, string>>;
}

/** A tiny Change with its deltas and part 01 planned and started. */
export function planned({ deltas = {}, settings = "", living = {} }: Options = {}): Reviewed {
  const root = repository(settings === "" ? {} : { ".bdk/settings.yaml": settings });
  for (const [capability, blocks] of Object.entries(living)) writeLiving(root, capability, blocks);
  const result = bdk(
    [
      "change",
      "new",
      "Users log in with a link",
      "--profile",
      "tiny",
      "--reason",
      "small",
      "--json",
    ],
    root,
  );
  expect(result.code, result.stdout).toBe(0);
  const id = (result.json as { change: string }).change;
  const dir = join(root, ".bdk/changes", id);
  const change = { root, dir, id };
  for (const [capability, text] of Object.entries(deltas)) writeDelta(change, capability, text);
  const capabilities = Object.keys(deltas);
  const impact = capabilities.length === 0 ? "none" : JSON.stringify(capabilities);
  fileStore().write(
    join(dir, "plan/parts/01-part.md"),
    '---\nschema: 1\nid: "01"\ntitle: Part 01\ngoal: g\nsuccess-measure: m\ndo-not-touch: []\ndepends-on: []\n' +
      `spec-impact: ${impact}\n---\n` +
      "## 01-1 Task 1\n\n**Files:**\n\n- `src/01-1.ts`\n\n**Test cases:**\n\n- works\n",
  );
  answered(bdk(["done", "plan", "--json"], root), "output/done.json");
  answered(bdk(["part", "start", "01", "--json"], root), "output/part-start.json");
  return change;
}

/** Part 01 executed and done: the task committed with its trailers, its steps recorded. */
export function executed(options: Options = {}): Reviewed {
  const change = planned(options);
  const ticket = opened(change, "part", "01");
  dispatched(change, ticket, "01");
  answered(
    bdk(["rules", "show", "--ticket", ticket, "--json"], change.root),
    "output/rules-show.json",
  );
  fileStore().write(join(change.root, "src/01-1.ts"), "export const one = 1;\n");
  git(change.root, "add", "src/01-1.ts");
  git(
    change.root,
    "commit",
    "--quiet",
    "-m",
    `Task 01-1\n\nBDK-Change: ${change.id}\nBDK-Part: 01\nBDK-Task: 01-1`,
  );
  stepsDone(change, ticket);
  closed(change, ticket, "ok");
  answered(bdk(["part", "done", "01", "--json"], change.root), "output/part-done.json");
  return change;
}

/** Part 01 done, the deltas done, a passing review verdict, `gate:review` passed by the user. */
export function reviewed(options: Options = {}): Reviewed {
  const change = executed(options);
  if (Object.keys(options.deltas ?? {}).length > 0) {
    answered(bdk(["done", "spec-delta", "--json"], change.root), "output/done.json");
  }
  reviewVerdict(change);
  answered(bdk(["done", "review", "--json"], change.root), "output/done.json");
  passGate(change.dir, "gate:review", "close");
  return change;
}

/**
 * One clean `review-fix` round through the kernel (T42): the gate runner's
 * `tests-full` and `lint-full` on the round's `gate` group, the merged report
 * under `merge` and its `report` entry, then the round closed.
 */
function reviewVerdict(change: Reviewed): void {
  const round = opened(change, "review-fix", change.id);
  answered(
    bdk(
      ["dispatch", "build", change.id, "runner", round, "--group", "gate", "--json"],
      change.root,
    ),
    "output/dispatch-build.json",
  );
  recorded(change, `${round}@gate`, "tests-full");
  recorded(change, `${round}@gate`, "lint-full");
  answered(
    bdk(
      [
        ...ingestArgs(
          change.root,
          `${round}@merge`,
          "---\nstatus: done\nfiles: []\nentries: []\nevidence: []\n---\n# Review\n\nPASS\n",
        ),
        "--json",
      ],
      change.root,
    ),
    "output/log-ingest.json",
  );
  answered(
    bdk(
      ["log", "add", "report", "review passed", "--ticket", `${round}@merge`, "--json"],
      change.root,
    ),
    "output/log-add.json",
  );
  closed(change, round, "ok");
}

/** A living spec as a merge by `change` writes it, from blocks of an ADDED-only delta. */
export function writeLiving(
  root: string,
  capability: string,
  blocks: string,
  change = "2026-09-01-first-login",
): void {
  const requirements = parseDelta(`## ADDED Requirements\n\n${blocks}`).added;
  fileStore().write(
    join(root, ".bdk/specs", capability, "spec.md"),
    renderLiving(capability, { purpose: PURPOSE, requirements }, change).text,
  );
}

/** An archived Change `id` with its deltas, closed by a `close` transition at `closed`. */
export function archived(
  root: string,
  id: string,
  closed: string,
  deltas: Readonly<Record<string, string>>,
): void {
  const dir = join(root, ".bdk/changes/archive", id);
  const author = "BDK Test <test@example.com>";
  writeDocument(fileStore(), join(dir, "change.md"), {
    data: {
      schema: 1,
      id,
      kind: "feature",
      profile: "tiny",
      intent: "Links expire.",
      source: "user",
      at: "2026-01-01T09:00:00.000Z",
      author,
      overridden: [],
    },
    body: "",
  });
  for (const [capability, text] of Object.entries(deltas)) {
    fileStore().write(join(dir, "spec-delta", `${capability}.md`), text);
  }
  const entry = "L-close001";
  writeDocument(fileStore(), join(dir, `log/${secondStamp(closed)}-transition-${entry}.md`), {
    data: {
      schema: 1,
      id: entry,
      type: "transition",
      summary: "close done",
      status: "accepted",
      source: "kernel",
      author,
      at: closed,
      refs: ["close"],
      to: "close",
    },
    body: "",
  });
}
