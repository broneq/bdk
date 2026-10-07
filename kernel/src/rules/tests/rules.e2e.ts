// `bdk rules show` through the built bundle (`kernel-cli/rules`; T23-D27,
// D28, T31): a real repository, a ticket opened by `attempt open` and built
// by `dispatch build`, and the project's rule files.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { answered, bdk, git, read, refused, repository } from "../../../tests/support/repo.ts";
import { dispatched, opened, started } from "../../attempt/tests/e2e-support.ts";
import { fileStore, FORMATTER_GUARD } from "../../shared/store/index.ts";
import { ruleFile } from "../../../tests/support/rule-file.ts";

interface Shown {
  readonly role: string;
  readonly target: string;
  readonly rules: readonly { id: string; matchedBy: string | null; text: string }[];
  readonly rulesRead: string;
}

const HAND_WRITTEN = "- Name booleans as questions.\n";

function attemptText(dir: string, ticket: string): string {
  const name = fileStore()
    .list(join(dir, "attempts"))
    .find((file) => file.includes(ticket));
  if (name === undefined) throw new Error(`no attempt record for ${ticket}`);
  return readFileSync(join(dir, "attempts", name), "utf8");
}

describe("bdk rules show --ticket", () => {
  it("exit 0: the rules the package stamped, in its order, stamped read once", () => {
    const change = started("languages: [typescript]\n");
    fileStore().write(join(change.root, ".bdk/rules/NAMING-1.md"), ruleFile("NAMING-1"));
    fileStore().write(
      join(change.root, ".bdk/rules/UI-1.md"),
      ruleFile("UI-1", { paths: ["web/**"] }),
    );
    const ticket = opened(change, "part", "01");
    dispatched(change, ticket, "01");

    const first = answered(
      bdk(["rules", "show", "--ticket", ticket, "--json"], change.root),
      "output/rules-show.json",
    ) as unknown as Shown;
    expect(first.role).toBe("implementer");
    expect(first.target).toBe("01");
    const ids = first.rules.map((rule) => rule.id);
    expect(ids).toContain("NAMING-1");
    expect(ids).not.toContain("UI-1");
    expect(first.rules.find((rule) => rule.id === "NAMING-1")).toMatchObject({
      matchedBy: "**",
      text: "Text of NAMING-1.",
    });
    expect(attemptText(change.dir, ticket)).toContain(`rules-read: ${first.rulesRead}`);

    const second = bdk(["rules", "show", "--ticket", ticket], change.root);
    expect(second.code).toBe(0);
    expect(second.stdout).toContain(`## BDK rules: ${ticket} (implementer, 01)`);
    expect(second.stdout).toContain("- [NAMING-1] Text of NAMING-1.");
    expect(attemptText(change.dir, ticket)).toContain(`rules-read: ${first.rulesRead}`);
  });

  it("exit 3 input/not-found: a ticket the Change does not hold", () => {
    const change = started();
    refused(
      bdk(["rules", "show", "--ticket", "A-00000000", "--json"], change.root),
      3,
      "input/not-found",
    );
  });

  it("exit 2 policy/no-open-ticket: an open ticket without a package", () => {
    const change = started();
    const ticket = opened(change, "part", "01");
    refused(
      bdk(["rules", "show", "--ticket", ticket, "--json"], change.root),
      2,
      "policy/no-open-ticket",
    );
    expect(attemptText(change.dir, ticket)).not.toContain("rules-read");
  });

  it("exit 0: the id form prints one rule, a tombstone included", () => {
    const change = started();
    fileStore().write(
      join(change.root, ".bdk/rules/API-2.md"),
      ruleFile("API-2", { extra: "removed: superseded by API-5\n" }),
    );
    const shown = answered(
      bdk(["rules", "show", "API-2", "--json"], change.root),
      "output/rules-show.json",
    );
    expect(shown).toMatchObject({ id: "API-2", removed: "superseded by API-5", disabled: false });
    refused(bdk(["rules", "show", "API-9", "--json"], change.root), 3, "input/not-found");
  });
});

