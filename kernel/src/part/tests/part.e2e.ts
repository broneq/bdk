// `kernel-cli/part` (T22 records) through the committed bundle in real
// repositories: one case per exit code and per declared rule of `part list`,
// `start`, `done` and `split`, every output validated against its schema.
// Progress comes from real commits carrying the BDK trailers.
import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  answered,
  bdk,
  git,
  outsideRepository,
  refused,
  repository,
} from "../../../tests/support/repo.ts";
import { fileStore, writeDocument } from "../../shared/store/index.ts";

interface Opened {
  readonly root: string;
  readonly dir: string;
  readonly id: string;
}

/** A repository with an open `tiny` Change, whose graph goes straight from intent to plan. */
function opened(): Opened {
  const root = repository();
  const result = bdk(
    ["change", "new", "Fix the login typo", "--profile", "tiny", "--reason", "a typo", "--json"],
    root,
  );
  expect(result.code, result.stdout).toBe(0);
  const id = (result.json as { change: string }).change;
  return { root, dir: join(root, ".bdk/changes", id), id };
}

function write(dir: string, path: string, text: string): void {
  fileStore().write(join(dir, path), text);
}

/** `count` tasks `<nn>-1`.. in the plan task grammar. */
function tasks(nn: string, count: number, testCase = "works"): string {
  return Array.from({ length: count }, (_, at) => {
    const k = String(at + 1);
    return `## ${nn}-${k} Task ${k}\n\n**Files:**\n\n- \`src/${nn}-${k}.ts\`\n\n**Test cases:**\n\n- ${testCase}\n`;
  }).join("\n");
}

function writePlanPart(
  dir: string,
  nn: string,
  fields: { body?: string; doNotTouch?: string; dependsOn?: string } = {},
): void {
  write(
    dir,
    `plan/parts/${nn}-part.md`,
    `---\nschema: 1\nid: "${nn}"\ntitle: Part ${nn}\ngoal: g\nsuccess-measure: m\n` +
      `do-not-touch: [${fields.doNotTouch ?? ""}]\ndepends-on: [${fields.dependsOn ?? ""}]\n` +
      `spec-impact: none\n---\n${fields.body ?? tasks(nn, 2)}`,
  );
}

/** Part 01 (two tasks) and part 02 (after 01), plan done. */
function planned(): Opened {
  const change = opened();
  writePlanPart(change.dir, "01");
  writePlanPart(change.dir, "02", { body: tasks("02", 1), dependsOn: '"01"' });
  answered(bdk(["done", "plan", "--json"], change.root), "output/done.json");
  return change;
}

/** A task commit with the three trailers, the way `bdk commit` writes it. */
function commitTask(change: Opened, part: string, task: string): void {
  git(
    change.root,
    "commit",
    "--quiet",
    "--allow-empty",
    "-m",
    `Task ${task}\n\nBDK-Change: ${change.id}\nBDK-Part: ${part}\nBDK-Task: ${task}`,
  );
}

function start(change: Opened, part: string): Record<string, unknown> {
  return answered(bdk(["part", "start", part, "--json"], change.root), "output/part-start.json");
}

function openTicket(dir: string, ticket: string, target: string): void {
  writeDocument(fileStore(), join(dir, `attempts/task-redispatch-${target}-${ticket}.md`), {
    data: {
      schema: 1,
      ticket,
      loop: "task-redispatch",
      target,
      attempt: 1,
      of: 3,
      scope: "full",
      "opened-at": "2026-09-25T10:00:00.000Z",
      author: "BDK Test <test@example.com>",
    },
    body: "",
  });
}

