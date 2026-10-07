import { describe, expect, it } from "vitest";

import { CliError, run } from "../index.ts";
import type { Command, Group } from "../index.ts";

// The frame of spec `bdk-cli`, driven with fake groups: what reaches stdout and stderr, and the
// exit code, for every path through the router.

const calls: string[] = [];

const demo: Group = {
  name: "demo",
  summary: "Demonstrate the frame",
  commands: [
    {
      verb: "show",
      summary: "Show an item",
      arguments: [{ name: "id", description: "Item id", required: true }],
      flags: { upper: { type: "boolean", description: "Print in upper case" } },
      exits: [{ code: 1, when: "the item is empty" }],
      run({ args, flags }) {
        const id = String(args.id);
        calls.push(`show ${id}`);
        if (id === "boom") throw new Error("kaput");
        if (id === "missing") {
          throw new CliError("env/not-found", `no item ${id}`, "create it first");
        }
        const text = flags.upper === true ? id.toUpperCase() : id;
        return { data: { id: text }, text: `item ${text}`, ...(id === "empty" ? { exit: 1 } : {}) };
      },
    },
    {
      verb: "list",
      summary: "List the items",
      flags: { limit: { type: "string", description: "Most items to list" } },
      run({ flags }) {
        const limit = flags.limit === undefined ? 2 : Number(flags.limit);
        if (!Number.isInteger(limit)) {
          throw new CliError(
            "usage/invalid-argument",
            `--limit takes a whole number, got ${String(flags.limit)}`,
          );
        }
        return { data: { items: ["a", "b"].slice(0, limit) }, text: "a\nb" };
      },
    },
    {
      verb: "tag",
      summary: "Tag the items",
      flags: { name: { type: "string", multiple: true, description: "One tag" } },
      run({ flags }) {
        return { data: { names: flags.name ?? [] }, text: "tagged" };
      },
    },
  ],
};

const doIt: Command = {
  summary: "Do the one thing",
  run: () => ({ data: { done: true }, text: "done\n" }),
};

const solo: Group = {
  name: "solo",
  summary: "A group with one command",
  commands: [doIt],
};

interface Outcome {
  readonly exit: number;
  readonly stdout: string;
  readonly stderr: string;
}

async function bdk(
  argv: readonly string[],
  options: { nodeVersion?: string } = {},
): Promise<Outcome> {
  let stdout = "";
  let stderr = "";
  const exit = await run({
    argv,
    version: "9.8.7",
    nodeVersion: options.nodeVersion ?? "22.18.0",
    groups: [demo, solo],
    stdout: (text) => (stdout += text),
    stderr: (text) => (stderr += text),
  });
  return { exit, stdout, stderr };
}

function json(text: string): unknown {
  expect(text.endsWith("\n")).toBe(true);
  expect(text.trimEnd().split("\n")).toHaveLength(1);
  return JSON.parse(text);
}

describe("help", () => {
  it.each([[[]], [["--help"]], [["-h"]]])("prints the global help for %j", async (argv) => {
    const { exit, stdout, stderr } = await bdk(argv);
    expect(exit).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).toContain("Usage: bdk <group> [<verb>] [arguments] [flags]");
    expect(stdout).toMatch(/^ {2}demo +Demonstrate the frame$/m);
    expect(stdout).toMatch(/^ {2}solo +A group with one command$/m);
    for (const flag of ["--help, -h", "--version", "--json"]) expect(stdout).toContain(flag);
  });

  it.each([[["demo"]], [["demo", "--help"]]])("prints the group help for %j", async (argv) => {
    const { exit, stdout } = await bdk(argv);
    expect(exit).toBe(0);
    expect(stdout).toContain("Usage: bdk demo <verb> [arguments] [flags]");
    expect(stdout).toMatch(/^ {2}show +Show an item$/m);
    expect(stdout).toMatch(/^ {2}list +List the items$/m);
  });

  it("prints the command help without running the command", async () => {
    calls.length = 0;
    const { exit, stdout } = await bdk(["demo", "show", "x", "--help"]);
    expect(exit).toBe(0);
    expect(calls).toEqual([]);
    expect(stdout).toContain("Usage: bdk demo show <id> [flags]");
    expect(stdout).toMatch(/^ {2}<id> +Item id$/m);
    expect(stdout).toMatch(/^ {2}--upper +Print in upper case$/m);
    expect(stdout).toMatch(/^ {2}1 +the item is empty$/m);
    expect(stdout).toMatch(/^ {2}2 +usage error$/m);
  });

  it("marks a repeatable flag in the command help", async () => {
    const { stdout } = await bdk(["demo", "tag", "--help"]);
    expect(stdout).toMatch(/^ {2}--name <value> +One tag \(repeatable\)$/m);
  });

  it("prints the help of a one-command group as command help", async () => {
    const { exit, stdout } = await bdk(["solo", "--help"]);
    expect(exit).toBe(0);
    expect(stdout).toContain("Usage: bdk solo [flags]");
  });
});