const API = { "src/api/login.ts": "export {};\n" };

describe("bdk rules check", () => {
  it("exit 0: the project's rules, counted", () => {
    const root = repository({
      ".bdk/rules/API-1.md": ruleFile("API-1", { paths: ["src/api/**"] }),
      ".bdk/rules/API-2.md": ruleFile("API-2", { extra: "removed: superseded by API-3\n" }),
    });
    const report = answered(
      bdk(["rules", "check", ".bdk/rules", "--json"], root),
      "output/rules-check.json",
    );
    expect(report).toStrictEqual({ valid: true, rules: 2, bundle: 0, project: 2, tombstones: 1 });
  });

  it("exit 3 input/not-found: a path that does not exist", () => {
    refused(bdk(["rules", "check", "nowhere", "--json"], repository()), 3, "input/not-found");
  });

  it("exit 2 policy/rule-format: a project rule with the bundle prefix, a knowledge rule without verified", () => {
    const bundled = repository({ ".bdk/rules/BDK-CQ-9.md": ruleFile("BDK-CQ-9") });
    const why = refused(
      bdk(["rules", "check", ".bdk/rules", "--json"], bundled),
      2,
      "policy/rule-format",
    ).why;
    expect(why).toContain(".bdk/rules/BDK-CQ-9.md");
    const knowledge = repository({
      ".bdk/rules/FACT-1.md": ruleFile("FACT-1", { extra: "source: RFC 9110\n" }).replace(
        "kind: house",
        "kind: knowledge",
      ),
    });
    refused(bdk(["rules", "check", ".bdk/rules", "--json"], knowledge), 2, "policy/rule-format");
  });

  it("exit 2 policy/duplicate-rule-id: a third file declaring an existing id names both files", () => {
    const root = repository({
      ".bdk/rules/API-3.md": ruleFile("API-3"),
      ".bdk/rules/API-4.md": ruleFile("API-3"),
    });
    const why = refused(
      bdk(["rules", "check", ".bdk/rules", "--json"], root),
      2,
      "policy/duplicate-rule-id",
    ).why;
    expect(why).toContain(".bdk/rules/API-3.md and .bdk/rules/API-4.md");
  });
});

describe("bdk rules explain", () => {
  it("exit 0: the reviewer's rules for a file, the matching glob, disabled ones apart", () => {
    const root = repository({
      ...API,
      ".bdk/rules/API-1.md": ruleFile("API-1", { paths: ["src/api/**"] }),
      ".bdk/rules/UI-1.md": ruleFile("UI-1", { paths: ["web/**"] }),
      ".bdk/rules/NAMING-1.md": ruleFile("NAMING-1"),
      ".bdk/settings.yaml": "rules:\n  disabled: [NAMING-1]\n",
    });
    const report = answered(
      bdk(["rules", "explain", "src/api/login.ts", "--role", "reviewer", "--json"], root),
      "output/rules-explain.json",
    );
    expect(report).toMatchObject({
      file: "src/api/login.ts",
      role: "reviewer",
      disabled: ["NAMING-1"],
    });
    const rules = report.rules as { id: string; matchedBy: string | null }[];
    expect(rules.find((rule) => rule.id === "API-1")).toMatchObject({ matchedBy: "src/api/**" });
    expect(rules.map((rule) => rule.id)).not.toContain("UI-1");
  });

  it("exit 0: a language pack needs both the switch and a matching file", () => {
    const react = (languages: string): string[] => {
      const root = repository({
        "web/App.tsx": "export {};\n",
        ".bdk/settings.yaml": `languages: [${languages}]\n`,
      });
      const report = answered(
        bdk(["rules", "explain", "web/App.tsx", "--role", "reviewer", "--json"], root),
        "output/rules-explain.json",
      );
      return (report.rules as { id: string }[])
        .map((rule) => rule.id)
        .filter((id) => id.startsWith("BDK-REACT-"));
    };
    expect(react("typescript")).toStrictEqual([]);
    expect(react("typescript, react").length).toBeGreaterThan(0);
  });

  it("exit 3 input/not-found: a file outside the repository", () => {
    refused(
      bdk(["rules", "explain", "../elsewhere.ts", "--json"], repository()),
      3,
      "input/not-found",
    );
  });
});

