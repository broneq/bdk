// `kernel-cli/spec` through the built bundle in real repositories: one
// case per exit code and per declared rule of `spec delta check`, `spec
// merge` and `spec diff`, every output validated against its schema, and the
// acceptance scenarios of T30.
import { rmSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { answered, bdk, outsideRepository, read, refused } from "../../../tests/support/repo.ts";
import { fileStore } from "../../shared/store/index.ts";
import {
  archived,
  block,
  creating,
  executed,
  planned,
  PURPOSE,
  reviewed,
  writeDelta,
  writeLiving,
} from "./e2e-support.ts";

const CAP = "auth/login";
const SPEC = ".bdk/specs/auth/login/spec.md";
const EXPIRES = block("Magic link expires", ["expired link", "reused link"]);

function check(root: string, ...argv: string[]) {
  return bdk(["spec", "delta", "check", ...argv, "--json"], root);
}

function merge(root: string, ...argv: string[]) {
  return bdk(["spec", "merge", ...argv, "--json"], root);
}

describe("bdk spec delta check", () => {
  it("exit 0: the example run", () => {
    const change = planned({ deltas: { [CAP]: creating(["Magic link sent", ["sent"]]) } });
    expect(answered(check(change.root, CAP), "output/spec-delta-check.json")).toStrictEqual({
      valid: true,
      deltas: [
        {
          capability: CAP,
          path: `.bdk/changes/${change.id}/spec-delta/auth/login.md`,
          valid: true,
          problems: [],
        },
      ],
    });
    expect(bdk(["spec", "delta", "check"], change.root).stdout).toContain("valid: .bdk/changes/");
  });

  it("exit 3: input/not-found", () => {
    const change = planned();
    refused(check(change.root, "auth/none"), 3, "input/not-found");
  });

  it("exit 2: policy/spec-invalid", () => {
    const change = planned();
    writeDelta(change, CAP, "## ADDED Requirements\n");
    refused(check(change.root), 2, "policy/spec-invalid");
    const text = bdk(["spec", "delta", "check"], change.root);
    expect(text.code).toBe(2);
    expect(text.stdout).toContain("policy/spec-invalid");
  });

  it("exit 4: state/change-dir-missing", () => {
    const change = planned();
    rmSync(change.dir, { recursive: true });
    refused(check(change.root), 4, "state/change-dir-missing");
  });

  it("exit 5: runtime/not-a-repo", () => {
    refused(check(outsideRepository()), 5, "runtime/not-a-repo");
  });

  it("acceptance: delta without WHEN rejected", () => {
    const change = planned();
    writeDelta(
      change,
      CAP,
      `## Purpose\n\n${PURPOSE}\n\n## ADDED Requirements\n\n### Requirement: Magic link sent\n\nThe system SHALL send.\n\n#### Scenario: sent\n\n- **THEN** a link is sent\n`,
    );
    const refusal = refused(check(change.root), 2, "policy/spec-invalid");
    expect(refusal.why).toBe(
      `.bdk/changes/${change.id}/spec-delta/auth/login.md:11 when-missing: scenario "sent" has no "- **WHEN**" bullet`,
    );
  });

  it("acceptance: scenario removed without REMOVED is an error, through REMOVED it passes", () => {
    const change = planned({ living: { [CAP]: EXPIRES } });
    const modified = `## MODIFIED Requirements\n\n${block("Magic link expires", ["expired link"])}`;
    writeDelta(change, CAP, modified);
    const refusal = refused(check(change.root), 2, "policy/spec-invalid");
    expect(refusal.why).toContain("scenario-lost");
    expect(refusal.why).toContain("reused link");
    writeDelta(
      change,
      CAP,
      `${modified}\n## REMOVED Requirements\n\n### Requirement: Magic link expires\n\n#### Scenario: reused link\n`,
    );
    expect(answered(check(change.root), "output/spec-delta-check.json").valid).toBe(true);
  });

  it("acceptance: configured normative word", () => {
    const change = planned({ settings: "spec:\n  normative-word: MUST\n" });
    writeDelta(change, CAP, creating(["Magic link sent", ["sent"]]));
    expect(refused(check(change.root), 2, "policy/spec-invalid").why).toContain("normative-word");
  });
});

describe("bdk spec merge", () => {
  it("exit 0: the example run creates the capability with its purpose", () => {
    const change = reviewed({ deltas: { [CAP]: creating(["Magic link sent", ["sent"]]) } });
    const report = answered(merge(change.root), "output/spec-merge.json");
    expect(report).toMatchObject({
      merged: [{ capability: CAP, path: SPEC, added: 1, modified: 0, removed: 0 }],
      conflicts: [],
    });
    const text = read(change.root, SPEC);
    expect(text).toContain(
      `bdk-merge-hash: ${String((report.merged as { mergeHash: string }[])[0]?.mergeHash)}`,
    );
    expect(text).toContain(`bdk-change: ${change.id}`);
    expect(text).toContain(`## Purpose\n\n${PURPOSE}\n`);
    expect(text).toContain("### Requirement: Magic link sent");
  });

  it("acceptance: merge is idempotent", () => {
    const change = reviewed({ deltas: { [CAP]: creating(["Magic link sent", ["sent"]]) } });
    answered(merge(change.root), "output/spec-merge.json");
    const first = read(change.root, SPEC);
    answered(merge(change.root), "output/spec-merge.json");
    expect(read(change.root, SPEC)).toBe(first);
  });

  it("exit 2: policy/gate-not-ready, while --dry-run previews", () => {
    const change = executed({ deltas: { [CAP]: creating(["Magic link sent", ["sent"]]) } });
    refused(merge(change.root), 2, "policy/gate-not-ready");
    expect(answered(merge(change.root, "--dry-run"), "output/spec-merge.json")).toMatchObject({
      merged: [{ capability: CAP }],
    });
    expect(bdk(["spec", "merge", "--dry-run"], change.root).stdout).toContain(
      `would merge ${CAP}: ${SPEC}`,
    );
  });

  it("exit 2: policy/merge-hash-mismatch", () => {
    const change = reviewed({ deltas: { [CAP]: creating(["Magic link sent", ["sent"]]) } });
    answered(merge(change.root), "output/spec-merge.json");
    const path = join(change.root, SPEC);
    fileStore().write(path, read(change.root, SPEC).replace("sent happens", "sent happened"));
    const refusal = refused(merge(change.root), 2, "policy/merge-hash-mismatch");
    expect(refusal.why).toBe(
      `${SPEC} was edited by hand: content hash differs from bdk-merge-hash`,
    );
  });

  it("acceptance: a manual edit after the merge is reported by doctor", () => {
    const change = reviewed({ deltas: { [CAP]: creating(["Magic link sent", ["sent"]]) } });
    answered(merge(change.root), "output/spec-merge.json");
    const doctor = () => answered(bdk(["doctor", "--json"], change.root), "output/doctor.json");
    expect(doctor().findings).toStrictEqual([]);
    fileStore().write(join(change.root, SPEC), `${read(change.root, SPEC)}Edited.\n`);
    expect(doctor().findings).toStrictEqual([
      expect.objectContaining({
        id: "merge-hash",
        level: "fail",
        summary: `${SPEC} was edited outside spec merge: content hash differs from bdk-merge-hash`,
      }),
    ]);
  });

  it("exit 2: policy/spec-invalid", () => {
    const change = reviewed({ deltas: { [CAP]: creating(["Magic link sent", ["sent"]]) } });
    writeDelta(change, CAP, "## ADDED Requirements\n");
    refused(merge(change.root), 2, "policy/spec-invalid");
  });

  describe("acceptance: two Changes edit the same capability", () => {
    const OTHER = "2026-01-01-link-lifetime";
    const theirs = `## MODIFIED Requirements\n\n${block("Magic link expires", ["expired link", "reused link"], "SHALL expire after 15 minutes")}`;
    const ours = `## MODIFIED Requirements\n\n${block("Magic link expires", ["expired link", "reused link"], "SHALL expire after 10 minutes")}`;

    function contested() {
      const change = reviewed({ living: { [CAP]: EXPIRES }, deltas: { [CAP]: ours } });
      // A closed after B began and its merge is on B's branch.
      archived(change.root, OTHER, new Date(Date.now() + 5000).toISOString(), { [CAP]: theirs });
      writeLiving(
        change.root,
        CAP,
        block(
          "Magic link expires",
          ["expired link", "reused link"],
          "SHALL expire after 15 minutes",
        ),
        OTHER,
      );
      return change;
    }

    it("exit 2: policy/spec-conflict naming both Changes; --dry-run shows both deltas", () => {
      const change = contested();
      const preview = answered(merge(change.root, "--dry-run"), "output/spec-merge.json");
      expect(preview.conflicts).toStrictEqual([
        {
          capability: CAP,
          requirement: "Magic link expires",
          ours: expect.stringContaining("10 minutes") as unknown,
          theirs: expect.stringMatching(new RegExp(`^${OTHER}: [\\s\\S]*15 minutes`)) as unknown,
        },
      ]);
      const before = read(change.root, SPEC);
      const refusal = refused(merge(change.root), 2, "policy/spec-conflict");
      expect(refusal.why).toContain(change.id);
      expect(refusal.why).toContain(OTHER);
      expect(read(change.root, SPEC)).toBe(before);
    });

    it("acceptance: conflict resolved by a decision", () => {
      const change = contested();
      answered(
        bdk(
          [
            "log",
            "add",
            "decision",
            "keep the 10 minute expiry",
            "--ref",
            OTHER,
            "--ref",
            `spec-delta/${CAP}.md`,
            "--json",
          ],
          change.root,
        ),
        "output/log-add.json",
      );
      answered(merge(change.root), "output/spec-merge.json");
      expect(read(change.root, SPEC)).toContain("SHALL expire after 10 minutes");
    });
  });
});

describe("bdk spec diff", () => {
  it("exit 0: the example run", () => {
    const change = planned({ deltas: { [CAP]: creating(["Magic link expires", ["a", "b"]]) } });
    expect(
      answered(bdk(["spec", "diff", CAP, "--json"], change.root), "output/spec-diff.json"),
    ).toStrictEqual({
      capabilities: [
        {
          capability: CAP,
          requirements: [
            { name: "Magic link expires", change: "added", scenarios: { added: 2, removed: 0 } },
          ],
        },
      ],
    });
    expect(bdk(["spec", "diff"], change.root).stdout).toContain(
      "  added Magic link expires (scenarios +2 -0)",
    );
  });

  it("exit 3: input/not-found", () => {
    refused(bdk(["spec", "diff", CAP, "--json"], planned().root), 3, "input/not-found");
  });

  it("acceptance: scenario removal counted", () => {
    const change = planned({ living: { [CAP]: EXPIRES } });
    writeDelta(
      change,
      CAP,
      `## MODIFIED Requirements\n\n${block("Magic link expires", ["expired link"])}\n## REMOVED Requirements\n\n### Requirement: Magic link expires\n\n#### Scenario: reused link\n`,
    );
    const report = answered(bdk(["spec", "diff", "--json"], change.root), "output/spec-diff.json");
    expect(report.capabilities).toStrictEqual([
      {
        capability: CAP,
        requirements: [
          { name: "Magic link expires", change: "modified", scenarios: { added: 0, removed: 1 } },
        ],
      },
    ]);
  });
});

describe("bdk validate with a spec delta", () => {
  const noWhen = `## Purpose\n\n${PURPOSE}\n\n## ADDED Requirements\n\n### Requirement: Magic link sent\n\nThe system SHALL send.\n\n#### Scenario: sent\n\n- **THEN** a link is sent\n`;

  it("spec-delta: valid false naming when-missing; exit 2 policy/spec-invalid in text mode", () => {
    const change = planned({ deltas: { [CAP]: creating(["Magic link sent", ["sent"]]) } });
    writeDelta(change, CAP, noWhen);
    const report = answered(
      bdk(["validate", "spec-delta", "--json"], change.root),
      "output/validate.json",
    );
    expect(report.valid).toBe(false);
    expect(report.checks).toContainEqual(
      expect.objectContaining({
        id: `delta:${CAP}`,
        ok: false,
        why: expect.stringContaining("when-missing") as unknown,
      }),
    );
    const text = bdk(["validate", "spec-delta"], change.root);
    expect(text.code).toBe(2);
    expect(text.stdout + text.stderr).toContain("policy/spec-invalid");
  });

  it("plan-part: an invalid delta the part names fails check spec-impact", () => {
    const change = planned({ deltas: { [CAP]: creating(["Magic link sent", ["sent"]]) } });
    writeDelta(change, CAP, noWhen.replace("- **THEN** a link is sent", "- **WHEN** asked"));
    const report = answered(
      bdk(["validate", "plan-part:01", "--json"], change.root),
      "output/validate.json",
    );
    expect(report.valid).toBe(false);
    expect(report.checks).toContainEqual(
      expect.objectContaining({
        id: "spec-impact",
        ok: false,
        why: expect.stringContaining(
          `.bdk/changes/${change.id}/spec-delta/auth/login.md:11 then-missing`,
        ) as unknown,
      }),
    );
  });
});