describe("version", () => {
  it.each([[["--version"]], [["--version", "--json"]], [["demo", "show", "--version"]]])(
    "prints the bare version for %j",
    async (argv) => {
      expect(await bdk(argv)).toEqual({ exit: 0, stdout: "9.8.7\n", stderr: "" });
    },
  );
});

describe("results", () => {
  it("prints the text result with a final newline", async () => {
    expect(await bdk(["demo", "show", "x"])).toEqual({ exit: 0, stdout: "item x\n", stderr: "" });
    expect(await bdk(["solo"])).toEqual({ exit: 0, stdout: "done\n", stderr: "" });
  });

  it("accepts flags before and after the arguments", async () => {
    expect((await bdk(["demo", "show", "--upper", "x"])).stdout).toBe("item X\n");
    expect((await bdk(["demo", "show", "x", "--upper"])).stdout).toBe("item X\n");
  });

  it("collects every value of a repeatable flag in order", async () => {
    const { exit, stdout } = await bdk(["demo", "tag", "--name", "a", "--json", "--name", "b"]);
    expect(exit).toBe(0);
    expect(json(stdout)).toEqual({ names: ["a", "b"] });
  });

  it("prints the result as one compact JSON document under --json", async () => {
    const { exit, stdout, stderr } = await bdk(["--json", "demo", "show", "x"]);
    expect(exit).toBe(0);
    expect(stderr).toBe("");
    expect(json(stdout)).toEqual({ id: "x" });
  });

  it("exits 1 with a normal result when the answer is no", async () => {
    expect(await bdk(["demo", "show", "empty"])).toEqual({
      exit: 1,
      stdout: "item empty\n",
      stderr: "",
    });
    const { exit, stdout } = await bdk(["demo", "show", "empty", "--json"]);
    expect(exit).toBe(1);
    expect(json(stdout)).toEqual({ id: "empty" });
  });

  it("gives byte-identical output on every run", async () => {
    const first = await bdk(["demo", "list", "--json"]);
    const second = await bdk(["demo", "list", "--json"]);
    expect(second).toEqual(first);
    expect(first.stdout).not.toContain("\u001b");
  });
});

