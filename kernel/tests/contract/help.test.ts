// `kernel-cli` Invocation, scenarios "help parity" and "help for a stubbed
// command": the usage text of every record lists exactly its arguments, flags
// and exit codes, whether or not a handler is registered.
import { describe, expect, it } from "vitest";

import commands from "../../../schema/cli/commands.json" with { type: "json" };
import { createRegistry, loadIndex } from "../../src/shared/registry/index.ts";
import type { CommandRecord } from "../../src/shared/registry/index.ts";

const index = loadIndex(commands);
const registry = createRegistry(index, []);

async function help(record: CommandRecord): Promise<{ code: number; text: string }> {
  let text = "";
  const code = await registry.run({
    argv: [...record.argv, "--help"],
    cwd: "/nowhere",
    runtime: {
      nodeVersion: "20.0.0",
      env: {},
      platform: "linux",
      home: "/home/dev",
      workTree: () => undefined,
    },
    streams: { stdout: (chunk) => (text += chunk), stderr: () => undefined },
  });
  return { code, text };
}

function section(text: string, heading: string): string[] {
  const lines = text.split("\n");
  const start = lines.indexOf(`${heading}:`);
  if (start === -1) return [];
  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith("  ")) break;
    body.push(line.trim().split(/\s/)[0] ?? "");
  }
  return body;
}

describe.each(index.commands.map((record) => [record.id, record] as const))(
  "%s --help",
  (_, record) => {
    it("exits 0 before any runtime check, stub or not", async () => {
      expect(registry.implementation(record.id)).toBe("stub");
      expect((await help(record)).code).toBe(0);
    });

    it("lists exactly the record's arguments, flags and exit codes", async () => {
      const { text } = await help(record);
      expect(section(text, "arguments")).toStrictEqual(record.args.map((arg) => arg.name));
      expect(section(text, "flags")).toStrictEqual(record.flags.map((flag) => flag.name));
      expect(text).toContain(`\nexit codes: ${record.exits.join(", ")}\n`);
      const usage = text.split("\n")[0] ?? "";
      for (const arg of record.args)
        expect(usage).toContain(arg.name.replace(/^(?!<)(.*)$/, "<$1>"));
      for (const flag of record.flags) expect(usage).toContain(`[${flag.name}`);
    });
  },
);
