import { describe, expect, it } from "vitest";
import type { Finding, Rule } from "../index.ts";
import { checkRule } from "../testing.ts";
import {
  blockAllowedTools,
  blockForm,
  bodyShape,
  forbiddenText,
  namespacedRefs,
  requiredFields,
} from "./policy.ts";

function skill(name: string, frontmatter: string, body: string): Record<string, string> {
  return {
    [`${name}/SKILL.md`]: `---\nname: ${name}\ndescription: Does ${name}. Use when needed.\n${frontmatter}---\n\n${body}\n`,
  };
}

const lines = (findings: Finding[]) => findings.map((f) => f.line);

/** The problem `validateOptions` finds in `options`, merged over the defaults. */
function problem<O extends object>(rule: Rule<O>, options: object): string | undefined {
  return rule.validateOptions?.({ ...rule.defaultOptions, ...options });
}

const BLOCK = "!`tool ctx review`";
const FORM = "!`tool (ctx [a-z]+|next)`";
const TOOLS = ['Bash(node "${CLAUDE_PLUGIN_ROOT}/dist/tool.mjs" *)', "Bash(echo *)"];

describe("block-form", () => {
  const options = { patterns: [FORM] };

  it("accepts a whole line that matches a pattern", async () => {
    expect(await checkRule(blockForm, { files: skill("review", "", BLOCK), options })).toEqual([]);
  });

  it("reports any other block, at line start or after whitespace", async () => {
    const body = "!`python3 inject.py`\nRun this: !`date`\nPlain `code` and a bang! here.";
    const findings = await checkRule(blockForm, { files: skill("review", "", body), options });
    expect(lines(findings)).toEqual([6, 7]);
    expect(findings[0]?.message).toContain("option `patterns`");
  });

  it("requires the pattern to cover the whole line", async () => {
    const body = `${BLOCK} and more`;
    expect(
      lines(await checkRule(blockForm, { files: skill("review", "", body), options })),
    ).toEqual([6]);
  });

  it("reports a block inside a code fence and a multi-line block, which the host runs too", async () => {
    const body = "Example:\n```md\n!`date`\n```\n\n```!\ndate\n```";
    const findings = await checkRule(blockForm, { files: skill("review", "", body), options });
    expect(lines(findings)).toEqual([8, 11]);
  });

  it("allows no block without patterns", async () => {
    const findings = await checkRule(blockForm, { files: skill("review", "", BLOCK) });
    expect(lines(findings)).toEqual([6]);
    expect(findings[0]?.message).toContain("allows none");
  });

  it("ignores the frontmatter and checks agents too", async () => {
    const files = { "reader.md": "---\nname: reader\ndescription: Runs !`x`.\n---\n\n!`date`\n" };
    expect(lines(await checkRule(blockForm, { kind: "agents", files }))).toEqual([6]);
  });

  it("keys the fingerprint on the line text", async () => {
    const [a] = await checkRule(blockForm, { files: skill("review", "", "!`date`") });
    const [b] = await checkRule(blockForm, { files: skill("review", "", "Intro.\n\n!`date`") });
    expect(a?.fingerprint).toBe(b?.fingerprint);
  });

  it.each([
    [{ patterns: "x" }, "option `patterns` must be a list of regular expressions"],
    [{ patterns: ["("] }, "option `patterns`: `(` is not a valid regular expression"],
  ])("rejects the options %j", (options, message) => {
    expect(problem(blockForm, options)).toBe(message);
  });

  it("accepts no options", () => {
    expect(problem(blockForm, {})).toBeUndefined();
  });
});