describe("errors", () => {
  it("suggests the closest group for an unknown one", async () => {
    const { exit, stdout, stderr } = await bdk(["dmeo", "show"]);
    expect(exit).toBe(2);
    expect(stdout).toBe("");
    expect(stderr).toBe(
      "bdk: unknown command group dmeo\nhint: did you mean demo? Run bdk --help for the command groups.\n",
    );
  });

  it("reports an unknown group as a JSON error on stdout under --json", async () => {
    const { exit, stdout, stderr } = await bdk(["dmeo", "--json"]);
    expect(exit).toBe(2);
    expect(stderr).toBe("");
    expect(json(stdout)).toEqual({
      error: {
        code: "usage/unknown-command",
        message: "unknown command group dmeo",
        hint: "did you mean demo? Run bdk --help for the command groups.",
      },
    });
  });

  it("suggests the closest verb for an unknown one", async () => {
    const { exit, stderr } = await bdk(["demo", "lsit"]);
    expect(exit).toBe(2);
    expect(stderr).toBe(
      "bdk: unknown command demo lsit\nhint: did you mean list? Run bdk demo --help for its commands.\n",
    );
  });

  it("names the help when nothing is close", async () => {
    const { exit, stderr } = await bdk(["zzzzzz"]);
    expect(exit).toBe(2);
    expect(stderr).toBe(
      "bdk: unknown command group zzzzzz\nhint: Run bdk --help for the command groups.\n",
    );
  });

  it("refuses an unknown flag without running the command", async () => {
    calls.length = 0;
    const { exit, stderr } = await bdk(["demo", "show", "x", "--loud"]);
    expect(exit).toBe(2);
    expect(calls).toEqual([]);
    expect(stderr).toBe(
      "bdk: unknown flag --loud for bdk demo show\nhint: Run bdk demo show --help for its flags.\n",
    );
  });

  it("refuses a missing required argument", async () => {
    const { exit, stdout } = await bdk(["demo", "show", "--json"]);
    expect(exit).toBe(2);
    expect(json(stdout)).toMatchObject({
      error: { code: "usage/missing-argument", message: "missing argument <id>" },
    });
  });

  it("refuses an extra argument", async () => {
    const { exit, stdout } = await bdk(["demo", "show", "x", "y", "--json"]);
    expect(exit).toBe(2);
    expect(json(stdout)).toMatchObject({
      error: { code: "usage/invalid-argument", message: "unexpected argument y" },
    });
  });

  it("refuses a flag without its value", async () => {
    const { exit, stdout } = await bdk(["demo", "list", "--limit", "--json"]);
    expect(exit).toBe(2);
    expect(json(stdout)).toMatchObject({ error: { code: "usage/invalid-argument" } });
  });

  it("passes on an error a command raises, with the exit code of its class", async () => {
    expect(await bdk(["demo", "list", "--limit", "x"])).toEqual({
      exit: 2,
      stdout: "",
      stderr: "bdk: --limit takes a whole number, got x\n",
    });
    expect(await bdk(["demo", "show", "missing"])).toEqual({
      exit: 3,
      stdout: "",
      stderr: "bdk: no item missing\nhint: create it first\n",
    });
  });

  it("reports an unexpected exception as an internal error with the stack", async () => {
    const text = await bdk(["demo", "show", "boom"]);
    expect(text.exit).toBe(4);
    expect(text.stdout).toBe("");
    expect(text.stderr).toMatch(/^bdk: internal error: kaput\nError: kaput\n {4}at /);
    const asJson = await bdk(["demo", "show", "boom", "--json"]);
    expect(asJson.exit).toBe(4);
    expect(asJson.stderr).toBe("");
    expect(json(asJson.stdout)).toEqual({
      error: { code: "internal/unexpected", message: "kaput" },
    });
  });

  it.each([["22.17.9"], ["20.19.0"]])("refuses to run on Node %s", async (nodeVersion) => {
    const { exit, stderr } = await bdk(["demo", "show", "x"], { nodeVersion });
    expect(exit).toBe(3);
    expect(stderr).toBe(
      `bdk: Node ${nodeVersion} is too old; bdk needs Node 22.18.0 or later\nhint: install Node 22.18.0 or later\n`,
    );
  });

  it.each([["22.18.0"], ["22.19.1"], ["24.0.0"]])("runs on Node %s", async (nodeVersion) => {
    expect((await bdk(["solo"], { nodeVersion })).exit).toBe(0);
  });
});

describe("declarations", () => {
  it("rejects a group that mixes a command without a verb with others", async () => {
    let stderr = "";
    const broken: Group = {
      ...solo,
      commands: [...solo.commands, { ...doIt, verb: "x" }],
    };
    const exit = await run({
      argv: ["solo"],
      version: "1.0.0",
      nodeVersion: "22.18.0",
      groups: [broken],
      stdout: () => undefined,
      stderr: (text) => (stderr += text),
    });
    expect(exit).toBe(4);
    expect(stderr).toContain("group solo mixes a command without a verb with other commands");
  });
});
