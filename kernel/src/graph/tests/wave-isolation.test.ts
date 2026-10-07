// The isolation rules of the execute wave (`kernel-cli/graph`, bdk next; T45):
// each item's `isolation` and `workdir`, a worktree part alone while worktrees
// are disabled, the `max-live` bound, and the `Files:` rule before both.
import { describe, expect, it } from "vitest";

import type { Graph, GraphNode } from "../domain/engine.ts";
import { executeWave } from "../domain/wave.ts";
import type { WaveInput } from "../domain/wave.ts";

function graph(parts: readonly string[]): Graph {
  const nodes = parts.map(
    (nn, position) =>
      ({
        id: `execute-part:${nn}`,
        kind: "execute-part",
        stage: "execute",
        position,
        nn,
        state: "ready",
        requires: [],
        sealed: false,
      }) as unknown as GraphNode,
  );
  return { nodes, gates: [], find: (id) => nodes.find((node) => node.id === id) };
}

const WORKDIR = "/repo/.bdk/.machine/worktrees/c/02";

function wave(overrides: Partial<WaveInput> & { parts?: readonly string[] } = {}) {
  const { parts = ["01", "02", "03"], ...rest } = overrides;
  return executeWave({
    graph: graph(parts),
    files: new Map(parts.map((nn) => [nn, [`src/${nn}.ts`]])),
    overlap: (own, other) => own.find((path) => other.includes(path)),
    started: new Set(),
    tickets: [],
    isolation: new Map([["02", "worktree"]]),
    worktree: { enabled: true, "max-live": 3 },
    live: new Map(),
    liveCount: 0,
    ...rest,
  });
}

const listed = (items: readonly { part: string }[]) => items.map((item) => item.part);

describe("the isolation of the execute wave", () => {
  it("carries isolation, and workdir for a live worktree part", () => {
    const items = wave({
      started: new Set(["02"]),
      live: new Map([["02", WORKDIR]]),
      liveCount: 1,
    });
    expect(
      items.map(({ part, isolation, workdir }) => ({ part, isolation, workdir })),
    ).toStrictEqual([
      { part: "01", isolation: "shared", workdir: undefined },
      { part: "02", isolation: "worktree", workdir: WORKDIR },
      { part: "03", isolation: "shared", workdir: undefined },
    ]);
    expect("workdir" in (items[0] ?? {})).toBe(false);
  });

  it("gives a worktree part not started no workdir", () => {
    expect(wave()[1]).toMatchObject({ part: "02", isolation: "worktree", started: false });
    expect("workdir" in (wave()[1] ?? {})).toBe(false);
  });

  it("lists a worktree part only alone while worktrees are disabled", () => {
    const disabled = { worktree: { enabled: false, "max-live": 3 } };
    expect(listed(wave(disabled))).toStrictEqual(["01", "03"]);
    expect(listed(wave({ ...disabled, parts: ["02", "03"] }))).toStrictEqual(["02"]);
  });

  it("lets nothing new join a worktree part started without its worktree", () => {
    const items = wave({
      worktree: { enabled: false, "max-live": 3 },
      parts: ["02", "03"],
      started: new Set(["02"]),
    });
    expect(listed(items)).toStrictEqual(["02"]);
  });

  it("holds a worktree part not started at max-live", () => {
    const items = wave({
      isolation: new Map([
        ["02", "worktree"],
        ["03", "worktree"],
      ]),
      worktree: { enabled: true, "max-live": 1 },
      started: new Set(["02"]),
      live: new Map([["02", WORKDIR]]),
      liveCount: 1,
    });
    expect(listed(items)).toStrictEqual(["01", "02"]);
  });

  it("counts the worktrees of other Changes and of parts listed before", () => {
    const both = new Map<string, "shared" | "worktree">([
      ["02", "worktree"],
      ["03", "worktree"],
    ]);
    expect(
      listed(wave({ isolation: both, worktree: { enabled: true, "max-live": 2 }, liveCount: 1 })),
    ).toStrictEqual(["01", "02"]);
    expect(
      listed(wave({ isolation: both, worktree: { enabled: true, "max-live": 2 } })),
    ).toStrictEqual(["01", "02", "03"]);
  });

  it("applies the Files: rule first", () => {
    const items = wave({
      files: new Map([
        ["01", ["src/client.ts"]],
        ["02", ["src/client.ts"]],
        ["03", ["src/03.ts"]],
      ]),
      worktree: { enabled: false, "max-live": 3 },
    });
    expect(listed(items)).toStrictEqual(["01", "03"]);
  });
});
