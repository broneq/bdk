// `kernel-cli/ctx`, `bdk ctx startup`, scenario "committed file is the
// rendered file" (P11, T6): the STARTUP_INSTRUCTIONS.md in the repository is
// exactly what the kernel renders, so its agents table cannot drift from the
// agent files.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { startupContext } from "../../src/ctx/index.ts";
import { fileStore } from "../../src/shared/store/index.ts";
import { REPO_ROOT } from "../support/run.ts";

const REGENERATE = "node dist/bdk.mjs ctx startup > STARTUP_INSTRUCTIONS.md";

describe("STARTUP_INSTRUCTIONS.md", () => {
  const committed = readFileSync(join(REPO_ROOT, "STARTUP_INSTRUCTIONS.md"), "utf8");
  const render = () => startupContext({ store: fileStore(), pluginRoot: REPO_ROOT }).content;

  it("is byte-identical to bdk ctx startup", () => {
    expect(committed, `regenerate it: ${REGENERATE}`).toBe(render());
  });

  it("lists every agent file once", () => {
    const rendered = render();
    for (const file of readdirSync(join(REPO_ROOT, "agents")).filter((f) => f.endsWith(".md"))) {
      const row = `| \`bdk:${file.slice(0, -3)}\``;
      expect(rendered.split("\n").filter((line) => line.startsWith(`${row} `))).toHaveLength(1);
    }
  });
});
