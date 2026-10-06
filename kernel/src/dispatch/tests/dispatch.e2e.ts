// `kernel-cli/dispatch` through the built bundle in real repositories: one
// case per exit code and per declared rule of `dispatch build` and `dispatch
// show`, every output validated against its schema, and the T23 part B
// acceptance cases on the package.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  answered,
  bdk,
  outsideRepository,
  read,
  refused,
  repository,
} from "../../../tests/support/repo.ts";
import { closed, executed, opened, started } from "../../attempt/tests/e2e-support.ts";
import type { Started } from "../../attempt/tests/e2e-support.ts";
import { fileStore } from "../../shared/store/index.ts";

interface Built {
  readonly path: string;
  readonly bytes: number;
  readonly templateHash: string;
  readonly entries: { readonly full: string[]; readonly counted: Record<string, number> };
}

function build(change: Started, target: string, role: string, ticket: string) {
  return bdk(["dispatch", "build", target, role, ticket, "--json"], change.root);
}

function built(change: Started, target: string, role: string, ticket: string): Built {
  return answered(
    build(change, target, role, ticket),
    "output/dispatch-build.json",
  ) as unknown as Built;
}

function add(change: Started, ...args: string[]): string {
  const result = bdk(["log", "add", ...args, "--json"], change.root);
  return (answered(result, "output/log-add.json").entry as { id: string }).id;
}

function packages(change: Started): string[] {
  return fileStore().list(join(change.dir, "dispatch"));
}

