// `bdk spec merge` (`kernel-cli/spec`; T30-D1, D5 to D7): the algorithm, the
// idempotence, the hash, the review gate and the conflict rule.
import { describe, expect, it } from "vitest";

import { bodyHash, livingOf } from "../use-cases/living.ts";
import { mergeSpecs } from "../use-cases/merge.ts";
import {
  archive,
  block,
  CHANGE,
  decide,
  GLOBAL,
  ID,
  OTHER,
  PURPOSE,
  specPath,
  world,
  writeDelta,
  writeSpec,
} from "./support.ts";
import type { World } from "./support.ts";

const CAP = "auth/login";

async function merge(w: World, dryRun = false) {
  return mergeSpecs(w.deps, CHANGE, GLOBAL, dryRun);
}

function names(w: World, capability = CAP): string[] {
  const text = w.store.read(specPath(capability)) ?? "";
  return livingOf(text).requirements.map((requirement) => requirement.name);
}

function scenarios(w: World, requirement: string): string[] {
  const living = livingOf(w.store.read(specPath(CAP)) ?? "");
  return (
    living.requirements
      .find((item) => item.name === requirement)
      ?.scenarios.map((scenario) => scenario.name) ?? []
  );
}

/** A spec with A (a1, a2), B (b1) and C (c1). */
function seeded(): World {
  const w = world();
  writeSpec(
    w.store,
    CAP,
    [block("A", ["a1", "a2"]), block("B", ["b1"]), block("C", ["c1"])].join("\n"),
  );
  return w;
}

describe("the merge algorithm", () => {
  it("removes a whole requirement and only listed scenarios", async () => {
    const w = seeded();
    writeDelta(
      w.store,
      CAP,
      "## REMOVED Requirements\n\n### Requirement: B\n\n**Reason**: gone\n\n### Requirement: A\n\n#### Scenario: a2\n",
    );
    const report = await merge(w);
    expect(report).toMatchObject({
      merged: [{ capability: CAP, added: 0, modified: 1, removed: 1 }],
      conflicts: [],
    });
    expect(names(w)).toStrictEqual(["A", "C"]);
    expect(scenarios(w, "A")).toStrictEqual(["a1"]);
  });

  it("replaces a modified block in place and appends added ones in delta order", async () => {
    const w = seeded();
    writeDelta(
      w.store,
      CAP,
      [
        `## ADDED Requirements\n\n${block("Z", ["z"])}\n${block("D", ["d"])}`,
        `## MODIFIED Requirements\n\n${block("B", ["b1", "b2"], "SHALL now work")}`,
      ].join("\n"),
    );
    expect(await merge(w)).toMatchObject({ merged: [{ added: 2, modified: 1, removed: 0 }] });
    expect(names(w)).toStrictEqual(["A", "B", "C", "Z", "D"]);
    expect(scenarios(w, "B")).toStrictEqual(["b1", "b2"]);
    expect(w.store.read(specPath(CAP))).toContain("The system SHALL now work for b.");
  });

  it("replaces the purpose", async () => {
    const w = seeded();
    const purpose = "A new purpose of this capability, long enough to describe it well.";
    writeDelta(w.store, CAP, `## Purpose\n\n${purpose}\n`);
    await merge(w);
    expect(livingOf(w.store.read(specPath(CAP)) ?? "").purpose).toBe(purpose);
  });

  it("creates a capability with its purpose, hash and Change", async () => {
    const w = world();
    writeDelta(
      w.store,
      CAP,
      `## Purpose\n\n${PURPOSE}\n\n## ADDED Requirements\n\n${block("A", ["a"])}`,
    );
    const report = await merge(w);
    const text = w.store.read(specPath(CAP)) ?? "";
    const living = livingOf(text);
    expect(living).toMatchObject({ purpose: PURPOSE, change: ID });
    expect(living.hash).toBe(bodyHash(living.body));
    expect(report).toMatchObject({
      merged: [{ path: ".bdk/specs/auth/login/spec.md", mergeHash: living.hash }],
    });
    expect(text.startsWith(`---\nbdk-merge-hash: ${living.hash}\nbdk-change: ${ID}\n---\n`)).toBe(
      true,
    );
  });

  it("merges each capability of nested deltas in path order", async () => {
    const w = world();
    for (const capability of ["b/x", "a"]) {
      writeDelta(
        w.store,
        capability,
        `## Purpose\n\n${PURPOSE}\n\n## ADDED Requirements\n\n${block("A", ["a"])}`,
      );
    }
    const report = await merge(w);
    expect("merged" in report && report.merged.map((item) => item.capability)).toStrictEqual([
      "a",
      "b/x",
    ]);
  });
});

describe("idempotence", () => {
  it("writes the same bytes on a second run", async () => {
    const w = seeded();
    writeDelta(
      w.store,
      CAP,
      [
        `## ADDED Requirements\n\n${block("D", ["d"])}`,
        `## MODIFIED Requirements\n\n${block("A", ["a1"])}`,
        "## REMOVED Requirements\n\n### Requirement: A\n\n#### Scenario: a2\n\n### Requirement: C\n",
      ].join("\n"),
    );
    await merge(w);
    const first = w.store.read(specPath(CAP));
    const before = w.store.stat(specPath(CAP));
    expect(await merge(w)).toMatchObject({ merged: [{ capability: CAP }] });
    expect(w.store.read(specPath(CAP))).toBe(first);
    expect(w.store.stat(specPath(CAP))?.ino).toBe(before?.ino);
  });

  it("takes an edited delta after a first merge", async () => {
    const w = seeded();
    writeDelta(w.store, CAP, `## ADDED Requirements\n\n${block("D", ["d"])}`);
    await merge(w);
    writeDelta(w.store, CAP, `## ADDED Requirements\n\n${block("D", ["d", "e"])}`);
    await merge(w);
    expect(scenarios(w, "D")).toStrictEqual(["d", "e"]);
  });
});

