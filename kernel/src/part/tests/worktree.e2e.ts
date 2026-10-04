// Part worktrees through the built bundle in real repositories (`kernel-cli/
// part`, bdk part start and bdk part done; `kernel-state`, Part worktree;
// T45): the kernel creates the worktree from the home `HEAD`, sets it up,
// merges the part back with a merge commit and removes it.
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { answered, bdk, git, refused, repository } from "../../../tests/support/repo.ts";
import { fileStore } from "../../shared/store/index.ts";

export interface Opened {
  readonly root: string;
  readonly dir: string;
  readonly id: string;
}

export function write(root: string, path: string, text: string): void {
  mkdirSync(join(root, path, ".."), { recursive: true });
  writeFileSync(join(root, path), text);
}

/** A `tiny` Change with part 01 (`isolation` as given) holding `count` tasks, plan done. */
export function planned(
  options: {
    isolation?: string;
    reason?: string;
    tasks?: number;
    settings?: string;
    doNotTouch?: string;
  } = {},
): Opened {
  const root = realpathSync(repository({ "src/keep.ts": "keep\n" }));
  if (options.settings !== undefined) write(root, ".bdk/settings.yaml", options.settings);
  const created = bdk(
    ["change", "new", "Two parts", "--profile", "tiny", "--reason", "a test", "--json"],
    root,
  );
  expect(created.code, created.stdout).toBe(0);
  const id = (created.json as { change: string }).change;
  const dir = join(root, ".bdk/changes", id);
  const count = options.tasks ?? 2;
  const body = Array.from({ length: count }, (_, at) => {
    const k = String(at + 1);
    return `## 01-${k} Task ${k}\n\n**Files:**\n\n- \`src/01-${k}.ts\`\n\n**Test cases:**\n\n- works\n`;
  }).join("\n");
  const isolation =
    options.isolation === undefined
      ? ""
      : `isolation: ${options.isolation}\nisolation-reason: ${options.reason ?? "both parts regenerate the lockfile"}\n`;
  fileStore().write(
    join(dir, "plan/parts/01-part.md"),
    `---\nschema: 1\nid: "01"\ntitle: Part 01\ngoal: g\nsuccess-measure: m\n` +
      `do-not-touch: [${options.doNotTouch === undefined ? "" : `"${options.doNotTouch}"`}]\ndepends-on: []\nspec-impact: none\n${isolation}---\n${body}`,
  );
  answered(bdk(["done", "plan", "--json"], root), "output/done.json");
  // The kernel's .gitignore edit and the Change directory are committed, as a checkpoint would.
  git(root, "add", "--all");
  git(root, "commit", "--quiet", "-m", "plan");
  return { root, dir, id };
}

export function workdirOf(change: Opened, part = "01"): string {
  return join(change.root, ".bdk/.machine/worktrees", change.id, part);
}

function startMarker(change: Opened): string {
  const log = join(change.dir, "log");
  const files = readdirNames(log);
  const marker = files
    .map((name) => readFileSync(join(log, name), "utf8"))
    .find((text) => text.includes("summary: part 01 started"));
  return marker ?? "";
}

function readdirNames(dir: string): string[] {
  return fileStore()
    .list(dir)
    .filter((name) => !name.endsWith("/"));
}