describe("bdk part list", () => {
  it("exit 0: states, counts from trailers, waves", () => {
    const change = planned();
    start(change, "01");
    commitTask(change, "01", "01-1");
    const report = answered(bdk(["part", "list", "--json"], change.root), "output/part-list.json");
    expect(report.items).toMatchObject([
      { part: "01", state: "started", tasks: 2, done: 1, wave: 1 },
      { part: "02", state: "blocked", tasks: 1, done: 0, dependsOn: ["01"], wave: 2 },
    ]);
    const text = bdk(["part", "list"], change.root);
    expect(text.code).toBe(0);
    expect(text.stdout).toContain("01 started: Part 01 (1/2 tasks");
  });

  it("exit 0: an oversized part is listed with its bytes", () => {
    const { root, dir } = opened();
    writePlanPart(dir, "03", { body: `${tasks("03", 1)}\n${"x".repeat(9216)}\n` });
    const report = answered(bdk(["part", "list", "--json"], root), "output/part-list.json");
    expect((report.items as { bytes: number }[])[0]?.bytes).toBeGreaterThan(9216);
  });

  it("exit 2 policy/no-active-change", () => {
    refused(bdk(["part", "list", "--json"], repository()), 2, "policy/no-active-change");
  });

  it("exit 4 state/change-dir-missing", () => {
    const { root, dir } = opened();
    rmSync(dir, { recursive: true });
    refused(bdk(["part", "list", "--json"], root), 4, "state/change-dir-missing");
  });

  it("exit 5 runtime/not-a-repo", () => {
    refused(bdk(["part", "list", "--json"], outsideRepository()), 5, "runtime/not-a-repo");
  });
});

describe("bdk part start", () => {
  it("exit 0: the start marker, the tasks and the stage execute", () => {
    const change = planned();
    const report = start(change, "01");
    expect(report).toMatchObject({
      part: "01",
      state: "started",
      tasks: [
        { task: "01-1", files: ["src/01-1.ts"] },
        { task: "01-2", files: ["src/01-2.ts"] },
      ],
      doNotTouch: [],
      successMeasure: "m",
    });
    const status = answered(
      bdk(["change", "status", "--json"], change.root),
      "output/change-status.json",
    );
    expect(status.stage).toBe("execute");
    expect(
      answered(bdk(["explain", "execute-part:01", "--json"], change.root), "output/explain.json"),
    ).toMatchObject({ state: "ready" });
  });

  it("exit 3 input/not-found", () => {
    const { root } = planned();
    refused(bdk(["part", "start", "07", "--json"], root), 3, "input/not-found");
  });

  it("exit 2 policy/not-ready", () => {
    const { root } = planned();
    refused(bdk(["part", "start", "02", "--json"], root), 2, "policy/not-ready");
  });

  it("exit 2 policy/invalid-transition", () => {
    const change = planned();
    start(change, "01");
    refused(bdk(["part", "start", "01", "--json"], change.root), 2, "policy/invalid-transition");
  });

  it.each([
    ["policy/part-too-large", { body: `${tasks("01", 1)}\n${"x".repeat(9216)}\n` }],
    ["policy/part-too-many-tasks", { body: tasks("01", 9) }],
    ["policy/do-not-touch-overlap", { doNotTouch: '"src/**"' }],
    ["policy/placeholder", { body: tasks("01", 1, "TODO") }],
    ["policy/validation-failed", { body: "## 01-1 Task\n\n**Files:**\n\n- `src/a.ts`\n" }],
  ])("exit 2 %s", (rule, fields) => {
    const { root, dir } = opened();
    writePlanPart(dir, "01", fields);
    const before = readdirSync(join(dir, "log"));
    refused(bdk(["part", "start", "01", "--json"], root), 2, rule);
    expect(readdirSync(join(dir, "log"))).toStrictEqual(before);
  });

  it("exit 4 state/ledger-invalid", () => {
    const { root, dir } = planned();
    write(dir, "log/20260101T000000Z-finding-L-broken00.md", "---\nschema: 1\n---\n");
    refused(bdk(["part", "start", "01", "--json"], root), 4, "state/ledger-invalid");
  });
});

