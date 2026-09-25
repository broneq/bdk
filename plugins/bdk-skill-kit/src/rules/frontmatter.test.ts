import { describe, expect, it } from "vitest";
import type { Document, Report, Rule } from "../index.ts";
import { agent, doc, skill } from "../test-helpers.ts";
import { checkRule } from "../testing.ts";
import {
  description,
  descriptionFrontLoaded,
  fieldValues,
  fields,
  frontmatter,
  invocation,
  nameFormat,
  nameMatchesDir,
  requireModel,
  skillFileName,
} from "./frontmatter.ts";

function run<O>(rule: Rule<O>, d: Document, options: Partial<O> = {}): Report[] {
  const reports: Report[] = [];
  rule.check?.(d, {
    options: { ...(rule.defaultOptions ?? ({} as O)), ...options },
    root: "/",
    report: (r) => reports.push(r),
  });
  return reports;
}

const messages = (reports: Report[]) => reports.map((r) => r.message);

describe("frontmatter", () => {
  it("passes a closed map", () => {
    expect(run(frontmatter, doc(skill("demo")))).toEqual([]);
  });

  it("reports the parse error at line 1", () => {
    expect(run(frontmatter, doc("# no frontmatter\n"))).toEqual([
      {
        line: 1,
        message: "the file does not open with a `---` frontmatter block",
        match: "frontmatter",
      },
    ]);
  });
});

describe("name-format", () => {
  it.each(["demo", "a", "pdf-processing-2"])("accepts %s", (name) => {
    expect(run(nameFormat, doc(skill(name)))).toEqual([]);
  });

  it.each([
    [
      "PDF",
      "`name` must be lowercase letters, digits and single hyphens, not at either end: `PDF`",
    ],
    [
      "-pdf",
      "`name` must be lowercase letters, digits and single hyphens, not at either end: `-pdf`",
    ],
    [
      "pdf--x",
      "`name` must be lowercase letters, digits and single hyphens, not at either end: `pdf--x`",
    ],
    ["a".repeat(65), "`name` is 65 characters; the limit is 64"],
  ])("rejects %s", (name, message) => {
    expect(messages(run(nameFormat, doc(skill(name))))).toEqual([message]);
  });

  it("reports a missing name at line 1 and a non-string name at its key", () => {
    expect(run(nameFormat, doc("---\ndescription: x\n---\nBody\n"))).toEqual([
      { line: 1, message: "`name` is missing" },
    ]);
    expect(run(nameFormat, doc("---\nname: 12\n---\nBody\n"))).toEqual([
      { line: 2, message: "`name` must be a string" },
    ]);
  });

  it("enforces the prefix option", () => {
    expect(messages(run(nameFormat, doc(skill("demo")), { prefix: "bmad-" }))).toEqual([
      "`name` must start with `bmad-`: `demo`",
    ]);
    expect(run(nameFormat, doc(skill("bmad-demo")), { prefix: "bmad-" })).toEqual([]);
  });

  it("skips a document whose frontmatter is unusable", () => {
    expect(run(nameFormat, doc("# none\n"))).toEqual([]);
  });
});

describe("name-matches-dir", () => {
  it("passes when name equals the directory", () => {
    expect(run(nameMatchesDir, doc(skill("demo")))).toEqual([]);
  });

  it("reports a mismatch at the name key", () => {
    expect(run(nameMatchesDir, doc(skill("other")))).toEqual([
      { line: 2, message: "`name` is `other` but the skill directory is `demo`" },
    ]);
  });
});

describe("skill-file-name", () => {
  it("passes SKILL.md", () => {
    expect(run(skillFileName, doc(skill("demo")))).toEqual([]);
  });

  it("reports a skill file in another letter case", () => {
    expect(
      messages(run(skillFileName, doc(skill("demo"), { path: "skills/demo/skill.md" }))),
    ).toEqual(["the skill file is `skill.md`; hosts load only `SKILL.md`"]);
  });

  it("reports stray directories as a project rule", () => {
    const reports: Report[] = [];
    skillFileName.checkProject?.([], {
      options: {},
      root: "/",
      strays: ["skills/loose"],
      report: (r) => reports.push(r),
    });
    expect(reports).toEqual([
      { file: "skills/loose", message: "the directory holds Markdown but no `SKILL.md`" },
    ]);
  });
});