describe("bdk part start of a worktree part", () => {
  it("exit 0: the worktree from home HEAD with its branch, marker, include copy and setup", () => {
    const change = planned({
      isolation: "worktree",
      settings:
        'execution:\n  worktree:\n    setup:\n      command: "mkdir -p node_modules && echo installed"\n',
    });
    write(change.root, ".worktreeinclude", ".env\nsecret.txt\n");
    write(change.root, ".env", "TOKEN=1\n");
    write(change.root, "secret.txt", "tracked secret\n");
    git(change.root, "add", "secret.txt");
    git(change.root, "commit", "--quiet", "-m", "tracked file named in .worktreeinclude");
    fileStore().write(
      join(change.root, ".gitignore"),
      `${readFileSync(join(change.root, ".gitignore"), "utf8")}.env\n`,
    );
    const report = answered(
      bdk(["part", "start", "01", "--json"], change.root),
      "output/part-start.json",
    );
    const workdir = workdirOf(change);
    expect(report).toMatchObject({
      isolation: "worktree",
      workdir,
      setup: { command: "mkdir -p node_modules && echo installed", exitCode: 0 },
    });
    expect(git(workdir, "rev-parse", "HEAD")).toBe(git(change.root, "rev-parse", "HEAD"));
    expect(git(workdir, "branch", "--show-current").trim()).toBe(`bdk-part/${change.id}/01`);
    const gitDir = git(workdir, "rev-parse", "--absolute-git-dir").trim();
    expect(readFileSync(join(gitDir, "bdk-home"), "utf8")).toBe(`${change.root}\n${change.id}\n`);
    expect(readFileSync(join(workdir, ".env"), "utf8")).toBe("TOKEN=1\n");
    expect(existsSync(join(workdir, "node_modules"))).toBe(true);
    expect(git(change.root, "status", "--porcelain")).not.toContain(".machine");
    const marker = startMarker(change);
    expect(marker).toContain(`workdir: ${workdir}`);
    expect(marker).toContain("setup: mkdir -p node_modules && echo installed");
    expect(marker).toContain("installed");
  });

  it("a command inside the worktree writes the home ledger", () => {
    const change = planned({ isolation: "worktree" });
    answered(bdk(["part", "start", "01", "--json"], change.root), "output/part-start.json");
    const workdir = workdirOf(change);
    const before = readdirNames(join(change.dir, "log"));
    const added = bdk(
      ["log", "add", "finding", "from the worktree", "--ref", "src/01-1.ts", "--json"],
      workdir,
    );
    expect(added.code, added.stdout).toBe(0);
    expect(readdirNames(join(change.dir, "log"))).toHaveLength(before.length + 1);
    expect(git(workdir, "status", "--porcelain")).toBe("");
  });

  it("exit 5 runtime/worktree-setup-failed: no worktree, branch or entry is left", () => {
    const change = planned({
      isolation: "worktree",
      settings:
        'execution:\n  worktree:\n    setup:\n      command: "echo broken install; exit 3"\n',
    });
    const before = readdirNames(join(change.dir, "log"));
    const { why, instead } = refused(
      bdk(["part", "start", "01", "--json"], change.root),
      5,
      "runtime/worktree-setup-failed",
    );
    expect(why).toContain("echo broken install; exit 3 exited 3");
    expect(why).toContain("broken install");
    expect(instead).toContain("set execution.worktree.enabled: false");
    expect(existsSync(workdirOf(change))).toBe(false);
    expect(git(change.root, "branch", "--list", `bdk-part/${change.id}/01`)).toBe("");
    expect(readdirNames(join(change.dir, "log"))).toStrictEqual(before);
  });

  it("exit 5 runtime/worktree-setup-failed: a setup over its bound is killed", () => {
    const change = planned({
      isolation: "worktree",
      settings:
        'execution:\n  worktree:\n    setup:\n      command: "sleep 30"\n      timeout: 10\n',
    });
    const { why } = refused(
      bdk(["part", "start", "01", "--json"], change.root),
      5,
      "runtime/worktree-setup-failed",
    );
    expect(why).toContain("timed out after 10 s");
    expect(existsSync(workdirOf(change))).toBe(false);
  }, 30_000);

  it("exit 2 policy/config-invalid: a dir inside the repository that git does not ignore", () => {
    const change = planned({
      isolation: "worktree",
      settings: "execution:\n  worktree:\n    dir: worktrees\n",
    });
    const { why } = refused(
      bdk(["part", "start", "01", "--json"], change.root),
      2,
      "policy/config-invalid",
    );
    expect(why).toContain("execution.worktree.dir");
    expect(existsSync(join(change.root, "worktrees"))).toBe(false);
  });

  it("exit 0: with worktrees disabled the part starts in the home checkout, downgraded", () => {
    const change = planned({
      isolation: "worktree",
      settings: "execution:\n  worktree:\n    enabled: false\n",
    });
    const report = answered(
      bdk(["part", "start", "01", "--json"], change.root),
      "output/part-start.json",
    );
    expect(report).toMatchObject({ isolation: "shared", downgraded: true });
    expect(report.workdir).toBeUndefined();
    expect(existsSync(workdirOf(change))).toBe(false);
  });

  it("exit 0: a shared part says isolation shared", () => {
    const change = planned();
    const report = answered(
      bdk(["part", "start", "01", "--json"], change.root),
      "output/part-start.json",
    );
    expect(report.isolation).toBe("shared");
    expect(report.downgraded).toBeUndefined();
  });

  it("exit 0: a worktree and branch left by a killed start are replaced", () => {
    const change = planned({ isolation: "worktree" });
    const workdir = workdirOf(change);
    git(
      change.root,
      "worktree",
      "add",
      "--quiet",
      "-b",
      `bdk-part/${change.id}/01`,
      workdir,
      "HEAD",
    );
    write(workdir, "half.txt", "left by a killed start\n");
    answered(bdk(["part", "start", "01", "--json"], change.root), "output/part-start.json");
    expect(existsSync(join(workdir, "half.txt"))).toBe(false);
    expect(git(workdir, "branch", "--show-current").trim()).toBe(`bdk-part/${change.id}/01`);
  });
});

