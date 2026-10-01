import { memoryRegistry } from "../../shared/store/index.ts";
// `hooks session-end` through the registry on a memory repository with a
// scripted git (`kernel-cli/hooks`, `bdk hooks session-end`; T24 design D-14).
// The in-progress git operations need a real `.git` and are in guards.e2e.ts.
import commands from "../../../../schema/cli/commands.json" with { type: "json" };
import sessionEndClear from "../../../../tests/fixtures/host-payloads/2.1.281/session-end-clear.json" with { type: "json" };
import { describe, expect, it } from "vitest";

import { BRANCH, ROOT } from "../../log/tests/support.ts";
import { harness as partHarness, openTicket } from "../../part/tests/support.ts";
import { loadIndex } from "../../shared/registry/index.ts";
import { removeMarker } from "../../shared/store/index.ts";
import { hooksRegistrations } from "../index.ts";
import { sessionEndOutput } from "../schema/session-end.ts";

const CHANGE = "2026-09-25-login";
const CHANGE_DIR = `.bdk/changes/${CHANGE}/`;
const PAYLOAD = JSON.stringify(sessionEndClear.payloads[0]);

function harness() {
  const h = partHarness((deps) =>
    hooksRegistrations({ ...deps, commands: loadIndex(commands), openRegistry: memoryRegistry() }),
  );
  h.git.status = [`${CHANGE_DIR}log/e.md`];
  return h;
}

async function sessionEnd(h: ReturnType<typeof harness>, json = true) {
  const result = await h.run(
    ["hooks", "session-end", ...(json ? ["--json"] : [])],
    undefined,
    PAYLOAD,
  );
  return { ...result, report: json ? sessionEndOutput.parse(result.json) : undefined };
}

describe("hooks session-end", () => {
  it("commits a checkpoint of the Change directory and prints the line", async () => {
    const h = harness();
    const { code, report } = await sessionEnd(h);
    expect(code).toBe(0);
    expect(report).toStrictEqual({
      content: `[BDK] checkpoint d8e4f21 of ${CHANGE}`,
      reason: "clear",
      checkpoint: { done: true, commit: "d8e4f21" },
    });
    const argv = h.git.committed.at(-1) ?? [];
    expect(argv).toContain(`chore(bdk): checkpoint ${CHANGE}`);
    expect(argv.slice(argv.indexOf("--") + 1)).toStrictEqual([CHANGE_DIR]);
    expect((await sessionEnd(h, false)).stdout).toBe(`[BDK] checkpoint d8e4f21 of ${CHANGE}\n`);
  });

  it("reports open tickets as skipped, with exit 0 and no STOP block", async () => {
    const h = harness();
    openTicket(h.store, "A-00000001", "01-1");
    const { code, report } = await sessionEnd(h);
    expect(code).toBe(0);
    expect(report?.checkpoint).toStrictEqual({
      done: false,
      skipped: "ticket A-00000001 is open; a subagent may still be writing",
    });
    expect(h.git.committed).toStrictEqual([]);
    expect((await sessionEnd(h, false)).stdout).toBe("");
  });

  it("reports a disabled policy as skipped", async () => {
    const h = harness();
    h.store.write(`${ROOT}/.bdk/settings.yaml`, "policy:\n  checkpoint:\n    enabled: false\n");
    expect((await sessionEnd(h)).report?.checkpoint).toStrictEqual({
      done: false,
      skipped: "policy.checkpoint.enabled is false",
    });
  });

  it("reports no active Change as skipped with empty stdout", async () => {
    const h = harness();
    removeMarker(h.store, ROOT, BRANCH);
    const { code, report } = await sessionEnd(h);
    expect(code).toBe(0);
    expect(report).toStrictEqual({
      content: "",
      reason: "clear",
      checkpoint: { done: false, skipped: "no active Change" },
    });
    expect((await sessionEnd(h, false)).stdout).toBe("");
  });

  it("ignores an unreadable payload", async () => {
    const h = harness();
    const result = await h.run(["hooks", "session-end", "--json"], undefined, "not json");
    expect(result.json).toMatchObject({ checkpoint: { done: true } });
    expect(result.json).not.toHaveProperty("reason");
  });
});
