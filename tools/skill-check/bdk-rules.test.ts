// Unit tests for the `bdk/*` rules, run in process through the kit's tester.
// The seeded fixtures in contract/ cover the same rules through the CLI.
import { checkRule } from "bdk-skill-kit/testing";
import { describe, expect, it } from "vitest";

import bdk, {
  adapterShape,
  CONTENT_WRAPPER_PATTERN,
  craftNoKernel,
  gateDisallowedTools,
  gateInvocation,
  KERNEL_TOOL_RULES,
  namespacedRefs,
  noLanguageCommands,
  noMcpTools,
  wrapperAllowedTools,
  wrapperForm,
} from "./bdk-rules.ts";

const [KERNEL_RULE = "", ECHO_RULE = ""] = KERNEL_TOOL_RULES;
const WRAPPER =
  '!`node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" ctx skill review 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."`';

function skill(name: string, frontmatter: string, body: string): Record<string, string> {
  return {
    [`${name}/SKILL.md`]: `---\nname: ${name}\ndescription: Does ${name}. Use when needed.\n${frontmatter}---\n\n${body}\n`,
  };
}

const lines = (findings: { line: number }[]) => findings.map((f) => f.line);

describe("plugin", () => {
  it("ships the nine rules under the bdk prefix", () => {
    expect(bdk.name).toBe("bdk");
    expect(bdk.rules.map((r) => r.id)).toHaveLength(9);
  });

  it("the wrapper pattern accepts the wrapper line", () => {
    expect(new RegExp(CONTENT_WRAPPER_PATTERN).test(WRAPPER)).toBe(true);
  });
});

describe("wrapper-form", () => {
  it("accepts the whole-line wrapper", async () => {
    expect(await checkRule(wrapperForm, { files: skill("review", "", WRAPPER) })).toEqual([]);
  });

  it("reports any other block, at line start or after whitespace", async () => {
    const body = "!`python3 inject.py --if x`\nRun this: !`date`\nPlain `code` and a bang! here.";
    const findings = await checkRule(wrapperForm, { files: skill("review", "", body) });
    expect(lines(findings)).toEqual([6, 7]);
  });

  it("reports a block inside a code fence, which the host runs too", async () => {
    const body = "Example:\n```md\n!`date`\n```";
    expect(lines(await checkRule(wrapperForm, { files: skill("review", "", body) }))).toEqual([8]);
  });

  it("checks agents too", async () => {
    const files = { "reader.md": "---\nname: reader\ndescription: Reads.\n---\n\n!`date`\n" };
    expect(lines(await checkRule(wrapperForm, { kind: "agents", files }))).toEqual([6]);
  });
});

describe("wrapper-allowed-tools", () => {
  it("ignores a skill without a block", async () => {
    expect(await checkRule(wrapperAllowedTools, { files: skill("plain", "", "Text.") })).toEqual(
      [],
    );
  });

  it("accepts the rule pair in a space-separated string", async () => {
    const files = skill("review", `allowed-tools: Read ${KERNEL_RULE} ${ECHO_RULE}\n`, WRAPPER);
    expect(await checkRule(wrapperAllowedTools, { files })).toEqual([]);
  });

  it("accepts the rule pair in a YAML list", async () => {
    const list = `allowed-tools:\n  - Read\n  - '${KERNEL_RULE}'\n  - ${ECHO_RULE}\n`;
    expect(await checkRule(wrapperAllowedTools, { files: skill("review", list, WRAPPER) })).toEqual(
      [],
    );
  });

  it.each([
    ["the unquoted rule", "Bash(node ${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs *) Bash(echo *)", "node"],
    ["the kernel rule without echo", KERNEL_RULE, "echo"],
  ])("reports %s and names what is missing", async (_, tools, missing) => {
    const files = skill("review", `allowed-tools: ${tools}\n`, WRAPPER);
    const findings = await checkRule(wrapperAllowedTools, { files });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain(`\`Bash(${missing}`);
  });

  it("reports a missing field at line 1 and a wrong one at its key", async () => {
    expect(
      lines(await checkRule(wrapperAllowedTools, { files: skill("review", "", WRAPPER) })),
    ).toEqual([1]);
    const files = skill("review", "allowed-tools: Bash(git *)\n", WRAPPER);
    expect(lines(await checkRule(wrapperAllowedTools, { files }))).toEqual([4]);
  });

  it("treats a non-list value as empty", async () => {
    const files = skill("review", "allowed-tools: 3\n", WRAPPER);
    expect(await checkRule(wrapperAllowedTools, { files })).toHaveLength(1);
  });
});

