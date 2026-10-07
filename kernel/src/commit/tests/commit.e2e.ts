// `kernel-cli/commit` (T22 record, T42, #166) through the built bundle in
// real repositories: the review fix of an open `review-fix` round, one case
// per exit code and per declared rule, the output validated against
// `schema/cli/output/commit.json`, the trailers read back with `git log`, and
// a file the user staged left staged. A task is committed by its part agent
// with the command `bdk check run` prints, never by `bdk commit`.
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  answered,
  bdk,
  bdkAsync,
  git,
  outsideRepository,
  refused,
  repository,
  ingestArgs,
} from "../../../tests/support/repo.ts";
import { executed, opened, started } from "../../attempt/tests/e2e-support.ts";
import { fileStore } from "../../shared/store/index.ts";

interface Started {
  readonly root: string;
  readonly dir: string;
  readonly id: string;
}

/** A tiny Change with part 01 (tasks 01-1, 01-2; do-not-touch `src/billing/**`) started. */
function tiny(): Started {
  const root = repository();
  const result = bdk(
    ["change", "new", "Reject expired links", "--profile", "tiny", "--reason", "r", "--json"],
    root,
  );
  expect(result.code, result.stdout).toBe(0);
  const id = (result.json as { change: string }).change;
  const dir = join(root, ".bdk/changes", id);
  const tasks = ["01-1", "01-2"]
    .map(
      (task) =>
        `## ${task} Task ${task}\n\n**Files:**\n\n- \`src/${task}.ts\`\n\n**Verification:** none\n`,
    )
    .join("\n");
  fileStore().write(
    join(dir, "plan/parts/01-part.md"),
    `---\nschema: 1\nid: "01"\ntitle: Part 01\ngoal: g\nsuccess-measure: m\ndo-not-touch: ["src/billing/**"]\ndepends-on: []\nspec-impact: none\n---\n${tasks}`,
  );
  answered(bdk(["done", "plan", "--json"], root), "output/done.json");
  answered(bdk(["part", "start", "01", "--json"], root), "output/part-start.json");
  return { root, dir, id };
}

function write(change: Started, path: string, text = "export {};\n"): void {
  fileStore().write(join(change.root, path), text);
}

function commit(change: Started, target: string, ...flags: string[]) {
  return bdk(["commit", target, ...flags, "--json"], change.root);
}

/** The Change of `started` executed, with a `review-fix` round open. */
function reviewing(): Started & { readonly ticket: string } {
  const change = executed(started());
  return { ...change, ticket: opened(change, "review-fix", change.id) };
}

describe("bdk commit", () => {
  it("exit 0: a review fix of a tiny Change the guard already flagged adds no second finding", () => {
    const change = reviewing();
    const outgrown = () =>
      (
        answered(
          bdk(["log", "list", "--type", "finding", "--review", "--json"], change.root),
          "output/log-list.json",
        ).items as { summary: string }[]
      ).filter((item) => item.summary.startsWith("tiny Change outgrew its profile"));
    expect(outgrown()).toHaveLength(1);
    for (const path of ["src/a.ts", "src/b.ts"]) write(change, path);
    answered(commit(change, change.id), "output/commit.json");
    expect(outgrown()).toHaveLength(1);
  });

  it("exit 3 input/not-found: another id than the active Change", () => {
    refused(commit(tiny(), "2026-01-01-other"), 3, "input/not-found");
  });

  it("exit 3 input/invalid-argument: a task id names bdk check run with its part's ticket", () => {
    const change = tiny();
    const ticket = answered(
      bdk(["attempt", "open", "part", "01", "--json"], change.root),
      "output/attempt-open.json",
    ).ticket as string;
    write(change, "src/01-1.ts");
    const result = refused(commit(change, "01-1"), 3, "input/invalid-argument");
    expect(result.instead).toStrictEqual([`bdk check run 01-1 --ticket ${ticket}`]);
    expect(git(change.root, "status", "--porcelain", "-uall")).toContain("src/01-1.ts");
  });

  it("exit 2 policy/git-in-progress", () => {
    const change = reviewing();
    write(change, "src/util.ts");
    mkdirSync(join(change.root, ".git/rebase-merge"));
    refused(commit(change, change.id), 2, "policy/git-in-progress");
  });

  it("exit 2 policy/git-hook-failed, HEAD unchanged", () => {
    const change = reviewing();
    write(change, "src/util.ts");
    const hook = join(change.root, ".git/hooks/pre-commit");
    writeFileSync(hook, "#!/bin/sh\necho 'lint failed: src/util.ts'\nexit 1\n");
    chmodSync(hook, 0o755);
    const head = git(change.root, "rev-parse", "HEAD");
    const result = refused(commit(change, change.id), 2, "policy/git-hook-failed");
    expect(result.why).toContain("lint failed: src/util.ts");
    expect(git(change.root, "rev-parse", "HEAD")).toBe(head);
  });

  it("exit 2 policy/nothing-to-commit", () => {
    const change = reviewing();
    write(change, "src/util.ts");
    answered(commit(change, change.id), "output/commit.json");
    refused(commit(change, change.id), 2, "policy/nothing-to-commit");
  });

  it("exit 2 policy/no-active-change", () => {
    refused(bdk(["commit", "2026-01-01-x", "--json"], repository()), 2, "policy/no-active-change");
  });

  it("exit 4 state/ledger-invalid", () => {
    const change = tiny();
    fileStore().write(
      join(change.dir, "log/20260101T000000Z-finding-L-broken00.md"),
      "---\nschema: 1\n---\n",
    );
    refused(commit(change, change.id), 4, "state/ledger-invalid");
  });

  it("exit 5 runtime/git-missing", () => {
    const change = reviewing();
    refused(
      bdk(["commit", change.id, "--json"], change.root, { git: false }),
      5,
      "runtime/git-missing",
    );
  });

  it("exit 5 runtime/not-a-repo", () => {
    refused(
      bdk(["commit", "2026-01-01-x", "--json"], outsideRepository()),
      5,
      "runtime/not-a-repo",
    );
  });
});