describe("block-allowed-tools", () => {
  const options = { require: TOOLS };
  const [NODE = "", ECHO = ""] = TOOLS;

  it("ignores a skill without a block", async () => {
    expect(
      await checkRule(blockAllowedTools, { files: skill("plain", "", "Text."), options }),
    ).toEqual([]);
  });

  it("accepts the entries in a space-separated string", async () => {
    const files = skill("review", `allowed-tools: Read ${NODE} ${ECHO}\n`, BLOCK);
    expect(await checkRule(blockAllowedTools, { files, options })).toEqual([]);
  });

  it("accepts the entries in a YAML list", async () => {
    const list = `allowed-tools:\n  - Read\n  - '${NODE}'\n  - ${ECHO}\n`;
    expect(
      await checkRule(blockAllowedTools, { files: skill("review", list, BLOCK), options }),
    ).toEqual([]);
  });

  it.each([
    ["an unquoted entry", "Bash(node ${CLAUDE_PLUGIN_ROOT}/dist/tool.mjs *) Bash(echo *)", "node"],
    ["a missing entry", NODE, "echo"],
  ])("reports %s and names what is missing", async (_, tools, missing) => {
    const files = skill("review", `allowed-tools: ${tools}\n`, BLOCK);
    const findings = await checkRule(blockAllowedTools, { files, options });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain(`\`Bash(${missing}`);
  });

  it("reports a missing field at line 1 and a wrong one at its key", async () => {
    expect(
      lines(await checkRule(blockAllowedTools, { files: skill("review", "", BLOCK), options })),
    ).toEqual([1]);
    const files = skill("review", "allowed-tools: Bash(git *)\n", BLOCK);
    expect(lines(await checkRule(blockAllowedTools, { files, options }))).toEqual([4]);
  });

  it("treats a non-list value as empty", async () => {
    const files = skill("review", "allowed-tools: 3\n", BLOCK);
    expect(await checkRule(blockAllowedTools, { files, options })).toHaveLength(1);
  });

  it("keeps the fingerprint when the missing entries change", async () => {
    const [a] = await checkRule(blockAllowedTools, { files: skill("r", "", BLOCK), options });
    const files = skill("r", `allowed-tools: ${ECHO}\n`, BLOCK);
    const [b] = await checkRule(blockAllowedTools, { files, options });
    expect(a?.fingerprint).toBe(b?.fingerprint);
  });

  it.each([[{}], [{ require: [] }], [{ require: [1] }]])("rejects the options %j", (options) => {
    expect(problem(blockAllowedTools, options)).toBe(
      "option `require` must list at least one `allowed-tools` entry",
    );
  });
});

describe("forbidden-text", () => {
  const mcp = { words: ["mcp__plugin_acme_"], match: "substring" as const, message: "no MCP" };
  const stack = {
    words: ["pytest", "npm test", "eslint"],
    message: "names one stack's tooling",
    allow: ["setup"],
  };
  const ambiguous = { words: ["go test", "jest", "make"], where: "code" as const, message: "x" };
  const options = { terms: [mcp, stack, ambiguous] };
  const found = (findings: Finding[]) =>
    findings.map((f) => [f.line, f.message.split("`")[1] ?? ""]);

  it("reports a substring anywhere, also in the frontmatter", async () => {
    const files = skill("s", "allowed-tools: mcp__plugin_acme_state\n", "Call mcp__plugin_acme_x.");
    const findings = await checkRule(forbiddenText, { files, options });
    expect(found(findings)).toEqual([
      [4, "mcp__plugin_acme_"],
      [7, "mcp__plugin_acme_"],
    ]);
    expect(findings[0]?.message).toBe("`mcp__plugin_acme_`: no MCP");
  });

  it("matches whole words, with any run of whitespace inside a phrase", async () => {
    const body = "Run pytest here.\nThen npm  test, and eslint-plugin or pytests are fine.";
    const findings = await checkRule(forbiddenText, { files: skill("s", "", body), options });
    expect(found(findings)).toEqual([
      [6, "pytest"],
      [7, "npm  test"],
    ]);
  });

  it("reports code-only words only in code spans and fences", async () => {
    const body = "Make sure to go test it.\nRun `make build`.\n```\njest --watch\n```";
    const findings = await checkRule(forbiddenText, { files: skill("s", "", body), options });
    expect(found(findings)).toEqual([
      [7, "make"],
      [9, "jest"],
    ]);
  });

  it("reports one finding per distinct term on a line", async () => {
    const files = skill("s", "", "pytest or pytest, then eslint.");
    expect(await checkRule(forbiddenText, { files, options })).toHaveLength(2);
  });

  it("exempts the allowed names per term", async () => {
    const files = skill("setup", "", "Detect pytest and mcp__plugin_acme_x.");
    expect(found(await checkRule(forbiddenText, { files, options }))).toEqual([
      [6, "mcp__plugin_acme_"],
    ]);
  });

  it("names an agent by its file name", async () => {
    const files = { "setup.md": "---\ndescription: Runs.\n---\n\nRun pytest.\n" };
    expect(await checkRule(forbiddenText, { kind: "agents", files, options })).toEqual([]);
  });

  it("keys the fingerprint on the term and the line text", async () => {
    const [a] = await checkRule(forbiddenText, { files: skill("s", "", "Run pytest."), options });
    const files = skill("s", "", "Intro.\n\nRun pytest.");
    const [b] = await checkRule(forbiddenText, { files, options });
    expect(a?.fingerprint).toBe(b?.fingerprint);
  });

  it.each([
    [{}, "option `terms` must list at least one term"],
    [
      { terms: [{ words: [], message: "m" }] },
      "option `terms[0]`: `words` must list at least one word",
    ],
    [{ terms: [{ words: ["a"] }] }, "option `terms[0]`: `message` must be a non-empty string"],
    [
      { terms: [{ words: ["a"], message: "m", match: "regex" }] },
      "option `terms[0]`: `match` must be word or substring",
    ],
    [
      { terms: [{ words: ["a"], message: "m", where: "prose" }] },
      "option `terms[0]`: `where` must be anywhere or code",
    ],
    [
      { terms: [{ words: ["a"], message: "m", allow: "setup" }] },
      "option `terms[0]`: `allow` must be a list of names",
    ],
    [{ terms: ["pytest"] }, "option `terms[0]`: `words` must list at least one word"],
  ])("rejects the options %j", (options, message) => {
    expect(problem(forbiddenText, options)).toBe(message);
  });
});

