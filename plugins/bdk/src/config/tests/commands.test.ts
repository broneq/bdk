import { describe, expect, it } from "vitest";

import { run } from "../../shared/cli/index.ts";
import { configGroup } from "../index.ts";
import { CheckResultSchema } from "../schema/check.ts";
import { SetResultSchema } from "../schema/set.ts";
import { ShowResultSchema } from "../schema/show.ts";
import { LOCAL, memory, OPENSPEC, PROJECT, ROOT } from "./memory.ts";

// `bdk config` through the frame: text, `--json` against each output schema, help, exit codes.

function bdk(files: Record<string, string>, ...argv: string[]) {
  const fs = memory(files);
  let stdout = "";
  let stderr = "";
  const exit = run({
    argv,
    version: "0.0.0",
    nodeVersion: "24.0.0",
    groups: [configGroup({ files: fs, cwd: ROOT, home: "/home/me", env: {} })],
    stdout: (text) => (stdout += text),
    stderr: (text) => (stderr += text),
  });
  return exit.then((code) => ({ code, stdout, stderr, fs }));
}

const CONFIGURED = { [PROJECT]: "languages: [typescript]\n", [OPENSPEC]: "" };

describe("bdk config show", () => {
  it("prints one leaf per line with its origin after the layer line", async () => {
    const { code, stdout, stderr } = await bdk(
      { ...CONFIGURED, [LOCAL]: "models:\n  implementer: sonnet\n" },
      "config",
      "show",
    );
    expect([code, stderr]).toEqual([0, ""]);
    const lines = stdout.split("\n");
    expect(lines[0]).toBe(
      `# BDK configuration: root ${ROOT}; layers project .bdk/settings.yaml, local .bdk/settings.local.yaml`,
    );
    expect(lines).toContain('languages: ["typescript"]  # project');
    expect(lines).toContain('models.implementer: "sonnet"  # local');
    expect(lines).toContain('execution.lead: "background"  # default');
    expect(lines).toContain("execution.max-parallel: 10  # default");
  });

  it("prints exactly the stop line with exit 0 when not configured", async () => {
    expect(await bdk({}, "config", "show")).toMatchObject({
      code: 0,
      stdout: "BDK not configured: run /bdk:setup\n",
      stderr: "",
    });
  });

  it("prints the problems of an invalid configuration with exit 0", async () => {
    const { code, stdout } = await bdk(
      { ...CONFIGURED, [LOCAL]: "execution:\n  lead: sideways\n" },
      "config",
      "show",
    );
    expect(code).toBe(0);
    expect(stdout).toMatch(
      /^BDK configuration invalid: run bdk config check\n {2}\.bdk\/settings\.local\.yaml: execution\.lead: Invalid option/,
    );
  });

  it("prints a key without a value as not set", async () => {
    expect((await bdk(CONFIGURED, "config", "show", "models.reviewer")).stdout).toMatch(
      /\nmodels\.reviewer: not set\n$/,
    );
  });

  it("gives JSON valid against its schema in every state", async () => {
    for (const files of [CONFIGURED, {}, { ...CONFIGURED, [LOCAL]: "nope: 1\n" }]) {
      const { code, stdout, stderr } = await bdk(files, "config", "show", "--json");
      expect([code, stderr]).toEqual([0, ""]);
      ShowResultSchema.parse(JSON.parse(stdout));
    }
  });

  it("refuses an unknown key as a usage error", async () => {
    expect(await bdk(CONFIGURED, "config", "show", "plan.part.max-task")).toMatchObject({
      code: 2,
      stdout: "",
      stderr:
        "bdk: plan.part.max-task names no setting\nhint: did you mean plan.part.max-tasks? Run bdk config show for the keys.\n",
    });
  });
});

describe("bdk config check", () => {
  it("names the file and key of an invalid value and exits 1", async () => {
    const { code, stdout } = await bdk(
      { ...CONFIGURED, [PROJECT]: "plan:\n  part:\n    max-files: many\n" },
      "config",
      "check",
    );
    expect(code).toBe(1);
    expect(stdout).toMatch(
      /^configuration invalid: 1 problem\n\.bdk\/settings\.yaml: plan\.part\.max-files: /,
    );
  });

  it("exits 0 for a valid configuration, with JSON valid against its schema", async () => {
    expect((await bdk(CONFIGURED, "config", "check")).stdout).toBe(
      "configuration valid: 1 layer file checked\n",
    );
    const { code, stdout } = await bdk(CONFIGURED, "config", "check", "--json");
    expect(code).toBe(0);
    expect(CheckResultSchema.parse(JSON.parse(stdout)).problems).toEqual([]);
  });
});

describe("bdk config set", () => {
  it("writes the key and prints it with its layer", async () => {
    const { code, stdout, fs } = await bdk(
      CONFIGURED,
      "config",
      "set",
      "plan.part.max-tasks",
      "7",
      "--layer",
      "local",
    );
    expect(code).toBe(0);
    expect(stdout).toBe(`plan.part.max-tasks: 7  # local ${LOCAL}\n`);
    expect(fs.data.get(LOCAL)).toBe("plan:\n  part:\n    max-tasks: 7\n");
  });

  it("gives JSON valid against its schema", async () => {
    const { stdout } = await bdk(
      CONFIGURED,
      "config",
      "set",
      "execution.lead",
      "foreground",
      "--json",
    );
    expect(SetResultSchema.parse(JSON.parse(stdout))).toEqual({
      key: "execution.lead",
      value: "foreground",
      layer: "project",
      file: PROJECT,
    });
  });

  it("refuses a bad --layer and an invalid value with exit 2", async () => {
    expect(
      (await bdk(CONFIGURED, "config", "set", "execution.lead", "foreground", "--layer", "team"))
        .stderr,
    ).toMatch(/^bdk: --layer must be one of global, project, local\n/);
    const invalid = await bdk(CONFIGURED, "config", "set", "policy.gates.review", "sometimes");
    expect(invalid.code).toBe(2);
    expect(invalid.stderr).toMatch(
      /^bdk: invalid value for policy\.gates\.review: .*"manual"\|"auto"/,
    );
    expect(invalid.fs.data.get(PROJECT)).toBe("languages: [typescript]\n");
  });
});

describe("help", () => {
  it("lists the commands of the group and the arguments of set", async () => {
    const group = await bdk({}, "config", "--help");
    expect(group.stdout).toMatch(/show +Print the resolved configuration/);
    expect(group.stdout).toMatch(/check +Validate every layer file/);
    const set = await bdk({}, "config", "set", "--help");
    expect(set.stdout).toMatch(/^Usage: bdk config set <key> <value> \[flags\]/);
    expect(set.stdout).toMatch(/--layer <value>/);
  });
});
