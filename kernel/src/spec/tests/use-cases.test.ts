// `bdk spec delta check` and `bdk spec diff` over the store (`kernel-cli/spec`).
import { describe, expect, it } from "vitest";

import { checkDeltas, deltaProblems } from "../use-cases/check.ts";
import { diffSpecs } from "../use-cases/diff.ts";
import { block, CHANGE, GLOBAL, ID, PURPOSE, world, writeDelta, writeSpec } from "./support.ts";

const CAP = "auth/login";
const PATH = `.bdk/changes/${ID}/spec-delta/auth/login.md`;

describe("checkDeltas", () => {
  it("reports every delta valid", () => {
    const w = world();
    writeSpec(w.store, CAP, block("A", ["a"]));
    writeDelta(w.store, CAP, `## ADDED Requirements\n\n${block("B", ["b"])}`);
    expect(checkDeltas(w.deps, CHANGE, GLOBAL, undefined)).toStrictEqual({
      valid: true,
      deltas: [{ capability: CAP, path: PATH, valid: true, problems: [] }],
    });
  });

  it("answers an empty list for a Change without deltas", () => {
    expect(checkDeltas(world().deps, CHANGE, GLOBAL, undefined)).toStrictEqual({
      valid: true,
      deltas: [],
    });
  });

  it("refuses with every problem in why", () => {
    const w = world();
    writeDelta(
      w.store,
      CAP,
      "## ADDED Requirements\n\n### Requirement: B\n\nIt SHALL.\n\n#### Scenario: b\n\n- **THEN** x\n",
    );
    expect(checkDeltas(w.deps, CHANGE, GLOBAL, undefined)).toStrictEqual({
      refused: true,
      rule: "policy/spec-invalid",
      why: `${PATH}:1 purpose-missing: a new capability needs a ## Purpose section; ${PATH}:7 when-missing: scenario "b" has no "- **WHEN**" bullet`,
      instead: [`fix ${PATH}`, `bdk spec delta check ${CAP}`],
    });
  });

  it("reads the normative word from the settings", () => {
    const w = world();
    w.store.write(`${CHANGE.projectRoot}/.bdk/settings.yaml`, "spec:\n  normative-word: MUST\n");
    writeDelta(
      w.store,
      CAP,
      `## Purpose\n\n${PURPOSE}\n\n## ADDED Requirements\n\n${block("B", ["b"])}`,
    );
    expect(checkDeltas(w.deps, CHANGE, GLOBAL, CAP)).toMatchObject({
      rule: "policy/spec-invalid",
      why: expect.stringContaining("normative-word") as unknown,
    });
  });

  it("checks one capability, input/not-found for one without a delta", () => {
    const w = world();
    writeDelta(
      w.store,
      "a",
      `## Purpose\n\n${PURPOSE}\n\n## ADDED Requirements\n\n${block("A", ["a"])}`,
    );
    writeDelta(w.store, "b", "## ADDED Requirements\n");
    expect(checkDeltas(w.deps, CHANGE, GLOBAL, "a")).toMatchObject({ valid: true });
    expect(checkDeltas(w.deps, CHANGE, GLOBAL, "c")).toMatchObject({ rule: "input/not-found" });
  });

  it("gives the validators the problems of one delta", () => {
    const w = world();
    writeDelta(w.store, CAP, "## ADDED Requirements\n");
    expect(deltaProblems(w.store, CHANGE, CAP, {})).toStrictEqual([
      `${PATH}:1 delta-empty: the delta has no requirement and no purpose`,
    ]);
    expect(deltaProblems(w.store, CHANGE, "none", {})).toBeUndefined();
  });
});

describe("diffSpecs", () => {
  it("counts a scenario removal as a modification", () => {
    const w = world();
    writeSpec(w.store, CAP, block("Magic link expires", ["expired link", "reused link"]));
    writeDelta(
      w.store,
      CAP,
      [
        `## MODIFIED Requirements\n\n${block("Magic link expires", ["expired link"])}`,
        "## REMOVED Requirements\n\n### Requirement: Magic link expires\n\n#### Scenario: reused link\n",
      ].join("\n"),
    );
    expect(diffSpecs(w.deps, CHANGE, CAP)).toStrictEqual({
      capabilities: [
        {
          capability: CAP,
          requirements: [
            { name: "Magic link expires", change: "modified", scenarios: { added: 0, removed: 1 } },
          ],
        },
      ],
    });
  });

  it("lists added, modified and removed requirements in delta order", () => {
    const w = world();
    writeSpec(
      w.store,
      CAP,
      [block("A", ["a1", "a2"]), block("B", ["b1"]), block("C", ["c"])].join("\n"),
    );
    writeDelta(
      w.store,
      CAP,
      [
        "## REMOVED Requirements\n\n### Requirement: C\n\n### Requirement: A\n\n#### Scenario: a2\n",
        `## ADDED Requirements\n\n${block("D", ["d1", "d2"])}`,
        `## MODIFIED Requirements\n\n${block("B", ["b1", "b2", "b3"])}`,
      ].join("\n"),
    );
    expect(diffSpecs(w.deps, CHANGE, undefined)).toMatchObject({
      capabilities: [
        {
          requirements: [
            { name: "C", change: "removed", scenarios: { added: 0, removed: 1 } },
            { name: "A", change: "modified", scenarios: { added: 0, removed: 1 } },
            { name: "D", change: "added", scenarios: { added: 2, removed: 0 } },
            { name: "B", change: "modified", scenarios: { added: 2, removed: 0 } },
          ],
        },
      ],
    });
  });

  it("answers input/not-found for a capability without a delta", () => {
    expect(diffSpecs(world().deps, CHANGE, CAP)).toMatchObject({ rule: "input/not-found" });
  });
});