/** A commit in `cwd` with the three trailers, the way `bdk commit` writes it. */
function commitTask(
  cwd: string,
  change: Opened,
  task: string,
  files: Record<string, string>,
): string {
  for (const [path, text] of Object.entries(files)) write(cwd, path, text);
  git(cwd, "add", "--", ...Object.keys(files));
  git(
    cwd,
    "commit",
    "--quiet",
    "-m",
    `Task ${task}\n\nBDK-Change: ${change.id}\nBDK-Part: ${task.slice(0, 2)}\nBDK-Task: ${task}`,
  );
  return git(cwd, "rev-parse", "HEAD").trim();
}

/** Part 01 a started worktree part with both tasks committed in its worktree. */
function committed(
  files: Record<string, string> = {},
  options: Parameters<typeof planned>[0] = {},
): { change: Opened; workdir: string; shas: string[] } {
  const change = planned({ isolation: "worktree", ...options });
  answered(bdk(["part", "start", "01", "--json"], change.root), "output/part-start.json");
  const workdir = workdirOf(change);
  const shas = [
    commitTask(workdir, change, "01-1", { "src/01-1.ts": "one\n", ...files }),
    commitTask(workdir, change, "01-2", { "src/01-2.ts": "two\n" }),
  ];
  return { change, workdir, shas };
}

