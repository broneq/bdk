import { describe, expect, it } from "vitest";

import commands from "../../../../../schema/cli/commands.json" with { type: "json" };
import { commandHelp, createRegistry, loadIndex, synopsis } from "../index.ts";
import { INDEX } from "./support.ts";

const [first] = INDEX.commands;
if (first === undefined) throw new Error("empty test index");

describe("loadIndex", () => {
  it("reads the bundled index", () => {
    expect(loadIndex(commands).commands).toHaveLength(60);
  });

  it("rejects a rule outside the catalogue", () => {
    expect(() =>
      loadIndex({ ...INDEX, base: { all: ["input/nope"], changeScoped: [] } }),
    ).toThrow();
  });
});

describe("usage", () => {
  const record = {
    ...first,
    argv: ["log", "add"],
    args: [{ name: "kind", required: false }],
    flags: [{ name: "--body", value: "<text>" }],
    stdin: "Body text.",
    changeScoped: true,
  };

  it("brackets optional arguments and wraps bare names", () => {
    expect(synopsis(record)).toBe("bdk log add [<kind>] [--body <text>] [--json]");
  });

  it("names stdin and adds the Change-scoped base rules", () => {
    const text = commandHelp(INDEX, record);
    expect(text).toContain("\nstdin: Body text.\n");
    expect(text).toContain("policy/no-active-change");
    expect(text).toContain("  kind  optional\n");
  });

  it("refuses --help for an unknown group", async () => {
    let out = "";
    const code = await createRegistry(INDEX, []).run({
      argv: ["nope", "--help"],
      cwd: "/",
      runtime: {
        nodeVersion: "24.0.0",
        env: {},
        platform: "linux",
        home: "/home/dev",
        workTree: () => "/",
        which: () => undefined,
      },
      streams: { stdout: (text) => (out += text), stderr: () => undefined },
    });
    expect(code).toBe(3);
    expect(out).toContain("input/unknown-command");
  });
});

describe("registration", () => {
  it("rejects a duplicate registration", () => {
    const handler = () => ({ data: {}, text: "" });
    expect(() =>
      createRegistry(INDEX, [
        { id: "doctor", handler },
        { id: "doctor", handler },
      ]),
    ).toThrow("twice");
  });
});