describe("description", () => {
  it("counts description plus when_to_use against 1,536 in claude-code", () => {
    const long = "x".repeat(1000);
    const d = doc(`---\nname: demo\ndescription: ${long}\nwhen_to_use: ${long}\n---\nBody\n`);
    expect(messages(run(description, d))).toEqual([
      "`description` plus `when_to_use` is 2000 characters; the limit is 1536",
    ]);
  });

  it("counts description against 1,024 in portable", () => {
    const d = doc(`---\nname: demo\ndescription: ${"x".repeat(1025)}\n---\nBody\n`, {
      profile: "portable",
    });
    expect(messages(run(description, d))).toEqual([
      "`description` is 1025 characters; the limit is 1024",
    ]);
  });

  it("uses the max option", () => {
    expect(messages(run(description, doc(skill("demo")), { max: 10 }))).toEqual([
      "`description` is 48 characters; the limit is 10",
    ]);
  });

  it.each([
    ["---\nname: demo\n---\nBody\n", "`description` is missing"],
    ["---\nname: demo\ndescription: ''\n---\nBody\n", "`description` is empty"],
    ["---\nname: demo\ndescription: [a]\n---\nBody\n", "`description` must be a string"],
  ])("reports %j", (text, message) => {
    expect(messages(run(description, doc(text)))).toEqual([message]);
  });

  it("checks agents too", () => {
    expect(run(description, doc(agent("rev"), { kind: "agents" }))).toEqual([]);
  });
});

describe("description-front-loaded", () => {
  it("passes a verb-first description with a trigger", () => {
    expect(run(descriptionFrontLoaded, doc(skill("demo")))).toEqual([]);
  });

  it("reports an opening filler", () => {
    const d = doc(
      "---\nname: demo\ndescription: This skill checks things. Use when needed.\n---\nBody\n",
    );
    expect(messages(run(descriptionFrontLoaded, d))).toEqual([
      "`description` opens with filler (`This skill`); lead with what the skill does",
    ]);
  });

  it("reports a missing trigger clause", () => {
    const d = doc("---\nname: demo\ndescription: Checks things.\n---\nBody\n");
    expect(messages(run(descriptionFrontLoaded, d))).toEqual([
      "`description` has no trigger clause matching /\\bUse (when|for|on|if|whenever)\\b/i",
    ]);
  });

  it("uses the trigger option", () => {
    const d = doc("---\nname: demo\ndescription: Checks things. Trigger on review.\n---\nBody\n");
    expect(run(descriptionFrontLoaded, d, { trigger: "\\bTrigger on\\b" })).toEqual([]);
  });
});

describe("fields", () => {
  it("accepts every claude-code skill field", () => {
    const extra =
      "when_to_use: x\nargument-hint: x\narguments: a b\ndisable-model-invocation: true\nuser-invocable: true\n" +
      "allowed-tools: Read\ndisallowed-tools: Edit\nmodel: inherit\neffort: low\ncontext: fork\nagent: Explore\n" +
      "background: true\nhooks: {}\npaths: '*.md'\nshell: bash\nlicense: MIT\ncompatibility: x\nmetadata: {}\n";
    expect(run(fields, doc(skill("demo", extra)))).toEqual([]);
  });

  it("rejects a Claude-only field in the portable profile", () => {
    const d = doc(skill("demo", "disable-model-invocation: true\n"), { profile: "portable" });
    expect(run(fields, d)).toEqual([
      {
        line: 4,
        message:
          "`disable-model-invocation` is not a field of the portable profile (Agent Skills standard: name, description, license, compatibility, metadata, allowed-tools)",
        match: "disable-model-invocation",
      },
    ]);
  });

  it("rejects a misspelled field", () => {
    expect(messages(run(fields, doc(skill("demo", "disable-model-invokation: true\n"))))).toEqual([
      "`disable-model-invokation` is not a field of the claude-code skills profile",
    ]);
  });

  it("accepts agent fields and names the plugin restriction", () => {
    const extra = "tools: Read\nmodel: inherit\nmaxTurns: 3\ncolor: red\npermissionMode: plan\n";
    expect(messages(run(fields, doc(agent("rev", extra), { kind: "agents" })))).toEqual([
      "`permissionMode` is ignored for plugin agents (hooks, mcpServers, permissionMode); move the agent to .claude/agents/ or drop the field",
    ]);
  });
});