describe("bdk part done of a worktree part", () => {
  it("exit 0: a merge commit with the trailers, the part's SHAs kept, worktree and branch gone", () => {
    const { change, workdir, shas } = committed();
    write(change.root, "src/home.ts", "shared work\n");
    git(change.root, "add", "src/home.ts");
    git(change.root, "commit", "--quiet", "-m", "shared work meanwhile");
    const before = git(change.root, "rev-parse", "HEAD").trim();
    const report = answered(
      bdk(["part", "done", "01", "--json"], change.root),
      "output/part-done.json",
    );
    // The checkpoint after the done marker commits the ledger on top of the merge.
    const head = git(change.root, "rev-parse", String(report.merge)).trim();
    expect(report.discarded).toStrictEqual([]);
    expect(git(change.root, "log", "-1", "--format=%P", head).trim().split(" ")).toStrictEqual([
      before,
      shas[1],
    ]);
    expect(git(change.root, "log", "-1", "--format=%s%n%b", head)).toContain(
      `chore(bdk): merge part 01 of ${change.id}`,
    );
    expect(
      git(change.root, "log", "-1", "--format=%(trailers:key=BDK-Part,valueonly)", head).trim(),
    ).toBe("01");
    const reachable = git(change.root, "log", "--format=%H", "HEAD");
    for (const sha of shas) expect(reachable).toContain(sha);
    expect(git(change.root, "worktree", "list", "--porcelain")).not.toContain(workdir);
    expect(git(change.root, "branch", "--list", `bdk-part/${change.id}/01`)).toBe("");
    expect(existsSync(workdir)).toBe(false);
    const rebuilt = bdk(["rebuild", "--json"], change.root);
    expect(rebuilt.code, rebuilt.stdout).toBe(0);
    const list = answered(bdk(["part", "list", "--json"], change.root), "output/part-list.json");
    expect(list.items).toMatchObject([{ part: "01", state: "done", done: 2 }]);
  });

  it("exit 2 policy/merge-conflict: home and worktree unchanged, the merge ticket named", () => {
    const { change, workdir } = committed({ "lock.txt": "part\n" });
    write(change.root, "lock.txt", "home\n");
    git(change.root, "add", "lock.txt");
    git(change.root, "commit", "--quiet", "-m", "home lock");
    const head = git(change.root, "rev-parse", "HEAD");
    const log = readdirNames(join(change.dir, "log"));
    const { why, instead } = refused(
      bdk(["part", "done", "01", "--json"], change.root),
      2,
      "policy/merge-conflict",
    );
    expect(why).toContain("lock.txt");
    expect(instead).toStrictEqual(["bdk attempt open verify-fix 01"]);
    expect(git(change.root, "rev-parse", "HEAD")).toBe(head);
    expect(git(change.root, "status", "--porcelain", "--", ".", ":!.bdk")).toBe("");
    expect(existsSync(workdir)).toBe(true);
    expect(readFileSync(join(workdir, "lock.txt"), "utf8")).toBe("part\n");
    expect(readdirNames(join(change.dir, "log"))).toStrictEqual(log);
  });

  it("exit 2 policy/merge-blocked: a dirty home path the merge would overwrite", () => {
    const { change } = committed({ "lock.txt": "part\n" });
    write(change.root, "lock.txt", "uncommitted shared change\n");
    const head = git(change.root, "rev-parse", "HEAD");
    const { why } = refused(
      bdk(["part", "done", "01", "--json"], change.root),
      2,
      "policy/merge-blocked",
    );
    expect(why).toContain("lock.txt");
    expect(git(change.root, "rev-parse", "HEAD")).toBe(head);
    expect(readFileSync(join(change.root, "lock.txt"), "utf8")).toBe("uncommitted shared change\n");
  });

  it("exit 2 policy/worktree-dirty: a declared path changed again", () => {
    const { change, workdir } = committed();
    write(workdir, "src/01-1.ts", "edited after the commit\n");
    const { why } = refused(
      bdk(["part", "done", "01", "--json"], change.root),
      2,
      "policy/worktree-dirty",
    );
    expect(why).toContain("src/01-1.ts");
    expect(existsSync(workdir)).toBe(true);
  });

  it("exit 0: leftovers listed in discarded and one kernel finding, then removed", () => {
    const { change, workdir } = committed();
    write(workdir, "src/gen/schema.ts", "generated\n");
    const report = answered(
      bdk(["part", "done", "01", "--json"], change.root),
      "output/part-done.json",
    );
    expect(report.discarded).toStrictEqual(["src/gen/schema.ts"]);
    const findings = readdirNames(join(change.dir, "log"))
      .map((name) => readFileSync(join(change.dir, "log", name), "utf8"))
      .filter((text) => text.includes("type: finding") && text.includes("src/gen/schema.ts"));
    expect(findings).toHaveLength(1);
    expect(existsSync(workdir)).toBe(false);
  });

  it("exit 0: a shared part is done with no merge", () => {
    const change = planned({ tasks: 1 });
    answered(bdk(["part", "start", "01", "--json"], change.root), "output/part-start.json");
    commitTask(change.root, change, "01-1", { "src/01-1.ts": "one\n" });
    const report = answered(
      bdk(["part", "done", "01", "--json"], change.root),
      "output/part-done.json",
    );
    expect(report.merge).toBeUndefined();
    expect(report.discarded).toBeUndefined();
  });
});

/** A committed worktree part whose merge back conflicts in lock.txt; part done refused. */
function conflicting(
  options: Parameters<typeof planned>[0] = {},
  home: Record<string, string> = {},
  path = "lock.txt",
) {
  const made = committed({ [path]: "part\n" }, options);
  const files = { [path]: "home\n", ...home };
  for (const [path, text] of Object.entries(files)) write(made.change.root, path, text);
  git(made.change.root, "add", "--", ...Object.keys(files));
  git(made.change.root, "commit", "--quiet", "-m", "home work");
  refused(bdk(["part", "done", "01", "--json"], made.change.root), 2, "policy/merge-conflict");
  return made;
}

function openMerge(change: Opened): Record<string, unknown> {
  return answered(
    bdk(["attempt", "open", "verify-fix", "01", "--json"], change.root),
    "output/attempt-open.json",
  );
}

function close(change: Opened, ticket: string, outcome: string) {
  return bdk(["attempt", "close", ticket, outcome, "--json"], change.root);
}