describe("required-fields", () => {
  const gates = {
    names: ["plan", "run"],
    field: "disable-model-invocation",
    equals: true,
    reason: "only the user starts a gate",
  };
  const readOnly = {
    names: ["execute", "close"],
    field: "disallowed-tools",
    includes: ["Edit", "Write", "NotebookEdit"],
  };
  const options = { entries: [gates, readOnly] };

  it("reports a missing value at the name line, with the reason", async () => {
    const findings = await checkRule(requiredFields, {
      files: skill("plan", "", "Body."),
      options,
    });
    expect(findings).toEqual([
      expect.objectContaining({
        line: 2,
        message: "`plan` must set `disable-model-invocation: true`; only the user starts a gate",
      }),
    ]);
  });

  it("reports a wrong value at its key", async () => {
    const files = skill("run", "disable-model-invocation: false\n", "Body.");
    expect(lines(await checkRule(requiredFields, { files, options }))).toEqual([4]);
  });

  it("accepts the value and ignores other names", async () => {
    const files = {
      ...skill("run", "disable-model-invocation: true\n", "Body."),
      ...skill("docs", "", "Body."),
    };
    expect(await checkRule(requiredFields, { files, options })).toEqual([]);
  });

  it("falls back to the directory name when name is missing", async () => {
    const files = { "run/SKILL.md": "---\ndescription: Runs. Use when done.\n---\n\nBody.\n" };
    expect(lines(await checkRule(requiredFields, { files, options }))).toEqual([1]);
  });

  it("names the missing entries of a list field", async () => {
    const files = skill("execute", "disallowed-tools: Edit Write\n", "Body.");
    const [finding] = await checkRule(requiredFields, { files, options });
    expect(finding).toMatchObject({
      line: 4,
      message: "`execute` must list `NotebookEdit` in `disallowed-tools`",
    });
  });

  it("reads a YAML list and a string split outside parentheses", async () => {
    const files = {
      ...skill("execute", "disallowed-tools: [Edit, Write, NotebookEdit]\n", "Body."),
      ...skill("close", "disallowed-tools: Bash(a *, b *), Edit, Write NotebookEdit\n", "Body."),
    };
    expect(await checkRule(requiredFields, { files, options })).toEqual([]);
  });

  it("keeps the fingerprint when the missing entries change", async () => {
    const [a] = await checkRule(requiredFields, { files: skill("close", "", "B."), options });
    const files = skill("close", "disallowed-tools: Edit\n", "B.");
    const [b] = await checkRule(requiredFields, { files, options });
    expect(a?.fingerprint).toBe(b?.fingerprint);
  });

  it("skips a document whose frontmatter does not parse", async () => {
    const files = { "plan/SKILL.md": "---\nname: [\n---\n\nBody.\n" };
    expect(await checkRule(requiredFields, { files, options })).toEqual([]);
  });

  it("checks agents by file name", async () => {
    const files = { "plan.md": "---\ndescription: Plans.\n---\n\nBody.\n" };
    expect(lines(await checkRule(requiredFields, { kind: "agents", files, options }))).toEqual([1]);
  });

  it.each([
    [{}, "option `entries` must list at least one entry"],
    [
      { entries: [{ names: [], field: "x", equals: 1 }] },
      "option `entries[0]`: `names` must list at least one name",
    ],
    [
      { entries: [{ names: ["a"], equals: 1 }] },
      "option `entries[0]`: `field` must be a non-empty string",
    ],
    [
      { entries: [{ names: ["a"], field: "x" }] },
      "option `entries[0]`: set `equals`, `includes` or both",
    ],
    [
      { entries: [{ names: ["a"], field: "x", includes: "Edit" }] },
      "option `entries[0]`: `includes` must be a list of strings",
    ],
    [
      { entries: [{ names: ["a"], field: "x", equals: 1, reason: 2 }] },
      "option `entries[0]`: `reason` must be a string",
    ],
  ])("rejects the options %j", (options, message) => {
    expect(problem(requiredFields, options)).toBe(message);
  });
});