describe("no-mcp-tools", () => {
  it("reports a BDK MCP tool name on each line", async () => {
    const body = "Call mcp__plugin_bdk_state.\nThen mcp__other_tool is fine.";
    expect(lines(await checkRule(noMcpTools, { files: skill("s", "", body) }))).toEqual([6]);
  });
});

describe("gate-invocation", () => {
  it("reports a gate without disable-model-invocation", async () => {
    const findings = await checkRule(gateInvocation, { files: skill("plan", "", "Body.") });
    expect(findings).toEqual([expect.objectContaining({ rule: "gate-invocation", line: 2 })]);
  });

  it("accepts a gate with the field and ignores other skills", async () => {
    const files = {
      ...skill("run", "disable-model-invocation: true\n", "Body."),
      ...skill("docs", "", "Body."),
    };
    expect(await checkRule(gateInvocation, { files })).toEqual([]);
  });

  it("reports a false value at its key and takes the gate list from options", async () => {
    const files = skill("ship", "disable-model-invocation: false\n", "Body.");
    expect(lines(await checkRule(gateInvocation, { files, options: { gates: ["ship"] } }))).toEqual(
      [4],
    );
  });

  it("falls back to the directory name when name is missing", async () => {
    const files = { "close/SKILL.md": "---\ndescription: Closes. Use when done.\n---\n\nBody.\n" };
    expect(await checkRule(gateInvocation, { files })).toHaveLength(1);
  });
});

describe("gate-disallowed-tools", () => {
  it("names the missing tools", async () => {
    const files = skill("execute", "disallowed-tools: Edit Write\n", "Body.");
    const [finding] = await checkRule(gateDisallowedTools, { files });
    expect(finding?.line).toBe(4);
    expect(finding?.message).toContain("`NotebookEdit`");
    expect(finding?.message).not.toContain("`Edit`,");
  });

  it("reports a missing field at the name line", async () => {
    expect(
      lines(await checkRule(gateDisallowedTools, { files: skill("close", "", "Body.") })),
    ).toEqual([2]);
  });

  it("accepts all three tools, and skips gates that may edit", async () => {
    const files = {
      ...skill("execute", "disallowed-tools: [Edit, Write, NotebookEdit]\n", "Body."),
      ...skill("plan", "", "Body."),
    };
    expect(await checkRule(gateDisallowedTools, { files })).toEqual([]);
  });
});

describe("adapter-shape", () => {
  const agent = (body: string) => ({
    kind: "agents" as const,
    files: {
      "reviewer.md": `---\nname: reviewer\ndescription: Reviews.\nmodel: inherit\n---\n\n${body}\n`,
    },
  });

  it("accepts one sentence ending in a period", async () => {
    expect(
      await checkRule(adapterShape, agent("Load the review role with /bdk:review and follow it.")),
    ).toEqual([]);
  });

  it.each([
    ["two sentences", "Load the role. Then follow it."],
    ["two lines", "Load the role\nand follow it."],
    ["no period", "Load the role and follow it"],
    ["an empty body", ""],
  ])("reports %s", async (_, body) => {
    const findings = await checkRule(adapterShape, agent(body));
    expect(findings).toEqual([expect.objectContaining({ rule: "adapter-shape", line: 6 })]);
  });

  it("keeps the fingerprint when the counts change", async () => {
    const [a] = await checkRule(adapterShape, agent("One. Two."));
    const [b] = await checkRule(adapterShape, agent("One. Two. Three."));
    expect(a?.fingerprint).toBe(b?.fingerprint);
  });
});