describe("bdk commit: serialised commits (T41-D12)", () => {
  it("two commits at the same moment never fail on git's index lock [NFR-TEAM]", async () => {
    const change = reviewing();
    write(change, "src/util.ts");
    const results = await Promise.all(
      [0, 1].map(() => bdkAsync(["commit", change.id, "--json"], change.root)),
    );
    const codes = results.map((result) => result.code).sort();
    expect(codes[0], results.map((result) => result.stdout).join("\n")).toBe(0);
    if (codes[1] !== 0) {
      expect(results.find((result) => result.code !== 0)?.json).toMatchObject({
        rule: "policy/nothing-to-commit",
      });
    }
    expect(git(change.root, "show", "--name-only", "--format=", "HEAD~0")).toBeDefined();
    expect(existsSync(join(change.root, ".bdk/.machine/commit.lock"))).toBe(false);
  });

  it("takes over the lock of a process that no longer exists", () => {
    const change = reviewing();
    write(change, "src/util.ts");
    const dead = spawnSync(process.execPath, ["-e", "0"]).pid;
    const lock = join(change.root, ".bdk/.machine/commit.lock");
    mkdirSync(join(change.root, ".bdk/.machine"), { recursive: true });
    writeFileSync(lock, JSON.stringify({ pid: dead, owner: "other", at: "2026-09-25T10:00:00Z" }));
    answered(commit(change, change.id), "output/commit.json");
    expect(existsSync(lock)).toBe(false);
  });
});

describe("bdk commit <change-id>: a review fix (T42)", () => {
  it("commits under the open review-fix ticket, reports nothing undeclared and rebuilds cleanly", () => {
    const change = executed(started());
    const ticket = opened(change, "review-fix", change.id);
    const findings = () =>
      readdirSync(join(change.dir, "log")).filter((name) => name.includes("-finding-"));
    const before = findings();
    write(change, "src/util.ts", "export const fixed = true;\n");
    write(change, "README.md", "# app, edited by the user\n");
    git(change.root, "add", "README.md");

    const report = answered(commit(change, change.id), "output/commit.json");
    expect(report).toMatchObject({
      ticket,
      trailers: { "BDK-Change": change.id, "BDK-Ticket": ticket },
    });
    expect(report).not.toHaveProperty("undeclared");
    expect(
      git(change.root, "log", "-1", "--format=%(trailers:key=BDK-Ticket,valueonly)").trim(),
    ).toBe(ticket);
    expect(git(change.root, "show", "--name-only", "--format=", "HEAD")).toContain("src/util.ts");
    expect(git(change.root, "diff", "--cached", "--name-only").trim()).toBe("README.md");

    write(change, "src/other.ts");
    // A round closes only after its merged review (T42).
    refused(
      bdk(["attempt", "close", ticket, "fail", "--json"], change.root),
      2,
      "policy/missing-report",
    );
    answered(
      bdk(
        [
          ...ingestArgs(
            change.root,
            `${ticket}@merge`,
            "---\nstatus: done\nfiles: []\nentries: []\nevidence: []\n---\nNo entries.\n",
          ),
          "--json",
        ],
        change.root,
      ),
      "output/log-ingest.json",
    );
    const close = answered(
      bdk(["attempt", "close", ticket, "fail", "--json"], change.root),
      "output/attempt-close.json",
    );
    expect(close).toMatchObject({ diff: { undeclared: [] } });
    expect(findings()).toStrictEqual(before);
    answered(bdk(["rebuild", "--json"], change.root), "output/rebuild.json");
  });

  it("commits a fix under the do-not-touch of a part (#160)", () => {
    const change = executed(started());
    const ticket = opened(change, "review-fix", change.id);
    write(change, "src/billing/invoice.ts", "export const fixed = true;\n");

    const report = answered(commit(change, change.id), "output/commit.json");
    expect(report).toMatchObject({ ticket });
    expect(git(change.root, "show", "--name-only", "--format=", "HEAD")).toContain(
      "src/billing/invoice.ts",
    );

    write(change, "src/billing/tax.ts");
    answered(
      bdk(
        [
          ...ingestArgs(
            change.root,
            `${ticket}@merge`,
            "---\nstatus: done\nfiles: []\nentries: []\nevidence: []\n---\nNo entries.\n",
          ),
          "--json",
        ],
        change.root,
      ),
      "output/log-ingest.json",
    );
    answered(
      bdk(["attempt", "close", ticket, "fail", "--json"], change.root),
      "output/attempt-close.json",
    );
  });

  it("refuses policy/no-open-ticket without an open review-fix ticket", () => {
    const change = executed(started());
    write(change, "src/util.ts");
    refused(commit(change, change.id), 2, "policy/no-open-ticket");
    expect(git(change.root, "status", "--porcelain")).toContain("src/util.ts");
  });
});
