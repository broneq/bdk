// The registry's run journal line (`kernel-cli`, Run journal): one `command`
// line per dispatch in every outcome, none for --help, outside a work tree or
// for an allowed hook call, a `guard` line with the agent on a block, and a
// sink that throws changes nothing.
import { describe, expect, it } from "vitest";

import { KernelRefusal, refuse } from "../../refusal/index.ts";
import { createRegistry } from "../index.ts";
import type {
  ActiveChangeResolver,
  JournalEntry,
  JournalSink,
  Registration,
  Runtime,
} from "../index.ts";
import { capture, INDEX, runtime } from "./support.ts";

const CHANGE = {
  id: "2026-10-05-italian",
  dir: "/repo/.bdk/changes/2026-10-05-italian",
  projectRoot: "/repo",
  branch: "bdk/2026-10-05-italian",
};
const bound: ActiveChangeResolver = () => CHANGE;

async function run(
  argv: string[],
  options: {
    registrations?: Registration[];
    runtime?: Runtime;
    journal?: JournalSink;
  } = {},
) {
  const entries: JournalEntry[] = [];
  const out = capture();
  let clock = 1_791_212_531_004;
  const registry = createRegistry(INDEX, options.registrations ?? [], {
    activeChange: bound,
    journal:
      options.journal ??
      ((entry) => {
        entries.push(entry);
        return Promise.resolve();
      }),
    now: () => {
      clock += 25;
      return clock;
    },
  });
  const code = await registry.run({
    argv,
    cwd: "/repo/sub",
    runtime: options.runtime ?? runtime(),
    streams: out.streams,
  });
  return { code, stdout: out.stdout(), stderr: out.stderr(), entries };
}