describe("refusals", () => {
  it("refuses a hand-edited spec and one without the key, writing nothing", async () => {
    const w = seeded();
    writeDelta(w.store, CAP, `## ADDED Requirements\n\n${block("D", ["d"])}`);
    const edited = (w.store.read(specPath(CAP)) ?? "").replace("a1 happens", "a1 happened");
    w.store.write(specPath(CAP), edited);
    expect(await merge(w)).toMatchObject({
      rule: "policy/merge-hash-mismatch",
      why: ".bdk/specs/auth/login/spec.md was edited by hand: content hash differs from bdk-merge-hash",
    });
    expect(w.store.read(specPath(CAP))).toBe(edited);
    w.store.write(specPath(CAP), edited.replace(/^---\n[\s\S]*?\n---\n/, ""));
    expect(await merge(w)).toMatchObject({
      rule: "policy/merge-hash-mismatch",
      why: expect.stringContaining("no bdk-merge-hash") as unknown,
    });
  });

  it("requires gate:review without --dry-run", async () => {
    const w = seeded();
    w.review = false;
    writeDelta(w.store, CAP, `## ADDED Requirements\n\n${block("D", ["d"])}`);
    const before = w.store.read(specPath(CAP));
    expect(await merge(w)).toMatchObject({ rule: "policy/gate-not-ready" });
    expect(await merge(w, true)).toMatchObject({ merged: [{ capability: CAP, added: 1 }] });
    expect(w.store.read(specPath(CAP))).toBe(before);
  });

  it("refuses an invalid delta", async () => {
    const w = seeded();
    writeDelta(w.store, CAP, `## MODIFIED Requirements\n\n${block("A", ["a1"])}`);
    expect(await merge(w)).toMatchObject({
      rule: "policy/spec-invalid",
      why: expect.stringContaining(
        '.bdk/changes/2026-09-25-passwordless-login/spec-delta/auth/login.md:3 scenario-lost: requirement "A" drops scenario "a2"',
      ) as unknown,
    });
  });
});

describe("conflicts", () => {
  const ours = `## MODIFIED Requirements\n\n${block("B", ["b1"], "SHALL work our way")}`;
  const theirs = `## MODIFIED Requirements\n\n${block("B", ["b1"], "SHALL work their way")}`;

  function withOther(closed: string, text = theirs): World {
    const w = seeded();
    writeDelta(w.store, CAP, ours);
    archive(w.store, OTHER, { created: "2026-09-24T09:00:00.000Z", closed }, { [CAP]: text });
    return w;
  }

  it("refuses a requirement an archived Change closed after creation changed, naming both", async () => {
    const w = withOther("2026-09-25T12:00:00.000Z");
    const before = w.store.read(specPath(CAP));
    const refusal = await merge(w);
    expect(refusal).toMatchObject({ rule: "policy/spec-conflict" });
    expect(JSON.stringify(refusal)).toContain(ID);
    expect(JSON.stringify(refusal)).toContain(OTHER);
    expect(w.store.read(specPath(CAP))).toBe(before);
  });

  it("lists the conflict with both texts on a dry run", async () => {
    const w = withOther("2026-09-25T12:00:00.000Z");
    const report = await merge(w, true);
    expect(report).toMatchObject({
      conflicts: [
        {
          capability: CAP,
          requirement: "B",
          ours: expect.stringContaining("our way") as unknown,
          theirs: expect.stringMatching(new RegExp(`^${OTHER}: [\\s\\S]*their way`)) as unknown,
        },
      ],
    });
  });

  it("ignores a Change closed before this one began, or one with the same text", async () => {
    expect(await merge(withOther("2026-09-25T08:00:00.000Z"))).toMatchObject({ conflicts: [] });
    expect(await merge(withOther("2026-09-25T12:00:00.000Z", ours))).toMatchObject({
      conflicts: [],
    });
  });

  it("ignores an archived Change without a close transition", async () => {
    const w = seeded();
    writeDelta(w.store, CAP, ours);
    archive(w.store, OTHER, { created: "2026-09-24T09:00:00.000Z" }, { [CAP]: theirs });
    expect(await merge(w)).toMatchObject({ conflicts: [] });
  });

  it("is resolved by a live decision naming the Change and the delta", async () => {
    const w = withOther("2026-09-25T12:00:00.000Z");
    decide(w.store, [OTHER]);
    expect(await merge(w)).toMatchObject({ rule: "policy/spec-conflict" });
    decide(w.store, [OTHER, `spec-delta/${CAP}.md`]);
    expect(await merge(w)).toMatchObject({ merged: [{ capability: CAP }], conflicts: [] });
    expect(w.store.read(specPath(CAP))).toContain("our way");
  });

  it("is not resolved by a superseded decision", async () => {
    const w = withOther("2026-09-25T12:00:00.000Z");
    const decision = decide(w.store, [OTHER, `spec-delta/${CAP}.md`]);
    decide(w.store, ["something else"], decision);
    expect(await merge(w)).toMatchObject({ rule: "policy/spec-conflict" });
  });
});
