// One `small` feature Change from `change new` to `close` through the built
// bundle in a real repository (T50, AC-1): every artifact, verdict, ticket,
// commit and gate driven by the kernel commands the stage skills run, and each
// gate passed by the typed stage command through `hooks prompt-expansion`;
// and two Changes advanced on two branches whose state merges (EC-3).
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import upeTyped from "../../../../tests/fixtures/host-payloads/2.1.281/upe-typed.json" with { type: "json" };
import { answered, bdk, git, read, refused, repository } from "../../../tests/support/repo.ts";
import { fileStore } from "../../shared/store/index.ts";
import { creating } from "../../spec/tests/e2e-support.ts";

const CAP = "auth/login";

const SETTINGS =
  "tools:\n" +
  "  test:\n    - { id: unit, tier: fast, command: vitest run }\n" +
  "  lint:\n    - { id: eslint, tier: lint, command: eslint . }\n";

interface Change {
  readonly root: string;
  readonly dir: string;
  readonly id: string;
}

function run(change: Change, args: string[], schema: string, stdin?: string) {
  return answered(
    bdk([...args, "--json"], change.root, stdin === undefined ? {} : { stdin }),
    schema,
  );
}

function next(change: Change): Record<string, unknown> {
  return run(change, ["next"], "output/next.json");
}

function done(change: Change, id: string): void {
  run(change, ["done", id], "output/done.json");
}

/** The user types `/<command>`: the host's UserPromptExpansion payload through the guard. */
function typed(change: Change, command: string): void {
  const payload = {
    ...upeTyped.payloads[0],
    session_id: "sess-ac1",
    command_name: command,
    command_args: "",
    prompt: `/${command}`,
    cwd: change.root,
  };
  const result = bdk(["hooks", "prompt-expansion"], change.root, {
    stdin: JSON.stringify(payload),
  });
  expect(result.code, result.stdout + result.stderr).toBe(0);
}

/** A report on `target` stored and recorded by the role under `ticket`, as its package says. */
function report(change: Change, ticket: string, target: string, body: string): string {
  const stored = run(
    change,
    ["log", "ingest", "--ticket", ticket],
    "output/log-ingest.json",
    `---\nstatus: done\nfiles: []\nentries: []\nevidence: []\n---\n${body}`,
  );
  run(
    change,
    ["log", "add", "report", `${target} passed`, "--ref", target, "--ticket", ticket],
    "output/log-add.json",
  );
  return stored.path as string;
}

/** `/bdk:verify-design` or `/bdk:verify-plan`: one verifier round that passes. */
function verify(change: Change, node: "design-verify" | "plan-verify"): void {
  const role = node === "design-verify" ? "design-verifier" : "verifier";
  const ticket = run(change, ["attempt", "open", "verifier", node], "output/attempt-open.json")
    .ticket as string;
  run(change, ["dispatch", "build", node, role, ticket], "output/dispatch-build.json");
  const path = report(change, ticket, node, "# Verdict\n\nPASS\n");
  run(change, ["attempt", "close", ticket, "ok", "--envelope", path], "output/attempt-close.json");
  done(change, node);
}

/** The runner's cited evidence of `kind` under `ticket`. */
function evidence(change: Change, ticket: string, kind: string): void {
  const file = `.bdk/.machine/${kind}-${ticket.replace("@", "-")}.json`;
  fileStore().write(join(change.root, file), '{"failed":0}\n');
  run(
    change,
    [
      "evidence",
      "record",
      kind,
      file,
      "--ticket",
      ticket,
      "--verdict",
      "pass",
      "--cite",
      "/failed",
    ],
    "output/evidence-record.json",
  );
}

