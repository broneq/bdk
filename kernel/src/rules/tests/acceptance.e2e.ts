// T31 acceptance through the built bundle (tasks 8.1, 8.2 of
// v3-t31-rules-ids-funnel): a scoped and a global project rule reach only the
// packages whose task files they apply to, and a lesson recorded in three
// Changes surfaces in the audit, is adopted with `rules accept` and applies
// to the files of its glob.
// That `change close` writes no rule is `close.test.ts`, "proposes no rule".
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { answered, bdk, git, read, repository } from "../../../tests/support/repo.ts";
import { fileStore } from "../../shared/store/index.ts";

function projectRule(id: string, extra = ""): string {
  return `---\nschema: 1\nid: ${id}\nkind: house\nseverity: medium\norigin: user\nsince: 2026-09-30\n${extra}---\n\nText of ${id}.\n`;
}

function task(id: string, file: string): string {
  return `## ${id} Task ${id}\n\n**Files:**\n\n- \`${file}\`\n\n**Test cases:**\n\n- works\n`;
}

/** A Change on the current branch whose part 01 holds a task on `src/api/x.ts` and one on `docs/a.md`. */
function changeWithTasks(root: string, title: string): string {
  const result = bdk(
    ["change", "new", title, "--profile", "tiny", "--reason", "acceptance", "--json"],
    root,
  );
  expect(result.code, result.stdout).toBe(0);
  const id = (result.json as { change: string }).change;
  fileStore().write(
    join(root, ".bdk/changes", id, "plan/parts/01-part.md"),
    `---\nschema: 1\nid: "01"\ntitle: Part 01\ngoal: g\nsuccess-measure: m\ndo-not-touch: []\ndepends-on: []\nspec-impact: none\n---\n${task("01-1", "src/api/x.ts")}\n${task("01-2", "docs/a.md")}`,
  );
  answered(bdk(["done", "plan", "--json"], root), "output/done.json");
  answered(bdk(["part", "start", "01", "--json"], root), "output/part-start.json");
  return id;
}

/** Every id the implementer package of `target` stamps, in package order. */
function stampedRules(root: string, target: string): string[] {
  const ticket = answered(
    bdk(["attempt", "open", "task-redispatch", target, "--json"], root),
    "output/attempt-open.json",
  ).ticket as string;
  answered(
    bdk(["dispatch", "build", target, "implementer", ticket, "--json"], root),
    "output/dispatch-build.json",
  );
  const shown = answered(
    bdk(["rules", "show", "--ticket", ticket, "--json"], root),
    "output/rules-show.json",
  ) as { rules: { id: string; text: string }[] };
  for (const rule of shown.rules) expect(rule.text.length, rule.id).toBeGreaterThan(0);
  return shown.rules.map((rule) => rule.id);
}

function stampedProjectRules(root: string, target: string): string[] {
  return stampedRules(root, target).filter((id) => !id.startsWith("BDK-"));
}

describe("T31 acceptance", () => {
  it("8.1: a scoped rule reaches only the task whose files it applies to, the global one both", () => {
    const root = repository({
      ".bdk/rules/API-1.md": projectRule("API-1", "applies: [src/api/**]\n"),
      ".bdk/rules/NAMING-1.md": projectRule("NAMING-1"),
    });
    changeWithTasks(root, "Scope the rules");
    expect(stampedProjectRules(root, "01-1")).toStrictEqual(["NAMING-1", "API-1"]);
    expect(stampedProjectRules(root, "01-2")).toStrictEqual(["NAMING-1"]);
  });

  it("rules explain lists the same ids, in the same order, as the package of a one-file task", () => {
    const root = repository({
      ".bdk/rules/API-1.md": projectRule("API-1", "applies: [src/api/**]\n"),
      ".bdk/rules/NAMING-1.md": projectRule("NAMING-1"),
      ".bdk/settings.yaml": "languages: [typescript]\n",
    });
    changeWithTasks(root, "Explain the selection");
    const explained = answered(
      bdk(["rules", "explain", "src/api/x.ts", "--role", "implementer", "--json"], root),
      "output/rules-explain.json",
    ) as { rules: { id: string }[] };
    expect(stampedRules(root, "01-1")).toStrictEqual(explained.rules.map((rule) => rule.id));
  });

  it("8.2: a lesson in three Changes recurs, is adopted, and applies to its files", () => {
    const root = repository();
    const learn = (summary: string) => {
      const result = bdk(
        ["log", "add", "learning", summary, "--ref", "src/api/x.ts", "--json"],
        root,
      );
      expect(result.code, result.stdout).toBe(0);
      return (result.json as { entry: { id: string } }).entry.id;
    };
    const changes: string[] = [];
    const entries: string[] = [];
    for (const [at, branch] of ["one", "two", "three"].entries()) {
      if (at > 0) git(root, "checkout", "--quiet", "-b", branch);
      const id = changeWithTasks(root, `Lesson ${branch}`);
      changes.push(id);
      entries.push(`${id}/${learn("forms lost the pending state on retry")}`);
      if (at < 2) learn("the negative test was forgotten");
    }

    const stats = answered(bdk(["rules", "stats", "--json"], root), "output/rules-stats.json");
    const recurring = stats.recurring as {
      summary: string;
      changes: number;
      changeIds: string[];
    }[];
    expect(recurring).toHaveLength(1);
    expect(recurring[0]).toMatchObject({ changes: 3, changeIds: [...changes].sort() });
    expect(recurring[0]?.summary).toBe("forms lost the pending state on retry");

    const accepted = answered(
      bdk(
        [
          "rules",
          "accept",
          "Keep the pending state in the form's own store.",
          "--prefix",
          "FORM",
          "--applies",
          "web/forms/**",
          "--from",
          entries[0] ?? "",
          "--json",
        ],
        root,
      ),
      "output/rules-accept.json",
    );
    expect(accepted).toMatchObject({ id: "FORM-1", origin: entries[0] });
    expect(read(root, ".bdk/rules/FORM-1.md")).toContain(`origin: ${entries[0] ?? ""}`);
    const explained = answered(
      bdk(["rules", "explain", "web/forms/Signup.tsx", "--json"], root),
      "output/rules-explain.json",
    ) as { rules: { id: string; matchedBy: string | null }[] };
    expect(explained.rules).toContainEqual(
      expect.objectContaining({ id: "FORM-1", matchedBy: "web/forms/**" }),
    );
  });
});