describe("bdk attempt open and close of a merge ticket", () => {
  it("exit 0: the merge starts in the worktree only, then resolves into a part merge commit", () => {
    const { change, workdir } = conflicting();
    const code = () => git(change.root, "status", "--porcelain", "--", ".", ":!.bdk");
    const home = code();
    const opened = openMerge(change);
    expect(opened).toMatchObject({ merge: true, conflicts: ["lock.txt"] });
    expect(opened.steps).toBeDefined();
    expect(git(workdir, "status", "--porcelain")).toContain("AA lock.txt");
    expect(readFileSync(join(workdir, "lock.txt"), "utf8")).toContain("<<<<<<< ");
    expect(code()).toBe(home);

    refused(close(change, opened.ticket as string, "ok"), 2, "policy/merge-unresolved");
    write(workdir, "lock.txt", "merged\n");
    const homeHead = git(change.root, "rev-parse", "HEAD").trim();
    const report = answered(
      close(change, opened.ticket as string, "ok"),
      "output/attempt-close.json",
    );
    expect(report.next).toMatchObject({ action: "part-done" });
    const tip = git(workdir, "rev-parse", "HEAD").trim();
    const parents = git(workdir, "log", "-1", "--format=%P", tip).trim().split(" ");
    expect(parents).toHaveLength(2);
    expect(git(change.root, "merge-base", "--is-ancestor", parents[1] ?? "", homeHead)).toBe("");
    const message = git(workdir, "log", "-1", "--format=%B", tip);
    expect(message).toMatch(/^chore\(bdk\): merge \S+ into part 01/);
    expect(message).toContain(`BDK-Change: ${change.id}\nBDK-Part: 01`);
    expect(git(workdir, "status", "--porcelain")).toBe("");

    const done = answered(
      bdk(["part", "done", "01", "--json"], change.root),
      "output/part-done.json",
    );
    expect(done.merge).toMatch(/^[0-9a-f]{7}$/);
    expect(readFileSync(join(change.root, "lock.txt"), "utf8")).toBe("merged\n");
  });

  it("exit 0: the merge ticket's package holds the work root and the conflict", () => {
    const { change, workdir } = conflicting();
    write(
      change.root,
      ".bdk/prompts/fragments/merge-conflicts.md",
      "Regenerate `lock.txt` with `make lock`.\n",
    );
    const opened = openMerge(change);
    const built = answered(
      bdk(
        ["dispatch", "build", "01", "implementer", opened.ticket as string, "--json"],
        change.root,
      ),
      "output/dispatch-build.json",
    );
    const text = readFileSync(join(change.root, built.path as string), "utf8");
    expect(text).toContain(`\nworkdir: ${workdir}\n`);
    const branch = git(change.root, "branch", "--show-current").trim();
    expect(text).toMatch(new RegExp(`## Work root\\n\\nYour work root is \`${workdir}\``));
    expect(text).toContain(`## Conflict\n\nThe kernel merged \`${branch}\` into the work root`);
    expect(text).toContain("- `lock.txt`");
    expect(text).toContain("regenerate the lockfile with the project's package manager");
    expect(text).toContain("Regenerate `lock.txt` with `make lock`.");
    expect(text.indexOf("## Work root")).toBeLessThan(text.indexOf("## Ledger entries"));

    // The steps of the ticket run on the merged state; only the implementer resolves.
    for (const role of ["simplifier", "runner"]) {
      const step = answered(
        bdk(["dispatch", "build", "01", role, opened.ticket as string, "--json"], change.root),
        "output/dispatch-build.json",
      );
      const body = readFileSync(join(change.root, step.path as string), "utf8");
      expect(body).toContain("## Work root");
      expect(body).not.toContain("## Conflict");
    }
  });

  it("exit 0: a shared part's package has no work root", () => {
    const change = planned({ tasks: 1 });
    answered(bdk(["part", "start", "01", "--json"], change.root), "output/part-start.json");
    const opened = answered(
      bdk(["attempt", "open", "task-redispatch", "01-1", "--json"], change.root),
      "output/attempt-open.json",
    );
    const built = answered(
      bdk(
        ["dispatch", "build", "01-1", "implementer", opened.ticket as string, "--json"],
        change.root,
      ),
      "output/dispatch-build.json",
    );
    const text = readFileSync(join(change.root, built.path as string), "utf8");
    expect(text).not.toContain("workdir:");
    expect(text).not.toContain("## Work root");
  });

  it("exit 0: a second ticket of the round keeps the merge in progress", () => {
    const { change, workdir } = conflicting();
    const first = openMerge(change);
    const mergeHead = git(workdir, "rev-parse", "MERGE_HEAD");
    answered(close(change, first.ticket as string, "fail"), "output/attempt-close.json");
    const second = openMerge(change);
    expect(second).toMatchObject({ merge: true, conflicts: ["lock.txt"] });
    expect(git(workdir, "rev-parse", "MERGE_HEAD")).toBe(mergeHead);
  });

  it("exit 0: merged-in paths are not the ticket's diff, even under do-not-touch", () => {
    const { change, workdir } = conflicting(
      { doNotTouch: "docs/**" },
      { "docs/home.md": "home\n" },
    );
    const opened = openMerge(change);
    write(workdir, "lock.txt", "merged\n");
    const report = answered(
      close(change, opened.ticket as string, "ok"),
      "output/attempt-close.json",
    );
    expect(report.diff).toStrictEqual({
      declared: ["lock.txt"],
      touched: ["lock.txt"],
      undeclared: [],
    });
  });

  it("exit 2 policy/merge-unresolved: a marker line left in a conflicted path", () => {
    const { change, workdir } = conflicting();
    const opened = openMerge(change);
    write(workdir, "lock.txt", "merged\n=======\nleft over\n");
    const head = git(workdir, "rev-parse", "HEAD");
    const { why } = refused(
      close(change, opened.ticket as string, "ok"),
      2,
      "policy/merge-unresolved",
    );
    expect(why).toContain("lock.txt");
    expect(git(workdir, "rev-parse", "HEAD")).toBe(head);
    expect(existsSync(join(change.root, ".git/worktrees/01/MERGE_HEAD"))).toBe(true);
  });

  it("exit 0: an exhausted round parks with the worktree, the paths and git merge --abort", () => {
    const { change, workdir } = conflicting({
      settings: "policy:\n  budgets:\n    verify-fix: 1\n  escalation:\n    enabled: false\n",
    });
    const opened = openMerge(change);
    const last = answered(
      close(change, opened.ticket as string, "fail"),
      "output/attempt-close.json",
    );
    expect(last.next).toMatchObject({ action: "parked" });
    const question = readdirNames(join(change.dir, "log"))
      .map((name) => readFileSync(join(change.dir, "log", name), "utf8"))
      .find((text) => text.includes("type: question"));
    expect(question).toContain(workdir);
    expect(question).toContain("lock.txt");
    expect(question).toContain("git merge --abort");
  });
});

