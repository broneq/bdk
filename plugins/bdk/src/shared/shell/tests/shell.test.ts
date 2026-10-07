import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { shell } from "../index.ts";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "bdk-shell-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const pause = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));

/** Waits up to 2.5 s for the process to end. */
async function gone(pid: number): Promise<boolean> {
  for (let i = 0; i < 50 && alive(pid); i++) await pause(50);
  return !alive(pid);
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

describe("shell", () => {
  it("writes stdout and stderr into one file, creating its directory, and returns the exit code", async () => {
    const output = join(root, "out", "check.txt");
    const outcome = await shell("echo one; echo two >&2; echo three; exit 3", {
      cwd: root,
      output,
      timeout: 10,
    });
    expect(outcome).toEqual({ kind: "exit", code: 3 });
    expect(readFileSync(output, "utf8")).toBe("one\ntwo\nthree\n");
  });

  it("runs in the given directory and replaces an earlier output file", async () => {
    const output = join(root, "check.txt");
    await shell("echo first-run-with-long-output", { cwd: root, output, timeout: 10 });
    await shell("pwd -P", { cwd: root, output, timeout: 10 });
    expect(readFileSync(output, "utf8").trim()).toMatch(/bdk-shell-/);
  });

  it("gives the command stdin at end of file", async () => {
    const output = join(root, "check.txt");
    const outcome = await shell("cat; echo done", { cwd: root, output, timeout: 10 });
    expect(outcome).toEqual({ kind: "exit", code: 0 });
    expect(readFileSync(output, "utf8")).toBe("done\n");
  });

  it("kills the command and every process it started at the timeout", async () => {
    const output = join(root, "check.txt");
    const started = Date.now();
    const outcome = await shell(`sleep 60 & echo $! > "${root}/pid"; wait`, {
      cwd: root,
      output,
      timeout: 1,
    });
    expect(outcome).toEqual({ kind: "timeout" });
    expect(Date.now() - started).toBeLessThan(10_000);
    expect(await gone(Number(readFileSync(join(root, "pid"), "utf8")))).toBe(true);
  });

  it("counts an exit by a signal as 128 plus the signal number", async () => {
    const outcome = await shell("kill -TERM $$", {
      cwd: root,
      output: join(root, "check.txt"),
      timeout: 10,
    });
    expect(outcome).toEqual({ kind: "exit", code: 143 });
  });

  it("reports a shell that cannot start as exit 127 with the reason in the output", async () => {
    const output = join(root, "check.txt");
    const outcome = await shell("true", { cwd: root, output, timeout: 10 }, "/no/sh");
    expect(outcome).toEqual({ kind: "exit", code: 127 });
    expect(readFileSync(output, "utf8")).toBe(`bdk: cannot start /no/sh in ${root}\n`);
  });

  it("kills what the command left running when it exits", async () => {
    const outcome = await shell(`sleep 60 & echo $! > "${root}/pid"; exit 0`, {
      cwd: root,
      output: join(root, "check.txt"),
      timeout: 10,
    });
    expect(outcome).toEqual({ kind: "exit", code: 0 });
    expect(await gone(Number(readFileSync(join(root, "pid"), "utf8")))).toBe(true);
  });

  it("kills the running group when the CLI is interrupted", async () => {
    const script = join(root, "run.ts");
    writeFileSync(
      script,
      `import { shell } from ${JSON.stringify(join(import.meta.dirname, "..", "index.ts"))};\n` +
        `await shell('sleep 60 & echo $! > "${root}/pid"; wait', ` +
        `{ cwd: ${JSON.stringify(root)}, output: ${JSON.stringify(join(root, "out.txt"))}, timeout: 60 });\n`,
    );
    const cli = spawn(process.execPath, [script], { stdio: "ignore" });
    const ended = new Promise<string | null>((done) =>
      cli.on("exit", (_code, signal) => {
        done(signal);
      }),
    );
    for (let i = 0; i < 200 && !existsSync(join(root, "pid")); i++) await pause(25);
    await pause(100);
    cli.kill("SIGTERM");
    expect(await ended).toBe("SIGTERM");
    expect(await gone(Number(readFileSync(join(root, "pid"), "utf8")))).toBe(true);
  });
});
