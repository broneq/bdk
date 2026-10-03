// The `hooks session-start` latency budget through the built bundle.
// Wall-clock timing depends on the machine, so this runs in the `perf`
// project, which CI does not run: `pnpm build && pnpm test:perf` locally.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createFixture } from "../../../tests/support/fixture.ts";
import type { Fixture } from "../../../tests/support/fixture.ts";
import { REPO_ROOT, runBdk } from "../../../tests/support/run.ts";

const VERSION = (
  JSON.parse(readFileSync(join(REPO_ROOT, ".claude-plugin/plugin.json"), "utf8")) as {
    version: string;
  }
).version;
const MODELINE = `# yaml-language-server: $schema=https://raw.githubusercontent.com/broneq/bdk/dist-v${VERSION}/schema/settings.json\n`;
const PAYLOAD = JSON.stringify({ hook_event_name: "SessionStart", source: "startup" });

const fixtures: Fixture[] = [];
afterEach(() => {
  for (const created of fixtures.splice(0)) created.remove();
});

describe("hooks session-start performance", () => {
  it("finishes within a second on a BDK project", () => {
    const created = createFixture({
      files: { ".bdk/settings.yaml": `${MODELINE}languages: [go]\n` },
      git: true,
    });
    fixtures.push(created);
    const root = created.root;
    const env = { XDG_CONFIG_HOME: join(root, "xdg"), HOME: root, PATH: "" };
    const start = performance.now();
    const result = runBdk(["hooks", "session-start"], root, { env, stdin: PAYLOAD });
    expect(performance.now() - start).toBeLessThan(1000);
    expect(result.code).toBe(0);
  });
});
