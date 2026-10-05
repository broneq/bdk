// A session with `diagnostics.verbose` through the built bundle (`kernel-cli/hooks`,
// Run journal and verbose lines; `kernel-state`, Verbose log): session-start
// writes the journal's session line and the marker, post-tool the live line,
// session-end the render of the recorded transcript, and git tracks none of it.
import { cpSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { bdk, git, read, repository } from "../../../tests/support/repo.ts";
import { REPO_ROOT } from "../../../tests/support/run.ts";

const FIXTURE = join(REPO_ROOT, "tests/fixtures/host-transcripts/2.1.289/transcript-layout");
const SESSION = "00000000-0000-4000-8000-000000000001";

describe("a verbose session", () => {
  it("journals the session, logs each call live, renders at the end and stays untracked", () => {
    const home = mkdtempSync(join(tmpdir(), "bdk-transcripts-"));
    cpSync(FIXTURE, home, { recursive: true });
    const transcript = join(home, `${SESSION}.jsonl`);
    const root = repository({
      ".gitignore": "/.bdk/.machine/\n",
      ".bdk/settings.yaml": "diagnostics:\n  verbose: true\n",
    });
    const hook = (verb: string, payload: Record<string, unknown>) =>
      bdk(["hooks", verb], root, { stdin: JSON.stringify({ session_id: SESSION, ...payload }) });

    expect(hook("session-start", { transcript_path: transcript, source: "startup" }).code).toBe(0);
    const [session] = read(root, ".bdk/.machine/telemetry/journal.jsonl")
      .split("\n")
      .map((line) => JSON.parse(line || "{}") as Record<string, unknown>);
    expect(session).toMatchObject({ kind: "session", session: SESSION, transcript });

    hook("post-tool", {
      hook_event_name: "PostToolUse",
      tool_name: "Bash",
      tool_input: { command: "echo probe-ok" },
      tool_response: { stdout: "probe-ok", stderr: "" },
    });
    expect(read(root, `.bdk/.machine/logs/${SESSION}.live.log`)).toMatch(
      /^\d\d:\d\d:\d\d main Bash echo probe-ok ok\n {4}probe-ok\n$/,
    );

    const ended = hook("session-end", { reason: "other" });
    expect(ended.code).toBe(0);
    const path = /\[BDK\] verbose log (\S+)/.exec(ended.stdout)?.[1] ?? "";
    expect(path).toBe(`.bdk/.machine/logs/${SESSION}.log`);
    const log = readFileSync(join(root, path), "utf8");
    expect(log).toContain("transcript: ok");
    expect(log).toContain("main Bash echo probe-repeat");
    expect(git(root, "status", "--porcelain", "--", ".bdk/.machine")).toBe("");
  });
});