describe("a small Change end to end [AC-1]", () => {
  it("runs from change new through design, plan, execute and review to close", () => {
    const root = repository({ ".bdk/settings.yaml": SETTINGS });

    // /bdk:change
    const opened = run(
      { root, dir: root, id: "" },
      ["change", "new", "Users log in with a one-time link"],
      "output/change-new.json",
    );
    const id = opened.change as string;
    const change: Change = { root, dir: join(root, ".bdk/changes", id), id };
    expect(opened).toMatchObject({ profile: { value: "small" } });

    // /bdk:design
    expect(next(change)).toMatchObject({ artifact: { id: "design" } });
    fileStore().write(
      join(change.dir, "design.md"),
      "---\nschema: 1\ntitle: design\n---\nLinks.\n",
    );
    done(change, "design");
    fileStore().write(
      join(change.dir, "architecture.md"),
      "---\nschema: 1\ntitle: architecture\n---\nA token store.\n",
    );
    done(change, "architecture");
    expect(next(change)).toMatchObject({ artifact: { id: "design-verify" } });
    verify(change, "design-verify");
    expect(next(change)).toMatchObject({ waiting: "gate" });

    // /bdk:plan
    typed(change, "bdk:plan");
    expect(next(change)).toMatchObject({ artifact: { id: "plan" } });
    fileStore().write(
      join(change.dir, "spec-delta", `${CAP}.md`),
      creating(["Link sent", ["sent"]]),
    );
    run(change, ["spec", "delta", "check", CAP], "output/spec-delta-check.json");
    fileStore().write(
      join(change.dir, "plan/parts/01-part.md"),
      '---\nschema: 1\nid: "01"\ntitle: Token store\ngoal: g\nsuccess-measure: m\n' +
        `do-not-touch: []\ndepends-on: []\nspec-impact: ["${CAP}"]\n---\n` +
        "## 01-1 Store the token\n\n**Files:**\n\n- Create: `src/token.ts`\n\n" +
        "**Test cases:**\n\n- stores a token\n",
    );
    done(change, "plan");
    expect(next(change)).toMatchObject({ artifact: { id: "plan-verify" } });
    verify(change, "plan-verify");

    // /bdk:execute
    typed(change, "bdk:execute");
    run(change, ["part", "start", "01"], "output/part-start.json");
    const ticket = run(
      change,
      ["attempt", "open", "task-redispatch", "01-1"],
      "output/attempt-open.json",
    ).ticket as string;
    run(change, ["dispatch", "build", "01-1", "implementer", ticket], "output/dispatch-build.json");
    run(change, ["rules", "show", "--ticket", ticket], "output/rules-show.json");
    fileStore().write(join(root, "src/token.ts"), "export const token = 1;\n");
    run(change, ["dispatch", "build", "01-1", "simplifier", ticket], "output/dispatch-build.json");
    report(change, ticket, "01-1", "# Simplify\n\nNothing to simplify.\n");
    run(change, ["dispatch", "build", "01-1", "runner", ticket], "output/dispatch-build.json");
    evidence(change, ticket, "tests-scoped");
    evidence(change, ticket, "lint");
    run(change, ["attempt", "close", ticket, "ok"], "output/attempt-close.json");
    run(change, ["commit", "01-1"], "output/commit.json");
    run(change, ["part", "done", "01"], "output/part-done.json");
    done(change, "spec-delta");

    // /bdk:cr
    const round = run(change, ["attempt", "open", "review-fix", id], "output/attempt-open.json")
      .ticket as string;
    run(
      change,
      ["dispatch", "build", id, "runner", round, "--group", "gate"],
      "output/dispatch-build.json",
    );
    evidence(change, `${round}@gate`, "tests-full");
    evidence(change, `${round}@gate`, "lint-full");
    report(change, `${round}@merge`, id, "# Review\n\nPASS\n");
    run(change, ["attempt", "close", round, "ok"], "output/attempt-close.json");
    done(change, "review");
    expect(next(change)).toMatchObject({ waiting: "gate" });

    // /bdk:close
    typed(change, "bdk:close");
    const closed = run(change, ["change", "close"], "output/change-close.json");
    expect(closed).toMatchObject({ change: id, spec: { merged: [CAP] } });
    expect(existsSync(change.dir)).toBe(false);
    expect(existsSync(join(root, ".bdk/changes/archive", id))).toBe(true);
    expect(read(root, `.bdk/specs/${CAP}/spec.md`)).toContain("### Requirement: Link sent");
    expect(git(root, "log", "--format=%s").trim().split("\n")).toEqual([
      `chore(bdk): close ${id}`,
      "Store the token",
      "initial",
    ]);
    expect(git(root, "log", "-1", "--format=%B", "HEAD~1")).toContain(
      `BDK-Change: ${id}\nBDK-Part: 01\nBDK-Task: 01-1`,
    );
    refused(bdk(["change", "status", "--json"], root), 2, "policy/no-active-change");
  });
});

/** `/bdk:change` on the checked-out branch. */
function start(root: string, intent: string): Change {
  const id = run({ root, dir: root, id: "" }, ["change", "new", intent], "output/change-new.json")
    .change as string;
  return { root, dir: join(root, ".bdk/changes", id), id };
}

describe("two Changes on two branches [EC-3]", () => {
  it("progress side by side, merge without conflict and rebuild into both states", () => {
    const root = repository();
    git(root, "branch", "feat/mail");

    const login = start(root, "Users log in with a one-time link");
    fileStore().write(join(login.dir, "design.md"), "---\nschema: 1\ntitle: design\n---\nLinks.\n");
    done(login, "design");
    run(
      login,
      ["log", "add", "decision", "Links expire after 10 minutes", "--ref", "design.md"],
      "output/log-add.json",
    );
    git(root, "add", "--all");
    git(root, "commit", "--quiet", "-m", "login design");

    git(root, "checkout", "--quiet", "feat/mail");
    const mail = start(root, "Mail digests go out weekly");
    expect(next(mail)).toMatchObject({ artifact: { id: "design" } });
    run(
      mail,
      ["log", "add", "question", "Which day of the week?", "--ref", "change.md"],
      "output/log-add.json",
    );
    git(root, "add", "--all");
    git(root, "commit", "--quiet", "-m", "mail intent");

    git(root, "checkout", "--quiet", "-b", "main", "feat/login~1");
    git(root, "merge", "--quiet", "--no-edit", "feat/login");
    git(root, "merge", "--quiet", "--no-edit", "feat/mail");
    expect(git(root, "status", "--porcelain")).toBe("");

    git(root, "checkout", "--quiet", "feat/login");
    git(root, "merge", "--quiet", "--ff-only", "main");
    expect(run(login, ["rebuild", "--all"], "output/rebuild.json")).toMatchObject({ changes: 2 });
    const listed = run(login, ["change", "list"], "output/change-list.json") as {
      items: { change: string; branch: string }[];
    };
    expect(listed.items.map((item) => [item.change, item.branch]).sort()).toEqual(
      [
        [login.id, "feat/login"],
        [mail.id, "feat/mail"],
      ].sort(),
    );

    expect(run(login, ["change", "status"], "output/change-status.json")).toMatchObject({
      change: login.id,
    });
    expect(next(login)).toMatchObject({ artifact: { id: "architecture" } });

    git(root, "checkout", "--quiet", "feat/mail");
    git(root, "merge", "--quiet", "--ff-only", "main");
    expect(run(mail, ["change", "status"], "output/change-status.json")).toMatchObject({
      change: mail.id,
    });
    expect(next(mail)).toMatchObject({ artifact: { id: "design" } });
    const questions = run(mail, ["log", "list", "--type", "question"], "output/log-list.json");
    expect(JSON.stringify(questions)).toContain("Which day of the week?");
    expect(JSON.stringify(questions)).not.toContain("Links expire");
  });
});