describe("bdk rules prune", () => {
  it("exit 0: a glob matching nothing; uncited only once the project has --uncited Changes", () => {
    const change = started();
    fileStore().write(join(change.root, ".bdk/rules/API-1.md"), ruleFile("API-1"));
    fileStore().write(
      join(change.root, ".bdk/rules/API-3.md"),
      ruleFile("API-3", { paths: ["legacy/**"] }),
    );
    const silent = answered(
      bdk(["rules", "prune", "--json"], change.root),
      "output/rules-prune.json",
    );
    // Bundle rules are reported too: BDK-CQ-9 matches no lockfile in this project.
    const project = (silent.items as { id: string }[]).filter((item) => item.id.startsWith("API-"));
    expect(project).toStrictEqual([
      { id: "API-3", reason: "no-match", detail: 'paths: ["legacy/**"] matches 0 files' },
    ]);
    expect(silent.items).toContainEqual(
      expect.objectContaining({ id: "BDK-CQ-9", reason: "no-match" }),
    );
    const cite = bdk(["log", "add", "decision", "cite", "--ref", "API-1", "--json"], change.root);
    expect(cite.code, cite.stdout).toBe(0);
    const counted = answered(
      bdk(["rules", "prune", "--uncited", "1", "--json"], change.root),
      "output/rules-prune.json",
    );
    const uncited = (counted.items as { id: string; reason: string }[]).filter(
      (item) => item.reason === "uncited",
    );
    expect(uncited.map((item) => item.id)).toContain("API-3");
    expect(uncited.map((item) => item.id)).not.toContain("API-1");
  });
});

describe("removed rule commands", () => {
  it("exit 2 policy/rule-format: rules check refuses origin import", () => {
    const root = repository({
      ".bdk/rules/API-1.md": ruleFile("API-1").replace("origin: user", "origin: import"),
    });
    const result = refused(bdk(["rules", "check", "--json"], root), 2, "policy/rule-format");
    expect(result.why).toContain("origin");
  });

  it("exit 3 input/unknown-command: rules import and rules export are gone", () => {
    const root = repository({ ".claude/rules/naming.md": "- Name booleans as questions.\n" });
    refused(bdk(["rules", "import", "--json"], root), 3, "input/unknown-command");
    refused(bdk(["rules", "export", "--claude", "--json"], root), 3, "input/unknown-command");
    expect(existsSync(join(root, ".bdk/rules"))).toBe(false);
    expect(read(root, ".claude/rules/naming.md")).toBe("- Name booleans as questions.\n");
  });
});

describe("bdk rules stats", () => {
  it("exit 0: citations by id, the raw entries with --entries", () => {
    const change = started();
    fileStore().write(join(change.root, ".bdk/rules/API-1.md"), ruleFile("API-1"));
    const cited = bdk(
      [
        "log",
        "add",
        "finding",
        "unchecked input",
        "--ref",
        "API-1",
        "--ref",
        "src/api/a.ts",
        "--json",
      ],
      change.root,
    );
    expect(cited.code, cited.stdout).toBe(0);
    const report = answered(
      bdk(["rules", "stats", "--entries", "--json"], change.root),
      "output/rules-stats.json",
    );
    expect(report.minChanges).toBe(3);
    expect(report.recurring).toStrictEqual([]);
    expect(report.citations).toContainEqual({ id: "API-1", entries: 1, changes: 1 });
    const entries = report.entries as { items: { id: string; summary: string }[] };
    expect(entries.items).toMatchObject([{ summary: "unchecked input", adopted: false }]);
    expect(entries.items[0]?.id).toMatch(new RegExp(`^${change.id}/L-`));
  });
});

