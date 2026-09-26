// A small command index and an in-memory invocation for the registry tests.
import type { Streams } from "../../output/index.ts";
import type { CommandIndex, CommandRecord, Runtime } from "../index.ts";

function record(
  partial: Partial<CommandRecord> & Pick<CommandRecord, "id" | "argv">,
): CommandRecord {
  return {
    summary: `summary of ${partial.id}`,
    availability: "read",
    mode: "command",
    slice: "service",
    owner: "T11",
    changeScoped: false,
    args: [],
    flags: [],
    output: `output/${partial.id}.json`,
    exits: [0, 2, 3, 5],
    refusals: [],
    writes: [],
    ...partial,
  };
}

export const INDEX: CommandIndex = {
  contract: 3,
  base: {
    all: [
      "input/unknown-command",
      "input/unknown-flag",
      "input/missing-argument",
      "input/invalid-argument",
      "runtime/node-version",
      "runtime/not-a-repo",
    ],
    changeScoped: ["policy/no-active-change"],
  },
  commands: [
    record({ id: "version", argv: ["version"], standalone: true, exits: [0, 3] }),
    record({ id: "doctor", argv: ["doctor"], flags: [{ name: "--fix" }] }),
    record({
      id: "attempt-close",
      argv: ["attempt", "close"],
      owner: "T22",
      args: [
        { name: "<ticket>", required: true, description: "Ticket id." },
        { name: "outcome", required: true, values: ["ok", "fail", "not-run"] },
      ],
      flags: [
        { name: "--envelope", value: "<path>", description: "Envelope file." },
        { name: "--type", values: ["a", "b"] },
        { name: "--all" },
      ],
    }),
    record({ id: "attempt-list", argv: ["attempt", "list"], owner: "T22" }),
    record({ id: "spec-delta-check", argv: ["spec", "delta", "check"], owner: "T30" }),
    record({ id: "ctx-skill", argv: ["ctx", "skill"], mode: "inject", owner: "T13", exits: [0] }),
    record({
      id: "hooks-pre-tool",
      argv: ["hooks", "pre-tool"],
      mode: "guard",
      owner: "T24",
      exits: [0, 2],
    }),
  ],
};

export interface Captured {
  readonly streams: Streams;
  stdout(): string;
  stderr(): string;
}

export function capture(): Captured {
  let out = "";
  let err = "";
  return {
    streams: {
      stdout: (text) => {
        out += text;
      },
      stderr: (text) => {
        err += text;
      },
    },
    stdout: () => out,
    stderr: () => err,
  };
}

export function runtime(overrides: Partial<Runtime> = {}): Runtime {
  return {
    nodeVersion: "24.21.0",
    env: {},
    platform: "linux",
    home: "/home/dev",
    workTree: () => "/repo",
    which: () => undefined,
    ...overrides,
  };
}
