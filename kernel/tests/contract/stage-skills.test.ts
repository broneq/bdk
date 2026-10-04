// `stage-skills` (v3-t41-design, v3-t41-plan, v3-t41-execute): the two tiers
// of asking the user in the `decision` fragments, and the content of the
// `design`, `verify-design`, `plan`, `verify-plan` and `execute` stage skills. The kernel holds the order of the work; these tests check
// that each skill names the commands that carry it.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { SKILL_CONTEXT } from "../../src/ctx/use-cases/manifest.ts";
import { REPO_ROOT } from "../support/run.ts";

const STAGES = join(REPO_ROOT, "skills", "stages");

function fragment(id: "lavish" | "ask-user"): string {
  return readFileSync(join(REPO_ROOT, "fragments", "decision", `${id}.md`), "utf8");
}

function readSkill(name: string): { meta: Record<string, unknown>; body: string } {
  const text = readFileSync(join(STAGES, name, "SKILL.md"), "utf8");
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (match?.[1] === undefined) throw new Error(`${name}: no frontmatter`);
  return { meta: parse(match[1]) as Record<string, unknown>, body: text.slice(match[0].length) };
}

describe("asking the user in two tiers", () => {
  it.each(["lavish", "ask-user"] as const)("%s states the simple and the rich tier", (id) => {
    const text = fragment(id);
    expect(text).toContain("**Simple decision**");
    expect(text).toContain("**Rich decision**");
    expect(text).toContain("`AskUserQuestion`");
    expect(text).toMatch(/recommended option first/);
  });

  it("lavish keeps simple decisions in the terminal and names the loop and the fallback", () => {
    const text = fragment("lavish");
    expect(text).toMatch(/Simple decision\*\*[^\n]*never through Lavish/);
    expect(text).toContain("`lavish-axi --help`");
    expect(text).toContain("`lavish-axi poll <file>`");
    expect(text).toMatch(/Fall back on any failure/);
    expect(text).toMatch(/Never reopen a session the user ended/);
  });

  it("lavish names no flag that lavish-axi --help does not print", () => {
    // `--help` is the only flag the fragment may name: every other one is the
    // CLI's to define, and `--reopen` would reopen a session the user ended.
    const flags = [...fragment("lavish").matchAll(/(?<![\w-])--[a-z][\w-]*/g)].map((m) => m[0]);
    expect([...new Set(flags)]).toStrictEqual(["--help"]);
  });

  it("ask-user states what the terminal loses and what it keeps", () => {
    const text = fragment("ask-user");
    expect(text).toMatch(/loses rendered diagrams, a side-by-side layout and annotation/);
    expect(text).toMatch(/keeps every option, the recommendation and the tradeoffs/);
    expect(text).not.toContain("lavish-axi poll");
  });
});

describe("stage skill invocation", () => {
  it("only setup and run are user-only; run starts the others, guarded by hooks pre-tool", () => {
    for (const name of readdirSync(STAGES)) {
      const { meta } = readSkill(name);
      const userOnly = ["setup", "run"].includes(name);
      expect(meta["disable-model-invocation"] === true, name).toBe(userOnly);
    }
    expect(readdirSync(STAGES)).toEqual(
      expect.arrayContaining(["design", "verify-design", "plan", "verify-plan"]),
    );
  });
});

describe("verify-design", () => {
  it("has a manifest entry for its context lines", () => {
    expect(SKILL_CONTEXT["verify-design"]).toStrictEqual([]);
  });

  it("runs the verifier round through the kernel and the reader adapter", () => {
    const { body } = readSkill("verify-design");
    for (const needle of [
      "bdk attempt open verifier design-verify",
      "bdk dispatch build design-verify design-verifier <ticket>",
      "subagent_type: bdk:reader",
      "bdk log add report",
      "bdk attempt close <ticket>",
      "bdk done design-verify",
      "`model`",
    ]) {
      expect(body, needle).toContain(needle);
    }
    expect(body).toMatch(/resume[^.]*once/i);
  });
});

describe("design", () => {
  it("is the only design skill of the plugin", () => {
    expect(existsSync(join(REPO_ROOT, "skills", "design"))).toBe(false);
  });

  it("follows the kernel and records decisions in the ledger", () => {
    const { body } = readSkill("design");
    for (const needle of [
      "bdk next --json",
      "bdk done <id>",
      "bdk log add decision",
      "bdk log add question",
      "/bdk:verify-design",
      "bdk change status --json",
      "/bdk:plan",
      "`false-code-claim`",
    ]) {
      expect(body, needle).toContain(needle);
    }
  });

  it("links every reference it ships", () => {
    const { body } = readSkill("design");
    const references = readdirSync(join(STAGES, "design", "references"));
    expect(references.sort()).toStrictEqual(["approaches.md", "schema-gate.md"]);
    for (const file of references) expect(body).toContain(`](references/${file})`);
  });
});