describe("body-shape", () => {
  const options = { maxLines: 1, maxSentences: 1, endsWith: "." };
  const agent = (body: string) => ({
    kind: "agents" as const,
    options,
    files: {
      "reviewer.md": `---\nname: reviewer\ndescription: Reviews.\nmodel: inherit\n---\n\n${body}\n`,
    },
  });

  it("accepts one sentence ending in a period", async () => {
    expect(
      await checkRule(bodyShape, agent("Load the review role with /x:review, then follow it.")),
    ).toEqual([]);
  });

  it.each([
    ["two sentences", "Load the role. Then follow it.", "2 sentences (limit 1)"],
    ["two lines", "Load the role\nand follow it.", "2 non-blank lines (limit 1)"],
    ["no period", "Load the role and follow it", "no final `.`"],
    ["an empty body", "", "no final `.`"],
  ])("reports %s", async (_, body, detail) => {
    const findings = await checkRule(bodyShape, agent(body));
    expect(findings.map((f) => [f.rule, f.line])).toEqual([["body-shape", 6]]);
    expect(findings[0]?.message).toContain(detail);
  });

  it("keeps the fingerprint when the counts change", async () => {
    const [a] = await checkRule(bodyShape, agent("One. Two."));
    const [b] = await checkRule(bodyShape, agent("One. Two. Three."));
    expect(a?.fingerprint).toBe(b?.fingerprint);
  });

  it("checks only the limits it is given", async () => {
    const files = skill("s", "", "One. Two.\nThree");
    expect(await checkRule(bodyShape, { files, options: { maxLines: 2 } })).toEqual([]);
  });

  it("skips a file whose frontmatter is not closed", async () => {
    const files = { "s/SKILL.md": "---\nname: s\n\nOne. Two.\n" };
    expect(await checkRule(bodyShape, { files, options })).toEqual([]);
  });

  it.each([
    [{}, "set at least one of the options `maxLines`, `maxSentences` and `endsWith`"],
    [{ maxLines: 0 }, "option `maxLines` must be a positive integer"],
    [{ maxSentences: 1.5 }, "option `maxSentences` must be a positive integer"],
    [{ endsWith: "" }, "option `endsWith` must be a non-empty string"],
  ])("rejects the options %j", (options, message) => {
    expect(problem(bodyShape, options)).toBe(message);
  });
});

describe("namespaced-refs", () => {
  const options = { namespace: "acme" };
  const files = (body: string) => ({ ...skill("plan", "", "Body."), ...skill("review", "", body) });

  it("reports a bare reference to a checked skill", async () => {
    const findings = await checkRule(namespacedRefs, {
      files: files("Hand the result to /plan."),
      options,
    });
    expect(findings).toEqual([
      expect.objectContaining({
        rule: "namespaced-refs",
        file: "review/SKILL.md",
        line: 6,
        severity: "error",
        message:
          "write `/acme:plan`, not `/plan`; an unqualified name can resolve to another plugin's skill",
      }),
    ]);
  });

  it("warns on another plugin's skill, or ignores it when foreign is off", async () => {
    const body = files("Then run /caveman:commit.");
    expect(await checkRule(namespacedRefs, { files: body, options })).toEqual([
      expect.objectContaining({ severity: "warning" }),
    ]);
    expect(
      await checkRule(namespacedRefs, { files: body, options: { ...options, foreign: "off" } }),
    ).toEqual([]);
  });

  it.each([
    ["the namespaced form", "Then run /acme:plan."],
    ["an unknown name", "Then run /deploy."],
    ["a path", "See docs/plan and /plan.md and /plan/x."],
    ["a URL", "See https://x.dev/plan."],
  ])("accepts %s", async (_, body) => {
    expect(await checkRule(namespacedRefs, { files: files(body), options })).toEqual([]);
  });

  it("reports a bare subagent_type of a checked agent and accepts the namespaced one", async () => {
    const body = 'subagent_type: "plan"\nsubagent_type: acme:plan\nsubagent_type: other';
    const findings = await checkRule(namespacedRefs, { files: files(body), options });
    expect(findings.map((f) => [f.line, f.message])).toEqual([
      [
        6,
        "write `subagent_type: acme:plan`; a plugin agent is registered under its plugin's namespace",
      ],
    ]);
  });

  it.each([
    [{}, "option `namespace` must be a kebab-case plugin name"],
    [{ namespace: "Acme" }, "option `namespace` must be a kebab-case plugin name"],
    [{ namespace: "acme", foreign: "error" }, "option `foreign` must be warning or off"],
  ])("rejects the options %j", (options, message) => {
    expect(problem(namespacedRefs, options)).toBe(message);
  });
});