describe("the work root of a worktree part's tasks", () => {
  it("exit 0: bdk commit commits on the part branch, no .bdk/ path, home unchanged", () => {
    const change = planned({ isolation: "worktree" });
    answered(bdk(["part", "start", "01", "--json"], change.root), "output/part-start.json");
    const workdir = workdirOf(change);
    write(workdir, "src/01-1.ts", "one\n");
    write(workdir, "pnpm-lock.yaml", "lock\n");
    write(change.root, "src/keep.ts", "home edit in flight\n");
    const head = git(change.root, "rev-parse", "HEAD");
    const report = answered(bdk(["commit", "01-1", "--json"], change.root), "output/commit.json");
    expect(report).toMatchObject({ task: "01-1", undeclared: ["pnpm-lock.yaml"] });
    expect(report.files).toStrictEqual(["src/01-1.ts", "pnpm-lock.yaml"]);
    expect(
      git(workdir, "show", "--name-only", "--format=", "HEAD").trim().split("\n"),
    ).toStrictEqual(["pnpm-lock.yaml", "src/01-1.ts"]);
    expect(git(workdir, "log", "-1", "--format=%(trailers:key=BDK-Task,valueonly)").trim()).toBe(
      "01-1",
    );
    expect(git(change.root, "rev-parse", "HEAD")).toBe(head);
    expect(readFileSync(join(change.root, "src/keep.ts"), "utf8")).toBe("home edit in flight\n");
    const finding = readdirNames(join(change.dir, "log"))
      .map((name) => readFileSync(join(change.dir, "log", name), "utf8"))
      .filter((text) => text.includes("type: finding") && text.includes("pnpm-lock.yaml"));
    expect(finding).toHaveLength(1);
    const list = answered(bdk(["part", "list", "--json"], change.root), "output/part-list.json");
    expect(list.items).toMatchObject([{ part: "01", done: 1 }]);
    refused(bdk(["commit", "01-1", "--json"], change.root), 2, "policy/nothing-to-commit");
  });

  it("exit 0: evidence hashes the worktree, stays fresh across the merge, goes stale on build config", () => {
    const change = planned({ isolation: "worktree" });
    answered(bdk(["part", "start", "01", "--json"], change.root), "output/part-start.json");
    const workdir = workdirOf(change);
    write(workdir, "src/01-1.ts", "one\n");
    write(workdir, "src/01-2.ts", "two\n");
    const ticket = answered(
      bdk(["attempt", "open", "task-redispatch", "01-1", "--json"], change.root),
      "output/attempt-open.json",
    ).ticket as string;
    write(change.root, ".bdk/.machine/lint.txt", "clean\n");
    answered(
      bdk(
        [
          "evidence",
          "record",
          "lint",
          ".bdk/.machine/lint.txt",
          "--ticket",
          ticket,
          "--verdict",
          "pass",
          "--cite",
          ".bdk/.machine/lint.txt:1",
          "--json",
        ],
        change.root,
      ),
      "output/evidence-record.json",
    );
    const check = () =>
      answered(
        bdk(["evidence", "check", "01-1", "--json"], change.root),
        "output/evidence-check.json",
      );
    expect(check().fresh).toBe(true);
    write(change.root, "src/01-2.ts", "home has its own copy\n");
    expect(check().fresh).toBe(true);
    fileStore().remove(join(change.root, "src/01-2.ts"));

    answered(
      bdk(["attempt", "close", ticket, "ok", "--json"], change.root),
      "output/attempt-close.json",
    );
    answered(bdk(["commit", "01-1", "--json"], change.root), "output/commit.json");
    answered(bdk(["commit", "01-2", "--json"], change.root), "output/commit.json");
    answered(bdk(["part", "done", "01", "--json"], change.root), "output/part-done.json");
    expect(check().fresh).toBe(true);
    write(change.root, "package.json", "{}\n");
    expect(check()).toMatchObject({ fresh: false, evidence: [{ changedSince: ["package.json"] }] });
  });
});