describe("verify-plan", () => {
  it("is the only verify-plan skill and has a manifest entry for its context lines", () => {
    expect(existsSync(join(REPO_ROOT, "skills", "verify-plan"))).toBe(false);
    expect(SKILL_CONTEXT["verify-plan"]).toStrictEqual([]);
  });

  it("runs the verifier round through the kernel and the reader adapter", () => {
    const { body } = readSkill("verify-plan");
    for (const needle of [
      "bdk attempt open verifier plan-verify",
      "bdk dispatch build plan-verify verifier <ticket>",
      "subagent_type: bdk:reader",
      "bdk log add report",
      "bdk attempt close <ticket>",
      "bdk done plan-verify",
      "`model`",
    ]) {
      expect(body, needle).toContain(needle);
    }
    expect(body).toMatch(/resume[^.]*once/i);
  });
});

describe("plan", () => {
  it("is the only planning skill of the plugin", () => {
    expect(existsSync(join(REPO_ROOT, "skills", "create-plan"))).toBe(false);
    expect(SKILL_CONTEXT).not.toHaveProperty("create-plan");
    expect(SKILL_CONTEXT.plan).toBeDefined();
  });

  it("follows the kernel, verifies itself and ends with the execute command", () => {
    const { body } = readSkill("plan");
    for (const needle of [
      "bdk next --json",
      "bdk done plan",
      "bdk spec delta check",
      "bdk log add decision",
      "/bdk:verify-plan",
      "bdk part list --json",
      "--review",
      "/bdk:execute",
      "`false-code-claim`",
      "follow-up Change",
      "the only limit on rounds",
      "grows the scope beyond the intent",
      "A passing verdict, `done-with-concerns` included, closes the plan",
    ]) {
      expect(body, needle).toContain(needle);
    }
  });

  it("links every reference it ships", () => {
    const { body } = readSkill("plan");
    const references = readdirSync(join(STAGES, "plan", "references"));
    expect(references.sort()).toStrictEqual(["task-shape.md"]);
    for (const file of references) expect(body).toContain(`](references/${file})`);
  });
});

describe("execute", () => {
  it("is the only skill that executes a plan, with the concurrency and decision context", () => {
    expect(existsSync(join(REPO_ROOT, "skills", "subagent-execute-plan"))).toBe(false);
    expect(SKILL_CONTEXT.execute).toStrictEqual([
      { kind: "concurrency" },
      { kind: "fragment", id: "decision" },
    ]);
  });

  it("is started by the user or a run and never edits a file itself", () => {
    const { meta } = readSkill("execute");
    expect(meta["disable-model-invocation"]).toBeUndefined();
    expect(meta["disallowed-tools"]).toBe("Edit Write NotebookEdit");
  });

  it("loops on the kernel through every ready part in the mode the wave gives", () => {
    const { body } = readSkill("execute");
    for (const needle of [
      "bdk next --json",
      "`wave`",
      "bdk part start <part>",
      "bdk attempt open part-lead <part>",
      "bdk dispatch build <part> lead <ticket>",
      "bdk:lead",
      "bdk attempt open task-redispatch <task>",
      "bdk:swarm",
      "--escalate",
      "bdk part done <part>",
      "bdk done spec-delta",
      "verify-fix",
      "/bdk:cr",
      "One `/bdk:execute` runs every ready part",
    ]) {
      expect(body, needle).toContain(needle);
    }
  });
});

describe("close", () => {
  it("has a manifest entry with no parts and never edits a file itself", () => {
    expect(SKILL_CONTEXT.close).toStrictEqual([]);
    const { meta } = readSkill("close");
    expect(meta["disable-model-invocation"]).toBeUndefined();
    expect(meta["disallowed-tools"]).toBe("Edit Write NotebookEdit");
  });

  it("closes through the kernel, regenerates drifted rules and leaves the PR to the user", () => {
    const { body } = readSkill("close");
    for (const needle of [
      "bdk next --json",
      "bdk change close --dry-run --json",
      "bdk rules export --claude --check --json",
      "bdk rules export --claude --json",
      "policy/generated-drift",
      "bdk change close --json",
      "policy/git-hook-failed",
      "`gatesByPolicy`",
      "`summary`",
      "`archivedTo`",
      "You do not open the PR",
    ]) {
      expect(body, needle).toContain(needle);
    }
  });
});