describe("run journal", () => {
  it("journals a success with its arguments, the ticket positional and the wall time", async () => {
    const result = await run(["attempt", "close", "A-k2m4", "ok", "--json"], {
      registrations: [{ id: "attempt-close", handler: () => ({ data: {}, text: "" }) }],
    });
    expect(result.code).toBe(0);
    expect(result.entries).toStrictEqual([
      {
        cwd: "/repo/sub",
        workTree: "/repo",
        line: {
          v: 1,
          kind: "command",
          at: "2026-10-05T15:02:11.029Z",
          command: "attempt-close",
          args: ["A-k2m4", "ok", "--json"],
          exit: 0,
          rule: null,
          ticket: "A-k2m4",
          change: null,
          ms: 25,
        },
      },
    ]);
  });

  it("journals a refusal with its rule, the --ticket flag and the resolved Change", async () => {
    const result = await run(["log", "add", "--ticket", "A-k2m4", "--json"], {
      registrations: [
        { id: "log-add", handler: () => refuse("input/forbidden-field", "no", ["fix it"]) },
      ],
    });
    expect(result.code).toBe(3);
    expect(result.entries[0]?.line).toMatchObject({
      kind: "command",
      command: "log-add",
      exit: 3,
      rule: "input/forbidden-field",
      ticket: "A-k2m4",
      change: CHANGE.id,
    });
  });

  it("journals a thrown KernelRefusal and a parse refusal", async () => {
    const thrown = await run(["doctor", "--json"], {
      registrations: [
        {
          id: "doctor",
          handler: () => {
            throw new KernelRefusal(refuse("state/worktree-orphaned", "gone", ["bdk rebuild"]));
          },
        },
      ],
    });
    expect(thrown.entries[0]?.line).toMatchObject({
      command: "doctor",
      rule: "state/worktree-orphaned",
      exit: thrown.code,
    });
    const parse = await run(["doctor", "--bogus"]);
    expect(parse.entries[0]?.line).toMatchObject({
      command: "doctor",
      rule: "input/unknown-flag",
      exit: 3,
    });
  });

  it("journals an unknown command under `unknown` with the whole argv", async () => {
    const result = await run(["atempt", "close", "--json"]);
    expect(result.entries[0]?.line).toMatchObject({
      command: "unknown",
      args: ["atempt", "close", "--json"],
      rule: "input/unknown-command",
      exit: 3,
    });
  });

  it("journals nothing for --help or outside a work tree", async () => {
    expect((await run(["attempt", "close", "--help"])).entries).toStrictEqual([]);
    expect((await run(["--help"])).entries).toStrictEqual([]);
    const outside = runtime({ workTree: () => undefined });
    expect((await run(["doctor", "--json"], { runtime: outside })).entries).toStrictEqual([]);
    expect((await run(["atempt"], { runtime: outside })).entries).toStrictEqual([]);
    expect((await run(["version", "--json"], { runtime: outside })).entries).toStrictEqual([]);
  });

  it("finds the work tree of a standalone record for its line", async () => {
    const result = await run(["version", "--json"], {
      registrations: [{ id: "version", handler: () => ({ data: {}, text: "" }) }],
    });
    expect(result.entries[0]).toMatchObject({ workTree: "/repo", line: { command: "version" } });
  });

  it("journals a hook call only when it refuses or blocks, a block as `guard` with the agent", async () => {
    const allow = await run(["hooks", "pre-tool"], {
      registrations: [{ id: "hooks-pre-tool", handler: () => ({ data: {}, text: "" }) }],
    });
    expect(allow.entries).toStrictEqual([]);
    const injectOk = await run(["ctx", "skill", "--json"], {
      registrations: [{ id: "ctx-skill", handler: () => ({ data: {}, text: "ctx" }) }],
    });
    expect(injectOk.entries).toStrictEqual([]);

    const block = await run(["hooks", "pre-tool"], {
      registrations: [
        {
          id: "hooks-pre-tool",
          handler: (ctx) => {
            ctx.noteAgent?.("a3f9");
            return refuse("guard/subagent-kernel-command", "subagents may not commit", ["x"]);
          },
        },
      ],
    });
    expect(block.code).toBe(2);
    expect(block.entries[0]?.line).toMatchObject({
      kind: "guard",
      command: "hooks-pre-tool",
      rule: "guard/subagent-kernel-command",
      exit: 2,
      agent: "a3f9",
    });

    const unnamed = await run(["hooks", "pre-tool"], {
      registrations: [
        {
          id: "hooks-pre-tool",
          handler: () => refuse("guard/subagent-kernel-command", "blocked", ["y"]),
        },
      ],
    });
    expect(unnamed.entries[0]?.line).toMatchObject({ kind: "guard", agent: "main" });

    const injected = await run(["ctx", "skill"], {
      registrations: [
        { id: "ctx-skill", handler: () => refuse("policy/no-active-change", "n", ["m"]) },
      ],
    });
    expect(injected.code).toBe(0);
    expect(injected.entries[0]?.line).toMatchObject({
      kind: "command",
      command: "ctx-skill",
      exit: 0,
      rule: "policy/no-active-change",
    });
  });

  it("journals a crashed command-mode handler before the error reaches main", async () => {
    const entries: JournalEntry[] = [];
    await expect(
      run(["doctor", "--json"], {
        registrations: [
          {
            id: "doctor",
            handler: () => {
              throw new Error("boom");
            },
          },
        ],
        journal: (entry) => {
          entries.push(entry);
          return Promise.resolve();
        },
      }),
    ).rejects.toThrow("boom");
    expect(entries[0]?.line).toMatchObject({ kind: "command", exit: 1, rule: "kernel/crash" });
  });

  it("journals a crashed hook-mode handler with its exit code", async () => {
    const result = await run(["hooks", "pre-tool"], {
      registrations: [
        {
          id: "hooks-pre-tool",
          handler: () => {
            throw new Error("boom");
          },
        },
      ],
    });
    expect(result.code).toBe(2);
    expect(result.entries[0]?.line).toMatchObject({ kind: "guard", exit: 2, rule: "kernel/crash" });
  });

  it("leaves stdout and the exit code unchanged when the sink throws or rejects", async () => {
    const registrations: Registration[] = [
      { id: "log-add", handler: () => refuse("input/forbidden-field", "no", ["fix it"]) },
    ];
    const plain = await run(["log", "add", "--json"], { registrations });
    for (const journal of [
      (): Promise<void> => {
        throw new Error("EACCES");
      },
      (): Promise<void> => Promise.reject(new Error("EACCES")),
    ]) {
      const broken = await run(["log", "add", "--json"], { registrations, journal });
      expect(broken.code).toBe(plain.code);
      expect(broken.stdout).toBe(plain.stdout);
      expect(broken.stderr).toBe("");
    }
  });
});
