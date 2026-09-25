// `kernel-architecture`, Tests per slice: every stubbed record of the index,
// run through the committed bundle, answers `kernel/not-implemented` in the
// shape of its mode and prints its `--help`. A record leaves this enumeration
// when its owner task registers a handler and brings its own E2E cases.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import commands from "../../schema/cli/commands.json" with { type: "json" };
import { registrations } from "../src/registrations.ts";
import { loadIndex } from "../src/shared/registry/index.ts";
import type { CommandRecord } from "../src/shared/registry/index.ts";
import { createFixture } from "./support/fixture.ts";
import type { Fixture } from "./support/fixture.ts";
import { runBdk } from "./support/run.ts";

const implemented = new Set(registrations.map((registration) => registration.id));
const stubs = loadIndex(commands).commands.filter((record) => !implemented.has(record.id));

/** The shortest argv the parser accepts: every required argument, first allowed value. */
function argv(record: CommandRecord): string[] {
  return [
    ...record.argv,
    ...record.args.filter((arg) => arg.required).map((arg) => arg.values?.[0] ?? "x"),
  ];
}

let repo: Fixture;
let outside: Fixture;
beforeAll(() => {
  repo = createFixture();
  outside = createFixture({ git: false });
});
afterAll(() => {
  repo.remove();
  outside.remove();
});

describe.each(stubs.map((record) => [record.id, record] as const))("%s", (_, record) => {
  it("answers kernel/not-implemented in the shape of its mode, never exit 1", () => {
    const result = runBdk([...argv(record), "--json"], repo.root);
    const plain = runBdk(argv(record), repo.root);
    if (record.mode === "command") {
      expect(result.code).toBe(2);
      expect(result.json).toMatchObject({ refused: true, rule: "kernel/not-implemented" });
      expect(plain.stdout).toContain(record.owner);
    } else if (record.mode === "inject") {
      expect(result.code).toBe(0);
      expect(result.json).toMatchObject({ rule: "kernel/not-implemented" });
      expect(plain.code).toBe(0);
      expect(plain.stdout).toMatch(new RegExp(`^BDK STOP: .*${record.owner}.*\\nInstead: .+\\n$`));
    } else {
      expect(plain.code).toBe(2);
      expect(plain.stderr).toContain(record.owner);
    }
  });

  it("prints --help with exit 0 outside a work tree", () => {
    const result = runBdk([...record.argv, "--help"], outside.root);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain(`usage: bdk ${record.argv.join(" ")}`);
  });

  it.skipIf(record.standalone === true)(
    "refuses outside a work tree in the shape of its mode",
    () => {
      const result = runBdk(argv(record), outside.root);
      const expected = { command: 5, inject: 0, guard: 2 }[record.mode];
      expect(result.code).toBe(expected);
      const shown = record.mode === "guard" ? result.stderr : result.stdout;
      expect(shown).toContain("is not inside a git work tree");
    },
  );
});