describe("run", () => {
  it("is user-only, with a manifest entry with no parts and only the Skill and Read tools", () => {
    expect(SKILL_CONTEXT.run).toStrictEqual([]);
    const { meta } = readSkill("run");
    expect(meta["disable-model-invocation"]).toBe(true);
    expect(meta["allowed-tools"]).toBe(
      'Bash(node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" *) Bash(echo *) Skill Read',
    );
    expect(meta).not.toHaveProperty("disallowed-tools");
  });

  it("loops on next through the stage skills and decides instead of asking", () => {
    const { body } = readSkill("run");
    for (const needle of [
      "bdk next --json",
      "`Skill` tool",
      "/bdk:change",
      "/bdk:design",
      "/bdk:plan",
      "/bdk:execute",
      "/bdk:cr",
      "/bdk:close",
      "bdk log add decision",
      "--review",
      "guard/gate-manual",
      "policy/gate-not-ready",
      "`waiting: user`",
      "A pending `review: true` entry is no reason to stop",
    ]) {
      expect(body, needle).toContain(needle);
    }
  });

  it("starts /bdk:cr like any other stage skill and does not stop for blockers (T42-B1)", () => {
    const { body } = readSkill("run");
    expect(body).toMatch(
      /start the skill its `command` names: `\/bdk:design`, `\/bdk:plan`, `\/bdk:execute`, `\/bdk:cr` or `\/bdk:close`/,
    );
    expect(body).not.toContain("an artifact whose `command` is `/bdk:cr`");
    expect(body).not.toMatch(/stop: the user types `\/bdk:cr`/);
    expect(body).toMatch(/Blocking review entries are no reason to stop/);
  });

  it("defers the undecided entries of the cr report, never chooses fix, and names --report (T42)", () => {
    const { body } = readSkill("run");
    expect(body).toContain("bdk log decide <id> defer --review");
    expect(body).toMatch(/never (chooses?|records?) `fix`/);
    expect(body).toContain("/bdk:cr --report");
    const finish = body.slice(body.indexOf("## Finish"));
    expect(finish).toContain("the report path");
    expect(finish).toContain("/bdk:cr --report");
  });

  it("stays well under the stage skill limit", () => {
    const text = readFileSync(join(STAGES, "run", "SKILL.md"), "utf8");
    expect(text.split("\n").length).toBeLessThanOrEqual(120);
  });
});

describe("author self-check before verification (P8, T42)", () => {
  it.each([
    ["design", "/bdk:verify-design"],
    ["plan", "/bdk:verify-plan"],
  ])("%s checks its draft against its context's P8 lists before %s", (name, verify) => {
    const { body } = readSkill(name);
    const check = body.indexOf("Blocking categories (P8)");
    expect(check).toBeGreaterThan(-1);
    expect(check).toBeLessThan(body.indexOf(verify));
    expect(body).toContain("Not a fail");
    expect(body).toMatch(/writes no entry and no file/);
    expect(SKILL_CONTEXT[name]).toContainEqual({ kind: "verifier-policy" });
  });

  it("execute names /bdk:cr as the next stage in its finish", () => {
    const { body } = readSkill("execute");
    expect(body.slice(body.indexOf("## Finish"))).toContain("`/bdk:cr`");
  });
});

describe("gates passed by policy are named by id (T42 run probe)", () => {
  it.each(["run", "close"])(
    "%s names each gate passed by policy by its id in its finish",
    (name) => {
      const { body } = readSkill(name);
      const finish = body.slice(body.indexOf("## Finish"));
      expect(finish).toMatch(/gates passed by policy[^\n]*by its id \(`gate:(design|review)`\)/);
    },
  );
});

describe("setup proposes the tracker (T42)", () => {
  it("detects GitHub with gh auth status and writes either kind with config set", () => {
    const { meta, body } = readSkill("setup");
    expect(String(meta["allowed-tools"])).toContain("Bash(gh auth status)");
    for (const needle of [
      "gh auth status",
      "bdk config set tracker",
      "{kind: github}",
      "{kind: instruction",
    ]) {
      expect(body, needle).toContain(needle);
    }
  });
});

describe("worktree isolation in the stage skills (T45)", () => {
  it("plan decides isolation and its reason", () => {
    const { body } = readSkill("plan");
    expect(body).toContain("`isolation`");
    expect(body).toContain("`isolation-reason`");
    expect(body).toMatch(/get a `depends-on`, never a worktree/);
  });

  it("execute handles the worktree refusals and starts shared parts first", () => {
    const { body } = readSkill("execute");
    expect(body).toMatch(
      /`policy\/merge-conflict`[^\n]*`bdk attempt open verify-fix <part> --json`/,
    );
    expect(body).toContain("`policy/merge-blocked`");
    expect(body).toContain("`runtime/worktree-setup-failed`");
    expect(body).toMatch(/Start the `shared` parts of the wave first, then the worktree parts/);
    expect(body).toMatch(/never set the host's own `isolation: worktree`/);
  });
});
