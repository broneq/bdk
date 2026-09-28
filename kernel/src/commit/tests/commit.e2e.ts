// `kernel-cli/commit` (T22 record) through the committed bundle in real
// repositories: one case per exit code and per declared rule, the output
// validated against `schema/cli/output/commit.json`, the trailers read back
// with `git log`, and a file the user staged left staged.
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
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

function commit(change: Started, task: string, ...flags: string[]) {
  return bdk(["commit", task, ...flags, "--json"], change.root);
}

describe("bdk commit", () => {
  it("exit 0: trailers read back with git log, a user-staged file stays staged", () => {
    const change = tiny();
    write(change, "README.md", "# changed by the user\n");
    git(change.root, "add", "README.md");
    write(change, "src/01-1.ts");
    write(change, "src/util.ts");
    const report = answered(commit(change, "01-1"), "output/commit.json");
    expect(report).toMatchObject({
      task: "01-1",
      trailers: { "BDK-Change": change.id, "BDK-Part": "01", "BDK-Task": "01-1" },
      undeclared: ["src/util.ts"],
    });
    const files = git(change.root, "show", "--name-only", "--format=", "HEAD").trim().split("\n");
    expect(files).toContain("src/01-1.ts");
    expect(files).toContain("src/util.ts");
    expect(files.some((file) => file.startsWith(`.bdk/changes/${change.id}/`))).toBe(true);
    expect(files).not.toContain("README.md");
    expect(
      git(change.root, "log", "-1", "--format=%(trailers:key=BDK-Task,valueonly)").trim(),
    ).toBe("01-1");
    expect(git(change.root, "diff", "--cached", "--name-only").trim()).toBe("README.md");
    expect(String(report.commit)).toBe(git(change.root, "rev-parse", "--short=7", "HEAD").trim());
  });

  it("exit 0: the tiny guard records one finding for the review gate", () => {
    const change = tiny();
    for (const path of ["src/01-1.ts", "src/a.ts", "src/b.ts"]) write(change, path);
    answered(commit(change, "01-1"), "output/commit.json");
    const listed = answered(
      bdk(["log", "list", "--type", "finding", "--review", "--json"], change.root),
      "output/log-list.json",
    );
    expect((listed.items as { summary: string }[]).map((item) => item.summary)).toStrictEqual([
      expect.stringContaining("tiny Change outgrew its profile: files 3") as string,
    ]);
  });

  it("exit 3 input/not-found", () => {
    refused(commit(tiny(), "01-9"), 3, "input/not-found");
  });

  it("exit 2 policy/do-not-touch", () => {
    const change = tiny();
    write(change, "src/01-1.ts");
    write(change, "src/billing/invoice.ts");
    refused(commit(change, "01-1"), 2, "policy/do-not-touch");
  });

  it("exit 2 policy/git-in-progress", () => {
    const change = tiny();
    write(change, "src/01-1.ts");
    mkdirSync(join(change.root, ".git/rebase-merge"));
    refused(commit(change, "01-1"), 2, "policy/git-in-progress");
  });

  it("exit 2 policy/git-hook-failed, HEAD unchanged", () => {
    const change = tiny();
    write(change, "src/01-1.ts");
    const hook = join(change.root, ".git/hooks/pre-commit");
    writeFileSync(hook, "#!/bin/sh\necho 'lint failed: src/01-1.ts'\nexit 1\n");
    chmodSync(hook, 0o755);
    const head = git(change.root, "rev-parse", "HEAD");
    const result = refused(commit(change, "01-1"), 2, "policy/git-hook-failed");
    expect(result.why).toContain("lint failed: src/01-1.ts");
    expect(git(change.root, "rev-parse", "HEAD")).toBe(head);
  });

  it("exit 2 policy/nothing-to-commit", () => {
    const change = tiny();
    write(change, "src/01-1.ts");
    answered(commit(change, "01-1"), "output/commit.json");
    refused(commit(change, "01-1"), 2, "policy/nothing-to-commit");
  });

  it("exit 2 policy/ticket-open", () => {
    const change = tiny();
    write(change, "src/01-1.ts");
    answered(
      bdk(["attempt", "open", "task-redispatch", "01-1", "--json"], change.root),
      "output/attempt-open.json",
    );
    refused(commit(change, "01-1"), 2, "policy/ticket-open");
  });

  it("exit 2 policy/no-active-change", () => {
    refused(bdk(["commit", "01-1", "--json"], repository()), 2, "policy/no-active-change");
  });

  it("exit 4 state/ledger-invalid", () => {
    const change = tiny();
    fileStore().write(
      join(change.dir, "log/20260101T000000Z-finding-L-broken00.md"),
      "---\nschema: 1\n---\n",
    );
    refused(commit(change, "01-1"), 4, "state/ledger-invalid");
  });

  it("exit 5 runtime/git-missing", () => {
    const change = tiny();
    refused(
      bdk(["commit", "01-1", "--json"], change.root, { git: false }),
      5,
      "runtime/git-missing",
    );
  });

  it("exit 5 runtime/not-a-repo", () => {
    refused(bdk(["commit", "01-1", "--json"], outsideRepository()), 5, "runtime/not-a-repo");
  });
});