describe("bdk next with a worktree part", () => {
  it("exit 0: the wave names the live part's worktree as its workdir", () => {
    const change = planned({ isolation: "worktree" });
    const before = answered(bdk(["next", "--json"], change.root), "output/next.json");
    expect(before.wave).toMatchObject([{ part: "01", isolation: "worktree", started: false }]);
    answered(bdk(["part", "start", "01", "--json"], change.root), "output/part-start.json");
    const after = answered(bdk(["next", "--json"], change.root), "output/next.json");
    expect(after.wave).toMatchObject([
      { part: "01", isolation: "worktree", started: true, workdir: workdirOf(change) },
    ]);
  });
});

describe("bdk rebuild settles the kernel worktrees", () => {
  function rebuild(change: Opened) {
    return answered(bdk(["rebuild", "--json"], change.root), "output/rebuild.json");
  }

  function startedWithTask(settings?: string): { change: Opened; workdir: string } {
    const change = planned({
      isolation: "worktree",
      ...(settings === undefined ? {} : { settings }),
    });
    answered(bdk(["part", "start", "01", "--json"], change.root), "output/part-start.json");
    const workdir = workdirOf(change);
    write(workdir, "src/01-1.ts", "one\n");
    answered(bdk(["commit", "01-1", "--json"], change.root), "output/commit.json");
    return { change, workdir };
  }

  function finished(): Opened {
    const { change, workdir } = startedWithTask();
    write(workdir, "src/01-2.ts", "two\n");
    answered(bdk(["commit", "01-2", "--json"], change.root), "output/commit.json");
    answered(bdk(["part", "done", "01", "--json"], change.root), "output/part-done.json");
    return change;
  }

  it("exit 0: a merged part's leftover worktree is removed with its branch", () => {
    const change = finished();
    const branch = `bdk-part/${change.id}/01`;
    const workdir = workdirOf(change);
    git(change.root, "worktree", "add", "--quiet", "-b", branch, workdir, "HEAD");
    fileStore().write(
      join(git(workdir, "rev-parse", "--absolute-git-dir").trim(), "bdk-home"),
      `${change.root}\n${change.id}\n`,
    );
    expect(rebuild(change)).toMatchObject({
      worktrees: [{ part: "01", path: workdir, action: "removed" }],
    });
    expect(existsSync(workdir)).toBe(false);
    expect(git(change.root, "branch", "--list", branch).trim()).toBe("");
  });

  it("exit 0: a live worktree is kept with its commit", () => {
    const { change, workdir } = startedWithTask();
    const tip = git(workdir, "rev-parse", "HEAD");
    const report = rebuild(change);
    expect(report).toMatchObject({ worktrees: [{ part: "01", path: workdir, action: "kept" }] });
    expect(report.warnings).toStrictEqual([]);
    expect(git(workdir, "rev-parse", "HEAD")).toBe(tip);
  });

  it("exit 0: a deleted live worktree is recreated from its branch, include copy and setup", () => {
    const { change, workdir } = startedWithTask(
      'execution:\n  worktree:\n    setup:\n      command: "touch .set-up"\n',
    );
    write(change.root, ".worktreeinclude", ".env\n");
    write(change.root, ".env", "TOKEN=1\n");
    fileStore().write(
      join(change.root, ".gitignore"),
      `${readFileSync(join(change.root, ".gitignore"), "utf8")}.env\n.set-up\n`,
    );
    const tip = git(workdir, "rev-parse", "HEAD");
    rmSync(workdir, { recursive: true, force: true });
    const report = rebuild(change);
    expect(report).toMatchObject({
      worktrees: [{ part: "01", path: workdir, action: "recreated" }],
    });
    expect(report.warnings).toStrictEqual([
      `part 01: worktree ${workdir} recreated from bdk-part/${change.id}/01`,
    ]);
    expect(git(workdir, "rev-parse", "HEAD")).toBe(tip);
    expect(readFileSync(join(workdir, ".env"), "utf8")).toBe("TOKEN=1\n");
    expect(existsSync(join(workdir, ".set-up"))).toBe(true);
    const gitDir = git(workdir, "rev-parse", "--absolute-git-dir").trim();
    expect(readFileSync(join(gitDir, "bdk-home"), "utf8")).toBe(`${change.root}\n${change.id}\n`);
    const list = answered(bdk(["part", "list", "--json"], change.root), "output/part-list.json");
    expect(list.items).toMatchObject([{ part: "01", done: 1 }]);
  });

  it("exit 0: an unmerged branch of a done part is kept and warned", () => {
    const change = finished();
    const branch = `bdk-part/${change.id}/01`;
    git(change.root, "branch", branch, "HEAD");
    const spare = `${change.root}-spare`;
    git(change.root, "worktree", "add", "--quiet", spare, branch);
    write(spare, "src/late.ts", "late\n");
    git(spare, "add", "src/late.ts");
    git(spare, "commit", "--quiet", "-m", "late work");
    git(change.root, "worktree", "remove", "--force", spare);
    const tip = git(change.root, "rev-parse", branch);
    const report = rebuild(change);
    expect(report.worktrees).toStrictEqual([]);
    expect(report.warnings).toStrictEqual([
      `branch ${branch} of part 01, which is not live, holds commits the home checkout lacks; kept`,
    ]);
    expect(git(change.root, "rev-parse", branch)).toBe(tip);
  });

  it("exit 0: a started worktree part with neither worktree nor branch is warned", () => {
    const { change, workdir } = startedWithTask();
    git(change.root, "worktree", "remove", "--force", workdir);
    git(change.root, "branch", "-D", `bdk-part/${change.id}/01`);
    const report = rebuild(change);
    expect(report.worktrees).toStrictEqual([]);
    expect(report.warnings).toStrictEqual([
      `part 01 was started in a worktree, but neither the worktree nor the branch bdk-part/${change.id}/01 exists; close its start marker, then run bdk part start 01`,
    ]);
  });

  it("exit 0: a user's worktree without the marker is untouched and not listed", () => {
    const { change } = startedWithTask();
    const spike = `${change.root}-spike`;
    git(change.root, "worktree", "add", "--quiet", "-b", "spike", spike, "HEAD");
    const report = rebuild(change);
    expect(report.worktrees).toMatchObject([{ part: "01", action: "kept" }]);
    expect(existsSync(spike)).toBe(true);
    expect(git(change.root, "rev-parse", "--verify", "--quiet", "spike")).not.toBe("");
  });
});

describe("the lockfile rule in a merge ticket", () => {
  function packageRules(path: string): string[] {
    const { change } = conflicting({}, {}, path);
    const opened = openMerge(change);
    const ticket = opened.ticket as string;
    answered(
      bdk(["dispatch", "build", "01", "implementer", ticket, "--json"], change.root),
      "output/dispatch-build.json",
    );
    const shown = answered(
      bdk(["rules", "show", "--ticket", ticket, "--json"], change.root),
      "output/rules-show.json",
    );
    return (shown.rules as { id: string }[]).map((rule) => rule.id);
  }

  it("lists BDK-CQ-9 when the conflicts hold a lockfile", () => {
    expect(packageRules("pnpm-lock.yaml")).toContain("BDK-CQ-9");
  });

  it("leaves BDK-CQ-9 out when no conflict is a lockfile", () => {
    expect(packageRules("lock.txt")).not.toContain("BDK-CQ-9");
  });
});
