import { describe, expect, it } from "vitest";

import { refuse } from "../../refusal/index.ts";
import { createRegistry } from "../index.ts";
import type { Handler, Registration, Runtime } from "../index.ts";
import { capture, INDEX, runtime } from "./support.ts";

const ok: Handler = (ctx) => ({ data: { id: ctx.record.id, ...ctx.positionals }, text: "done" });

async function run(
  argv: string[],
  options: { registrations?: Registration[]; runtime?: Runtime } = {},
) {
  const out = capture();
  const registry = createRegistry(INDEX, options.registrations ?? []);
  const code = await registry.run({
    argv,
    cwd: "/repo/sub",
    runtime: options.runtime ?? runtime(),
    streams: out.streams,
  });
  return { code, stdout: out.stdout(), stderr: out.stderr(), json: safeJson(out.stdout()) };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

describe("command resolution", () => {
  it("refuses an unknown command and names the closest id", async () => {
    const result = await run(["atempt", "close", "--json"]);
    expect(result.code).toBe(3);
    expect(result.json).toMatchObject({ rule: "input/unknown-command" });
    expect((result.json as { instead: string[] }).instead).toContain("bdk attempt close --help");
  });

  it("weighs the group word first when naming the closest id", async () => {
    const result = await run(["atempt", "--json"]);
    expect((result.json as { instead: string[] }).instead[1]).toMatch(/^bdk attempt /);
  });

  it("resolves the longest argv prefix, three words included", async () => {
    const result = await run(["spec", "delta", "check", "--json"]);
    expect(result.json).toMatchObject({ rule: "kernel/not-implemented" });
  });

  it("refuses an empty invocation", async () => {
    const result = await run([]);
    expect(result.code).toBe(3);
    expect(result.stdout).toContain("refused: input/unknown-command");
  });
});

describe("--help", () => {
  it("prints usage before any runtime or project check", async () => {
    const result = await run(["attempt", "close", "--help"], {
      runtime: runtime({ nodeVersion: "22.12.0", workTree: () => undefined }),
    });
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("bdk attempt close <ticket> <outcome>");
  });

  it("lists a group's verbs for bdk <group> --help", async () => {
    const result = await run(["attempt", "--help"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("attempt close");
    expect(result.stdout).toContain("attempt list");
  });

  it("lists every command for bdk --help", async () => {
    const result = await run(["--help"]);
    expect(result.code).toBe(0);
    for (const command of INDEX.commands) expect(result.stdout).toContain(command.argv.join(" "));
  });
});

describe("argument parsing", () => {
  const registrations = [{ id: "attempt-close", handler: ok }];

  it("refuses an undeclared flag", async () => {
    const result = await run(["attempt", "close", "A-1", "ok", "--bogus", "--json"], {
      registrations,
    });
    expect(result.code).toBe(3);
    expect(result.json).toMatchObject({ rule: "input/unknown-flag" });
  });

  it("refuses a missing required positional", async () => {
    const result = await run(["attempt", "close", "A-1", "--json"], { registrations });
    expect(result.json).toMatchObject({ rule: "input/missing-argument" });
  });

  it("refuses a flag without its value", async () => {
    const result = await run(["attempt", "close", "A-1", "ok", "--envelope", "--json"], {
      registrations,
    });
    expect(result.json).toMatchObject({ rule: "input/missing-argument" });
  });

  it("refuses a literal outside values, positional or flag", async () => {
    expect(
      (await run(["attempt", "close", "A-1", "maybe", "--json"], { registrations })).json,
    ).toMatchObject({
      rule: "input/invalid-argument",
    });
    expect(
      (await run(["attempt", "close", "A-1", "ok", "--type", "c", "--json"], { registrations }))
        .json,
    ).toMatchObject({
      rule: "input/invalid-argument",
    });
  });

  it("refuses an extra positional and a value on a boolean flag", async () => {
    expect(
      (await run(["attempt", "close", "A-1", "ok", "x", "--json"], { registrations })).json,
    ).toMatchObject({
      rule: "input/invalid-argument",
    });
    expect(
      (await run(["attempt", "close", "A-1", "ok", "--all=yes", "--json"], { registrations })).json,
    ).toMatchObject({
      rule: "input/invalid-argument",
    });
  });

  it("passes positionals and flags to the handler, both flag forms", async () => {
    let seen: unknown;
    const spy: Handler = (ctx) => {
      seen = { positionals: ctx.positionals, flags: ctx.flags, json: ctx.json };
      return { data: {}, text: "" };
    };
    const result = await run(
      ["attempt", "close", "A-1", "fail", "--envelope", "e.md", "--type=b", "--all"],
      {
        registrations: [{ id: "attempt-close", handler: spy }],
      },
    );
    expect(result.code).toBe(0);
    expect(seen).toStrictEqual({
      positionals: { "<ticket>": "A-1", outcome: "fail" },
      flags: { "--envelope": "e.md", "--type": "b", "--all": true },
      json: false,
    });
  });
});

describe("runtime checks", () => {
  it("checks input before the runtime", async () => {
    const result = await run(["doctor", "--bogus", "--json"], {
      runtime: runtime({ workTree: () => undefined }),
    });
    expect(result.json).toMatchObject({ rule: "input/unknown-flag" });
  });

  it.each(["22.12.9", "23.3.0", "20.20.2"])(
    "refuses Node %s with exit 5 and an install line",
    async (nodeVersion) => {
      const result = await run(["attempt", "list", "--json"], {
        runtime: runtime({ nodeVersion }),
      });
      expect(result.code).toBe(5);
      const refusal = result.json as { rule: string; why: string; instead: string[] };
      expect(refusal.rule).toBe("runtime/node-version");
      expect(refusal.why).toContain(nodeVersion);
      expect(refusal.why).toContain("22.13.0");
      expect(refusal.instead.join(" ")).toContain("nvm install 24");
    },
  );

  it.each(["22.13.0", "23.4.0", "26.9.0"])("accepts Node %s", async (nodeVersion) => {
    const result = await run(["attempt", "list", "--json"], { runtime: runtime({ nodeVersion }) });
    expect(result.json).toMatchObject({ rule: "kernel/not-implemented" });
  });

  it("checks the Node version before the work tree", async () => {
    const result = await run(["attempt", "list", "--json"], {
      runtime: runtime({ nodeVersion: "22.12.9", workTree: () => undefined }),
    });
    expect(result.json).toMatchObject({ rule: "runtime/node-version" });
  });

  it("refuses outside a work tree with exit 5", async () => {
    const result = await run(["attempt", "list", "--json"], {
      runtime: runtime({ workTree: () => undefined }),
    });
    expect(result.code).toBe(5);
    expect(result.json).toMatchObject({ rule: "runtime/not-a-repo" });
  });

  it("skips every runtime check for a standalone record", async () => {
    const result = await run(["version", "--json"], {
      registrations: [{ id: "version", handler: ok }],
      runtime: runtime({ nodeVersion: "22.12.9", workTree: () => undefined }),
    });
    expect(result.code).toBe(0);
  });

  it("skips only the Node gate for a nodeGate: false registration", async () => {
    const low = runtime({ nodeVersion: "22.12.9" });
    const registrations = [{ id: "doctor", handler: ok, nodeGate: false }];
    expect((await run(["doctor", "--json"], { registrations, runtime: low })).code).toBe(0);
    const outside = runtime({ nodeVersion: "22.12.9", workTree: () => undefined });
    expect(
      (await run(["doctor", "--json"], { registrations, runtime: outside })).json,
    ).toMatchObject({
      rule: "runtime/not-a-repo",
    });
  });

  it("passes the work tree root to the handler", async () => {
    let root: string | undefined;
    await run(["doctor"], {
      registrations: [
        { id: "doctor", handler: (ctx) => ((root = ctx.workTree), { data: {}, text: "" }) },
      ],
    });
    expect(root).toBe("/repo");
  });
});

describe("stub", () => {
  it("answers kernel/not-implemented naming the owner task", async () => {
    const result = await run(["attempt", "list", "--json"]);
    expect(result.code).toBe(2);
    const refusal = result.json as { why: string; instead: string[] };
    expect(refusal.why).toContain("T22");
    expect(refusal.instead.some((line) => line.includes("T22"))).toBe(true);
    expect(refusal.instead).toContain("bdk attempt --help");
  });
});

describe("mode wrappers", () => {
  it("command mode: result text, refusal as four lines, exit by class", async () => {
    const done = await run(["doctor"], { registrations: [{ id: "doctor", handler: ok }] });
    expect(done).toMatchObject({ code: 0, stdout: "done\n" });
    const refused = await run(["doctor"], {
      registrations: [
        {
          id: "doctor",
          handler: () => refuse("policy/merge-hash-mismatch", "hash differs", ["bdk doctor"]),
        },
      ],
    });
    expect(refused.code).toBe(2);
    expect(refused.stdout.split("\n")[0]).toBe("refused: policy/merge-hash-mismatch");
  });

  it("command mode: --json prints the data object", async () => {
    const result = await run(["attempt", "close", "A-1", "ok", "--json"], {
      registrations: [{ id: "attempt-close", handler: ok }],
    });
    expect(result.json).toStrictEqual({ id: "attempt-close", "<ticket>": "A-1", outcome: "ok" });
  });

  it("inject mode: a refusal becomes a STOP block and exit 0", async () => {
    const result = await run(["ctx", "skill", "--bogus"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/^BDK STOP: .+\nInstead: .+\n$/);
  });

  it("inject mode: a crash becomes a STOP block and exit 0", async () => {
    const result = await run(["ctx", "skill"], {
      registrations: [
        {
          id: "ctx-skill",
          handler: () => {
            throw new Error("boom");
          },
        },
      ],
    });
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/^BDK STOP: .*boom.*\nInstead: .+\n$/);
  });

  it("guard mode: a refusal blocks with exit 2 and the reason on stderr, never 3-5", async () => {
    const low = await run(["hooks", "pre-tool"], { runtime: runtime({ nodeVersion: "22.12.9" }) });
    expect(low.code).toBe(2);
    expect(low.stderr).toContain("22.12.9");
    const bad = await run(["hooks", "pre-tool", "--bogus"]);
    expect(bad.code).toBe(2);
    const stub = await run(["hooks", "pre-tool"]);
    expect(stub.code).toBe(2);
    expect(stub.stderr).toContain("T24");
  });

  it("guard mode: a crash blocks with exit 2", async () => {
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
    expect(result.stderr).toContain("boom");
  });

  it("command mode: a crash propagates to main", async () => {
    const registry = createRegistry(INDEX, [
      {
        id: "doctor",
        handler: () => {
          throw new Error("boom");
        },
      },
    ]);
    await expect(
      registry.run({ argv: ["doctor"], cwd: "/", runtime: runtime(), streams: capture().streams }),
    ).rejects.toThrow("boom");
  });
});

describe("registration", () => {
  it("rejects a registration for an id the index does not know", () => {
    expect(() => createRegistry(INDEX, [{ id: "nope", handler: ok }])).toThrow("nope");
  });

  it("reports handler or stub per record", () => {
    const registry = createRegistry(INDEX, [{ id: "doctor", handler: ok }]);
    expect(registry.implementation("doctor")).toBe("handler");
    expect(registry.implementation("attempt-list")).toBe("stub");
  });
});