describe("bdk part done", () => {
  it("exit 0: every task committed, the done marker, next", () => {
    const change = planned();
    start(change, "01");
    commitTask(change, "01", "01-1");
    commitTask(change, "01", "01-2");
    const report = answered(
      bdk(["part", "done", "01", "--json"], change.root),
      "output/part-done.json",
    );
    expect(report).toMatchObject({
      part: "01",
      state: "done",
      openFindings: [],
      next: "execute-part:02",
    });
    expect((report.commits as { task: string }[]).map((commit) => commit.task)).toStrictEqual([
      "01-1",
      "01-2",
    ]);
    const list = answered(bdk(["part", "list", "--json"], change.root), "output/part-list.json");
    expect(list.items).toMatchObject([{ state: "done", done: 2 }, { state: "ready" }]);
  });

  it("exit 3 input/not-found", () => {
    const { root } = planned();
    refused(bdk(["part", "done", "07", "--json"], root), 3, "input/not-found");
  });

  it("exit 2 policy/invalid-transition: not started", () => {
    const { root } = planned();
    refused(bdk(["part", "done", "01", "--json"], root), 2, "policy/invalid-transition");
  });

  it("exit 2 policy/ticket-open", () => {
    const change = planned();
    start(change, "01");
    commitTask(change, "01", "01-1");
    commitTask(change, "01", "01-2");
    openTicket(change.dir, "A-7h3k9m2p", "01-2");
    refused(bdk(["part", "done", "01", "--json"], change.root), 2, "policy/ticket-open");
  });

  it("exit 2 policy/validation-failed: a task without a trailer commit", () => {
    const change = planned();
    start(change, "01");
    commitTask(change, "01", "01-1");
    const result = refused(
      bdk(["part", "done", "01", "--json"], change.root),
      2,
      "policy/validation-failed",
    );
    expect(result.why).toContain("01-2");
  });

  it("exit 4 state/trailer-mismatch", () => {
    const change = planned();
    start(change, "01");
    commitTask(change, "02", "01-1");
    const result = refused(
      bdk(["part", "done", "01", "--json"], change.root),
      4,
      "state/trailer-mismatch",
    );
    expect(result.why).toContain("plan/parts/01-part.md holds 01-1");
  });

  it("exit 5 runtime/git-missing", () => {
    const change = planned();
    refused(
      bdk(["part", "done", "01", "--json"], change.root, { git: false }),
      5,
      "runtime/git-missing",
    );
  });
});

describe("bdk part split", () => {
  it("exit 0: a new part with the moved tasks", () => {
    const change = planned();
    const report = answered(
      bdk(["part", "split", "01", "01-2", "--json"], change.root),
      "output/part-split.json",
    );
    expect(report).toMatchObject({ part: "01", newPart: "03", moved: ["01-2"] });
    expect(readdirSync(join(change.dir, "plan/parts"))).toContain("03-task-2.md");
    const list = answered(bdk(["part", "list", "--json"], change.root), "output/part-list.json");
    expect(list.items).toMatchObject([
      { part: "01", tasks: 1 },
      { part: "02", dependsOn: ["01", "03"] },
      { part: "03", tasks: 1, title: "Part 01 (split from 01)" },
    ]);
  });

  it("exit 3 input/not-found", () => {
    const { root } = planned();
    refused(bdk(["part", "split", "07", "07-1", "--json"], root), 3, "input/not-found");
  });

  it("exit 3 input/invalid-argument: every task would move", () => {
    const { root } = planned();
    refused(bdk(["part", "split", "01", "01-1,01-2", "--json"], root), 3, "input/invalid-argument");
  });

  it("exit 2 policy/invalid-transition: a committed task", () => {
    const change = planned();
    commitTask(change, "01", "01-2");
    refused(
      bdk(["part", "split", "01", "01-2", "--json"], change.root),
      2,
      "policy/invalid-transition",
    );
  });

  it("exit 2 policy/ticket-open", () => {
    const change = planned();
    openTicket(change.dir, "A-7h3k9m2p", "01-2");
    refused(bdk(["part", "split", "01", "01-2", "--json"], change.root), 2, "policy/ticket-open");
  });
});