describe("bdk rules accept", () => {
  it("writes the formatter guard when absent", () => {
    const root = repository();
    answered(
      bdk(
        [
          "rules",
          "accept",
          "Use the shared serializer.",
          "--prefix",
          "API",
          "--path",
          "**",
          "--stage",
          "plan",
          "--json",
        ],
        root,
      ),
      "output/rules-accept.json",
    );
    expect(read(root, ".bdk/.prettierrc")).toBe(FORMATTER_GUARD);
  });

  it("exit 0 without an active Change: the next number above the tombstones, origin from --from, .claude/rules/ untouched", () => {
    const change = started();
    const entry = bdk(
      ["log", "add", "learning", "handlers go through commands", "--ref", "src/api/a.ts", "--json"],
      change.root,
    );
    const from = `${change.id}/${(entry.json as { entry: { id: string } }).entry.id}`;
    fileStore().write(join(change.root, ".bdk/rules/API-1.md"), ruleFile("API-1"));
    fileStore().write(
      join(change.root, ".bdk/rules/API-2.md"),
      ruleFile("API-2", { extra: "removed: merged\n" }),
    );
    fileStore().write(join(change.root, ".bdk/rules/API-3.md"), ruleFile("API-3"));
    git(change.root, "checkout", "--quiet", "-b", "audit");
    fileStore().write(join(change.root, ".claude/rules/naming.md"), HAND_WRITTEN);
    const report = answered(
      bdk(
        [
          "rules",
          "accept",
          "Write paths go through command handlers.",
          "--prefix",
          "API",
          "--path",
          "src/api/**",
          "--stage",
          "execute",
          "--stage",
          "review",
          "--from",
          from,
          "--json",
        ],
        change.root,
      ),
      "output/rules-accept.json",
    );
    expect(report).toStrictEqual({
      id: "API-4",
      path: ".bdk/rules/API-4.md",
      origin: from,
    });
    const written = read(change.root, ".bdk/rules/API-4.md");
    expect(written).toContain(`origin: ${from}`);
    expect(written).toContain(`evidence:\n  - ${from}`);
    expect(fileStore().list(join(change.root, ".claude/rules"))).toStrictEqual(["naming.md"]);
    expect(read(change.root, ".claude/rules/naming.md")).toBe(HAND_WRITTEN);
    const stats = answered(
      bdk(["rules", "stats", "--entries", "--json"], change.root),
      "output/rules-stats.json",
    );
    expect((stats.entries as { items: { id: string; adopted: boolean }[] }).items).toContainEqual(
      expect.objectContaining({ id: from, adopted: true }),
    );
  });

  it("refuses an unknown --from (3), a knowledge rule without --verified and a BDK prefix (2), writing nothing", () => {
    const root = repository();
    refused(
      bdk(
        [
          "rules",
          "accept",
          "x",
          "--prefix",
          "API",
          "--path",
          "**",
          "--stage",
          "plan",
          "--from",
          "2026-09-25-gone/L-00000000",
          "--json",
        ],
        root,
      ),
      3,
      "input/not-found",
    );
    refused(
      bdk(
        [
          "rules",
          "accept",
          "x",
          "--prefix",
          "API",
          "--path",
          "**",
          "--stage",
          "plan",
          "--kind",
          "knowledge",
          "--source",
          "RFC",
          "--json",
        ],
        root,
      ),
      2,
      "policy/rule-format",
    );
    refused(
      bdk(
        ["rules", "accept", "x", "--prefix", "BDK", "--path", "**", "--stage", "plan", "--json"],
        root,
      ),
      2,
      "policy/rule-format",
    );
    expect(existsSync(join(root, ".bdk/rules"))).toBe(false);
    expect(existsSync(join(root, ".bdk/.prettierrc"))).toBe(false);
  });
});