describe("field-values", () => {
  it("passes valid values", () => {
    const extra =
      "effort: high\ncontext: fork\nshell: powershell\ndisable-model-invocation: false\ncompatibility: Needs git\n" +
      "metadata:\n  a: b\nallowed-tools: [Read, Grep]\npaths: [a, b]\n";
    expect(run(fieldValues, doc(skill("demo", extra)))).toEqual([]);
  });

  it.each([
    ["effort: huge\n", "`effort` must be one of low, medium, high, xhigh, max"],
    ["context: inline\n", "`context` must be `fork`"],
    ["shell: zsh\n", "`shell` must be bash or powershell"],
    ["user-invocable: yes\n", "`user-invocable` must be true or false"],
    [`compatibility: ${"x".repeat(501)}\n`, "`compatibility` must be a string of 1-500 characters"],
    ["metadata:\n  a: 1\n", "`metadata` must map strings to strings"],
    ["allowed-tools: 3\n", "`allowed-tools` must be a string or a list of strings"],
    ["license: 3\n", "`license` must be a string"],
  ])("rejects %j", (extra, message) => {
    expect(messages(run(fieldValues, doc(skill("demo", extra))))).toEqual([message]);
  });

  it("checks agent tool lists and enums", () => {
    const good =
      "tools: Read, Bash(git *), Agent(worker), mcp__github\ndisallowedTools: [Write]\nmaxTurns: 2\nmemory: user\ncolor: blue\nisolation: worktree\n";
    expect(run(fieldValues, doc(agent("rev", good), { kind: "agents" }))).toEqual([]);
    const bad = "tools: read files\nmaxTurns: 0\nmemory: team\ncolor: teal\nisolation: box\n";
    expect(messages(run(fieldValues, doc(agent("rev", bad), { kind: "agents" })))).toEqual([
      "`tools` entry `read files` is not a tool name, `Name(...)` or `mcp__...`",
      "`maxTurns` must be a positive integer",
      "`memory` must be one of user, project, local",
      "`color` must be one of red, blue, green, yellow, purple, orange, pink, cyan",
      "`isolation` must be `worktree`",
    ]);
  });

  it("leaves unknown fields to the fields rule", () => {
    expect(run(fieldValues, doc(skill("demo", "effort: huge\n"), { profile: "portable" }))).toEqual(
      [],
    );
  });
});

describe("invocation", () => {
  it("reports an unreachable skill", () => {
    const d = doc(skill("demo", "disable-model-invocation: true\nuser-invocable: false\n"));
    expect(run(invocation, d)).toEqual([
      {
        line: 4,
        message:
          "`disable-model-invocation: true` with `user-invocable: false` leaves no way to run the skill",
      },
    ]);
  });

  it("warns on agent without context: fork", () => {
    expect(run(invocation, doc(skill("demo", "agent: Explore\n")))).toEqual([
      { line: 4, severity: "warning", message: "`agent` applies only with `context: fork`" },
    ]);
  });
});

describe("require-model", () => {
  it("reports an agent without model", () => {
    expect(messages(run(requireModel, doc(agent("rev"), { kind: "agents" })))).toEqual([
      "`model` is missing",
    ]);
    expect(run(requireModel, doc(agent("rev", "model: inherit\n"), { kind: "agents" }))).toEqual(
      [],
    );
  });
});

// A baseline entry must survive an edit that leaves the violation in place, so
// no fingerprint may depend on a count, a position or an option value.
describe("stable fingerprints", () => {
  async function fingerprints<O extends object>(
    rule: Rule<O>,
    texts: string[],
    options: Partial<O>[] = [],
  ): Promise<string[]> {
    const out: string[] = [];
    for (const [i, text] of texts.entries()) {
      const found = await checkRule(rule, {
        files: { "demo/SKILL.md": text },
        ...(options[i] === undefined ? {} : { options: options[i] }),
      });
      expect(found).toHaveLength(1);
      out.push(found[0]?.fingerprint ?? "");
    }
    return out;
  }

  it("keeps the name length finding when the length changes", async () => {
    const [a, b] = await fingerprints(nameFormat, [skill("a".repeat(65)), skill("a".repeat(70))]);
    expect(a).toBe(b);
  });

  it("keeps the description length finding when the length changes", async () => {
    const text = (d: string) => `---\nname: demo\ndescription: ${d}\n---\n\nBody.\n`;
    const [a, b, c] = await fingerprints(
      description,
      [text("Checks a thing."), text("Checks a thing twice."), text("Checks a thing.")],
      [{ max: 5 }, { max: 5 }, { max: 6 }],
    );
    expect(a).toBe(b);
    expect(a).toBe(c);
  });

  it("keeps the frontmatter error when its position moves", async () => {
    const [a, b] = await fingerprints(frontmatter, [
      "---\na: 1\na: 2\n---\n",
      "---\nb: 0\na: 1\na: 2\n---\n",
    ]);
    expect(a).toBe(b);
  });

  it("keeps the missing trigger finding when the trigger option changes", async () => {
    const text = skill("demo").replace("Use when a thing needs checking.", "Checks.");
    const [a, b] = await fingerprints(
      descriptionFrontLoaded,
      [text, text],
      [{ trigger: "\\bUse when\\b" }, { trigger: "\\bTrigger\\b" }],
    );
    expect(a).toBe(b);
  });
});
