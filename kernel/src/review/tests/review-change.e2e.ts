// A review Change through the committed bundle (T42, `kernel-cli/change`,
// bdk change new; `kernel-pipeline`, Graph variants): `change new --kind
// review` stamps the merge base with `origin/HEAD` or `--base`, the graph
// holds only the full gate, review, its gate and close, a `review-fix` ticket
// is admitted with no steps, and `review plan --full` anchors at the stamped
// base once `change.md` is committed.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

import { answered, bdk, git, refused, repository } from "../../../tests/support/repo.ts";

interface Review {
  readonly root: string;
  readonly base: string;
}

/**
 * A branch two commits ahead of `origin/HEAD`, which points at the initial
 * commit; its `.gitignore` already holds the paths `change new` would add.
 */
function branchUnderReview(): Review {
  const root = repository({ ".gitignore": "/.bdk/.machine/\n/.bdk/settings.local.yaml\n" });
  const base = git(root, "rev-parse", "HEAD").trim();
  git(root, "update-ref", "refs/remotes/origin/main", base);
  git(root, "symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main");
  for (const path of ["src/auth/login.ts", "web/forms/form.ts"]) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), `export const at = "${path}";\n`);
    git(root, "add", path);
    git(root, "commit", "--quiet", "-m", `add ${path}`);
  }
  return { root, base };
}

function opened(root: string, ...flags: string[]): { change: string; next?: string } {
  return answered(
    bdk(
      [
        "change",
        "new",
        "Review the login branch",
        "--inferred",
        "--kind",
        "review",
        ...flags,
        "--json",
      ],
      root,
    ),
    "output/change-new.json",
  ) as { change: string; next?: string };
}

function changeDoc(root: string, id: string): string {
  return readFileSync(join(root, ".bdk/changes", id, "change.md"), "utf8");
}

describe("a review Change", () => {
  it("stamps the merge base with origin/HEAD and names /bdk:cr", () => {
    const { root, base } = branchUnderReview();
    const report = opened(root);

    expect(report).toMatchObject({ kind: "review", source: "inferred", next: "/bdk:cr" });
    expect(changeDoc(root, report.change)).toContain(`base: ${base}`);
    expect(answered(bdk(["next", "--json"], root), "output/next.json")).toMatchObject({
      command: "/bdk:cr",
    });
  });

  it("--base main stamps the merge base with main", () => {
    const { root } = branchUnderReview();
    git(root, "branch", "main", "HEAD~1");
    const report = opened(root, "--base", "main");

    expect(changeDoc(root, report.change)).toContain(
      `base: ${git(root, "rev-parse", "HEAD~1").trim()}`,
    );
  });

  it("refuses an unknown ref and an empty range, writing nothing", () => {
    const { root } = branchUnderReview();
    const args = ["change", "new", "x", "--kind", "review", "--json"];

    expect(
      refused(bdk([...args, "--base", "no-such-branch"], root), 3, "input/not-found").why,
    ).toContain("no-such-branch");
    expect(refused(bdk([...args, "--base", "HEAD"], root), 2, "policy/empty-range").why).toContain(
      "HEAD",
    );
    expect(git(root, "status", "--porcelain", "--untracked-files=all")).toBe("");
  });

  it("admits a review-fix ticket with no steps, and review plan anchors full at the base", () => {
    const { root, base } = branchUnderReview();
    const report = opened(root);
    git(root, "add", "--all");
    git(root, "commit", "--quiet", "-m", "open the review Change");

    answered(
      bdk(["attempt", "open", "review-fix", report.change, "--json"], root),
      "output/attempt-open.json",
    );
    const plan = answered(
      bdk(["review", "plan", "--full", "--json"], root),
      "output/review-plan.json",
    );
    expect(plan).toMatchObject({ anchor: { kind: "full", sha: base } });
    expect(
      (plan.groups as { id: string; kind: string; files: string[] }[]).map((group) => [
        group.id,
        group.kind,
        group.files,
      ]),
    ).toStrictEqual([
      ["m1", "module", ["src/auth/login.ts", "web/forms/form.ts"]],
      ["integration", "integration", ["src/auth/login.ts", "web/forms/form.ts"]],
    ]);
  });
});
