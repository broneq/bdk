import { describe, expect, it } from "vitest";

import { docsImpact } from "./rule.ts";

// Pull requests that change behaviour without docs say why (spec `repo-sdlc`).

const SKILL = "plugins/bdk/skills/plan/SKILL.md";

describe("docsImpact", () => {
  it("fails a skill change without a docs page or a reason, naming the paths and the line", () => {
    const result = docsImpact([SKILL, "plugins/bdk/src/run/index.ts", "README.md"], "Resolves #1");
    expect(result.ok).toBe(false);
    expect(result.message).toContain(SKILL);
    expect(result.message).toContain("plugins/bdk/src/run/index.ts");
    expect(result.message).not.toContain("README.md");
    expect(result.message).toContain("Docs-impact: none - <reason>");
  });

  it("passes with a Docs-impact line that gives a reason", () => {
    expect(
      docsImpact(
        [SKILL],
        "Body\r\n\r\nDocs-impact: none - internal refactor, no user-visible change\r\n",
      ),
    ).toMatchObject({ ok: true });
  });

  it("fails a Docs-impact line without a reason", () => {
    expect(docsImpact([SKILL], "Docs-impact: none - ").ok).toBe(false);
    expect(docsImpact([SKILL], "Docs-impact: none").ok).toBe(false);
    expect(docsImpact([SKILL], "`Docs-impact: none - quoted`").ok).toBe(false);
    // The placeholder of the pull request template is not a reason.
    expect(docsImpact([SKILL], "Docs-impact: none - <reason>").ok).toBe(false);
  });

  it("passes when a Guide or Concepts page changes with the source", () => {
    expect(docsImpact([SKILL, "docs/concepts/orchestrators.md"], "").ok).toBe(true);
    expect(docsImpact(["openspec/specs/bdk-run/spec.md", "docs/guide/workflow.md"], "").ok).toBe(
      true,
    );
  });

  it("does not count a generated Reference page as a docs change", () => {
    expect(docsImpact([SKILL, "docs/reference/bdk/skills.md"], "").ok).toBe(false);
  });

  it("watches skills, agents, hooks, plugin sources and main specs, nothing else", () => {
    for (const path of [
      "plugins/bdk/agents/lead.md",
      "plugins/git-identity/hooks/hooks.json",
      "plugins/bdk-skill-kit/src/cli.ts",
      "openspec/specs/docs-site/spec.md",
    ]) {
      expect(docsImpact([path], "").ok, path).toBe(false);
    }
    for (const path of [
      "plugins/bdk/tests/cli.test.ts",
      "plugins/bdk/evals/x/case.yaml",
      "openspec/changes/v3-1-x/proposal.md",
      "docs/adr/0004-x.md",
      ".github/workflows/pr.yml",
    ]) {
      expect(docsImpact([path], "").ok, path).toBe(true);
    }
  });
});