describe("bdk dispatch build", () => {
  it("exit 0: the implementer's package validates and embeds the task, role body and commands", () => {
    const change = started();
    const ticket = opened(change, "task-redispatch", "01-1");
    const report = built(change, "01-1", "implementer", ticket);
    const text = read(change.root, report.path);
    expect(report.bytes).toBe(Buffer.byteLength(text));
    expect(text).toContain("\n### 01-1 Task 1\n");
    expect(text).toContain("`do-not-touch`: `src/billing/**`.");
    expect(text).toContain("\n## Role: implementer\n");
    // A subagent reads the package with Read, which substitutes nothing, and its
    // Bash has no CLAUDE_PLUGIN_ROOT: the package names the bundle by its path.
    expect(text).not.toContain("${CLAUDE_PLUGIN_ROOT}");
    expect(text).not.toContain("bdk.mjs");
    expect(text).toContain(`bdk rules show --ticket ${ticket}`);
    expect(text).toContain(`bdk log ingest --ticket ${ticket}`);
    // The package size of the tiny fixture, recorded for the 12 288-byte budget.
    expect(report.bytes).toBeLessThan(8_192);
  });

  it("exit 0: accepted decisions and open blockers in full, the rest counted (acceptance B)", () => {
    const change = started();
    const ticket = opened(change, "task-redispatch", "01-1");
    const accepted = add(
      change,
      "decision",
      "tokens are single use",
      "--ref",
      "01-1",
      "--status",
      "accepted",
    );
    add(change, "decision", "maybe rotate keys", "--ref", "01-1");
    const blocker = add(change, "blocker", "the clock source is unknown", "--ref", "01-1");
    add(change, "finding", "expired link accepted", "--ref", "src/01-1.ts");
    add(change, "finding", "no test for skew", "--ref", "01-1");
    const report = built(change, "01-1", "implementer", ticket);
    // Entries of the same second order by id, as `log list` does.
    expect([...report.entries.full].sort()).toStrictEqual([accepted, blocker].sort());
    expect(report.entries.counted).toStrictEqual({ decision: 1, finding: 2 });
    const text = read(change.root, report.path);
    expect(text).toContain("tokens are single use");
    expect(text).toContain("the clock source is unknown");
    expect(text).not.toContain("maybe rotate keys");
    expect(text).toContain("`bdk log list --for 01-1`");
  });

  it("exit 0: a verifier package lists the categories with a project one, then not-a-fail", () => {
    const change = started(
      "policy:\n  verifier:\n    blocking-categories:\n      - id: accessibility\n        description: An accessibility regression.\n",
    );
    // A tiny Change skips plan-verify; the unit tests cover the artifact target.
    const ticket = opened(change, "verify-fix", "01");
    const report = built(change, "01", "verifier", ticket);
    const text = read(change.root, report.path);
    expect(text).toContain("- `false-code-claim`:");
    expect(text).toContain("- `accessibility`: An accessibility regression.");
    expect(text.indexOf("- `accessibility`")).toBeLessThan(text.indexOf("## Not a fail"));
    expect(text).toContain(`plan/parts/01-part.md`);
    // The verify-fix ticket holds the part's files until it closes (policy/files-busy).
    closed(change, ticket, "not-run", "--reason", "r");
    const implementer = opened(change, "task-redispatch", "01-1");
    expect(read(change.root, built(change, "01-1", "implementer", implementer).path)).not.toContain(
      "## Blocking categories",
    );
  });

  it("exit 0: a runner package lists the checks with the task's files, within the size budget", () => {
    const change = started(
      "tools:\n  test:\n    - id: unit\n      tier: fast\n      command: vitest run\n      related: vitest related {files}\n  lint:\n    - id: eslint\n      tier: lint\n      command: eslint .\n      scoped: eslint {files}\n",
    );
    const ticket = opened(change, "task-redispatch", "01-1");
    const report = built(change, "01-1", "runner", ticket);
    const text = read(change.root, report.path);
    expect(text).toContain("## Checks");
    expect(text).toContain("- `vitest related src/01-1.ts`");
    expect(text).toContain("- `eslint src/01-1.ts`");
    expect(text).toContain(`\`bdk evidence record lint <file> --ticket ${ticket} --verdict`);
    expect(text.indexOf("### tests-scoped")).toBeLessThan(text.indexOf("### lint"));
    expect(report.bytes).toBeLessThanOrEqual(12_288);
  });

  it("exit 0: the same package built twice carries the same template hash", () => {
    const change = started();
    const ticket = opened(change, "task-redispatch", "01-1");
    const first = built(change, "01-1", "implementer", ticket);
    add(change, "finding", "a new finding", "--ref", "01-1");
    expect(built(change, "01-1", "implementer", ticket).templateHash).toBe(first.templateHash);
  });

  it("exit 2 policy/package-too-large: a package above 160 KiB names its size and largest section; nothing written [AC-8]", () => {
    const change = started();
    const ticket = opened(change, "task-redispatch", "01-1");
    bdk(
      [
        "log",
        "add",
        "decision",
        "a long decision",
        "--ref",
        "01-1",
        "--status",
        "accepted",
        "--body",
        "-",
        "--json",
      ],
      change.root,
      { stdin: "A long rationale line.\n".repeat(8000) },
    );
    const result = refused(
      build(change, "01-1", "implementer", ticket),
      2,
      "policy/package-too-large",
    );
    expect(result.why).toMatch(
      /^the package is \d{6} bytes, above 163840; the largest section is entries/,
    );
    expect(packages(change)).toStrictEqual([]);
  });

  it("exit 2 policy/placeholder: a TODO in the task's Files (acceptance B)", () => {
    const change = started();
    const ticket = opened(change, "task-redispatch", "01-1");
    const part = join(change.dir, "plan/parts/01-part.md");
    fileStore().write(part, readFileSync(part, "utf8").replace("`src/01-1.ts`", "`TODO`"));
    refused(build(change, "01-1", "implementer", ticket), 2, "policy/placeholder");
    expect(packages(change)).toStrictEqual([]);
  });

  it("exit 2 policy/no-open-ticket: no ticket, a closed one, another target (acceptance B)", () => {
    const change = started();
    refused(build(change, "01-1", "implementer", "A-00000000"), 2, "policy/no-open-ticket");
    const ticket = opened(change, "task-redispatch", "01-1");
    refused(build(change, "01-2", "implementer", ticket), 2, "policy/no-open-ticket");
    closed(change, ticket, "not-run", "--reason", "no runner");
    refused(build(change, "01-1", "implementer", ticket), 2, "policy/no-open-ticket");
  });

  it("exit 3 input/not-found: a target the Change does not hold", () => {
    const change = started();
    refused(build(change, "09-1", "implementer", "A-00000000"), 3, "input/not-found");
  });

  it("exit 3 input/invalid-argument: a role outside the eight", () => {
    const change = started();
    refused(build(change, "01-1", "planner", "A-00000000"), 3, "input/invalid-argument");
  });

  it("exit 4 state/ledger-invalid", () => {
    const change = started();
    const ticket = opened(change, "task-redispatch", "01-1");
    fileStore().write(
      join(change.dir, "log/20260101T000000Z-finding-L-broken00.md"),
      "---\nschema: 1\n---\n",
    );
    refused(build(change, "01-1", "implementer", ticket), 4, "state/ledger-invalid");
  });

  it("exit 5 runtime/not-a-repo", () => {
    refused(
      bdk(
        ["dispatch", "build", "01-1", "implementer", "A-00000000", "--json"],
        outsideRepository(),
      ),
      5,
      "runtime/not-a-repo",
    );
  });
});