describe("craft-no-kernel", () => {
  const body = "Read ${CLAUDE_PLUGIN_ROOT}/x.\n!`date`\nPlain text.";

  it("reports kernel coupling in a portable skill", async () => {
    const findings = await checkRule(craftNoKernel, {
      profile: "portable",
      files: skill("tdd", "", body),
    });
    expect(lines(findings)).toEqual([6, 7]);
  });

  it("ignores skills outside the portable profile", async () => {
    expect(await checkRule(craftNoKernel, { files: skill("tdd", "", body) })).toEqual([]);
  });
});

describe("no-language-commands", () => {
  it("reports unambiguous commands anywhere", async () => {
    const body = "Run pytest here.\nThen npm  test, and eslint-plugin is fine.";
    const findings = await checkRule(noLanguageCommands, { files: skill("s", "", body) });
    expect(findings.map((f) => [f.line, f.message.split("`")[1]])).toEqual([
      [6, "pytest"],
      [7, "npm  test"],
    ]);
  });

  it("reports ambiguous words only in code spans and fences", async () => {
    const body = "Make sure to go test it.\nRun `make build`.\n```\njest --watch\n```";
    const findings = await checkRule(noLanguageCommands, { files: skill("s", "", body) });
    expect(findings.map((f) => [f.line, f.message.split("`")[1]])).toEqual([
      [7, "make"],
      [9, "jest"],
    ]);
  });

  it("reports one finding per command on a line", async () => {
    const findings = await checkRule(noLanguageCommands, {
      files: skill("s", "", "pytest or pytest, then ruff."),
    });
    expect(findings).toHaveLength(2);
  });

  it("exempts the allowed skills", async () => {
    expect(
      await checkRule(noLanguageCommands, { files: skill("setup", "", "Detect pytest.") }),
    ).toEqual([]);
    const files = skill("probe", "", "Detect pytest.");
    expect(await checkRule(noLanguageCommands, { files, options: { allow: ["probe"] } })).toEqual(
      [],
    );
  });

  it("names an agent by its file name", async () => {
    const files = { "runner.md": "---\ndescription: Runs.\n---\n\nRun pytest.\n" };
    const findings = await checkRule(noLanguageCommands, {
      kind: "agents",
      files,
      options: { allow: ["runner"] },
    });
    expect(findings).toEqual([]);
  });
});

describe("namespaced-refs", () => {
  const files = (body: string) => ({ ...skill("plan", "", "Body."), ...skill("review", "", body) });

  it("reports a bare reference to a BDK skill", async () => {
    const findings = await checkRule(namespacedRefs, { files: files("Hand the result to /plan.") });
    expect(findings).toEqual([
      expect.objectContaining({
        rule: "namespaced-refs",
        file: "review/SKILL.md",
        line: 6,
        severity: "error",
      }),
    ]);
  });

  it("warns on another plugin's skill", async () => {
    const findings = await checkRule(namespacedRefs, { files: files("Then run /caveman:commit.") });
    expect(findings).toEqual([expect.objectContaining({ severity: "warning" })]);
  });

  it.each([
    ["the namespaced form", "Then run /bdk:plan."],
    ["an unknown name", "Then run /deploy."],
    ["a path", "See docs/plan and /plan.md and /plan/x."],
    ["a URL", "See https://x.dev/plan."],
  ])("accepts %s", async (_, body) => {
    expect(await checkRule(namespacedRefs, { files: files(body) })).toEqual([]);
  });

  it("reports a bare subagent_type and accepts the namespaced one", async () => {
    const body = 'subagent_type: "plan"\nsubagent_type: bdk:plan\nsubagent_type: other';
    expect(lines(await checkRule(namespacedRefs, { files: files(body) }))).toEqual([6]);
  });
});