describe("bdk dispatch show", () => {
  it("exit 0: by ticket with the frontmatter, and by path byte for byte", () => {
    const change = started();
    const ticket = opened(change, "task-redispatch", "01-1");
    const report = built(change, "01-1", "implementer", ticket);
    const text = read(change.root, report.path);
    const shown = answered(
      bdk(["dispatch", "show", ticket, "--json"], change.root),
      "output/dispatch-show.json",
    );
    expect(shown).toMatchObject({ path: report.path, content: text, frontmatter: { ticket } });
    const byPath = bdk(["dispatch", "show", report.path], change.root);
    expect(byPath.code).toBe(0);
    expect(byPath.stdout).toBe(text);
  });

  it("exit 0: one package per role of a ticket, the ticket showing the last one built", () => {
    const change = started();
    const ticket = opened(change, "task-redispatch", "01-1");
    built(change, "01-1", "implementer", ticket);
    built(change, "01-1", "simplifier", ticket);
    built(change, "01-1", "runner", ticket);
    const runner = built(change, "01-1", "runner", ticket);
    expect(packages(change).sort()).toStrictEqual([
      `01-1-implementer-${ticket}.md`,
      `01-1-runner-${ticket}.md`,
      `01-1-simplifier-${ticket}.md`,
    ]);
    const shown = answered(
      bdk(["dispatch", "show", ticket, "--json"], change.root),
      "output/dispatch-show.json",
    );
    expect(shown).toMatchObject({ path: runner.path, frontmatter: { role: "runner" } });
  });

  it("exit 0: a package over 100 lines prints whole in text mode", () => {
    const change = started();
    const ticket = opened(change, "verify-fix", "01");
    const text = read(change.root, built(change, "01", "verifier", ticket).path);
    expect(text.split("\n").length).toBeGreaterThan(100);
    const shown = bdk(["dispatch", "show", ticket], change.root);
    expect(shown.code).toBe(0);
    expect(shown.stdout).toBe(text);
  });

  it("exit 3 input/not-found: a ticket without a package, a path outside dispatch/", () => {
    const change = started();
    refused(bdk(["dispatch", "show", "A-00000000", "--json"], change.root), 3, "input/not-found");
    refused(
      bdk(["dispatch", "show", `.bdk/changes/${change.id}/change.md`, "--json"], change.root),
      3,
      "input/not-found",
    );
  });

  it("exit 2 policy/no-active-change", () => {
    refused(
      bdk(["dispatch", "show", "A-00000000", "--json"], repository()),
      2,
      "policy/no-active-change",
    );
  });

  it("exit 5 runtime/not-a-repo", () => {
    refused(
      bdk(["dispatch", "show", "A-00000000", "--json"], outsideRepository()),
      5,
      "runtime/not-a-repo",
    );
  });
});

describe("review groups of one round (T42-A1)", () => {
  it("builds a package per group, shows each by its reference and reads its rules", () => {
    const change = executed(started());
    const round = opened(change, "review-fix", change.id);
    const group = (name: string, file: string) =>
      answered(
        bdk(
          [
            "dispatch",
            "build",
            change.id,
            "reviewer",
            round,
            "--group",
            name,
            "--range",
            "HEAD~3..HEAD",
            "--file",
            file,
            "--json",
          ],
          change.root,
        ),
        "output/dispatch-build.json",
      ) as unknown as Built & { readonly group: string; readonly report: string };
    const first = group("p01", "src/01-1.ts");
    const second = group("p02", "src/02-1.ts");
    expect(first.group).toBe("p01");
    expect(second.report).toBe(
      `.bdk/changes/${change.id}/reports/${change.id}-reviewer-${round}-p02.md`,
    );
    expect(
      packages(change)
        .filter((name) => name.includes(round))
        .sort(),
    ).toStrictEqual([
      `${change.id}-reviewer-${round}-p01.md`,
      `${change.id}-reviewer-${round}-p02.md`,
    ]);
    const shown = answered(
      bdk(["dispatch", "show", `${round}@p02`, "--json"], change.root),
      "output/dispatch-show.json",
    );
    expect(shown.path).toBe(second.path);
    const rules = answered(
      bdk(["rules", "show", "--ticket", `${round}@p01`, "--json"], change.root),
      "output/rules-show.json",
    );
    expect(rules).toMatchObject({ ticket: round, group: "p01", role: "reviewer" });
    refused(
      bdk(["dispatch", "show", `${round}@P_01`, "--json"], change.root),
      3,
      "input/invalid-argument",
    );
    refused(
      bdk(
        [
          "dispatch",
          "build",
          change.id,
          "reviewer",
          round,
          "--group",
          "merge",
          "--range",
          "HEAD~3..HEAD",
          "--json",
        ],
        change.root,
      ),
      3,
      "input/invalid-argument",
    );
  });
});
