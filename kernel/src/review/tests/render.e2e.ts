// `bdk review render` through the built bundle (`kernel-cli/review`; T42-H, J):
// the report of an executed Change under `.bdk/.machine/review/`, byte for byte
// the same on a second run, the Markdown fallback, and the pull request page
// written only to `--out` without an active Change.
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { answered, bdk, git, refused, repository } from "../../../tests/support/repo.ts";
import { executed, started } from "../../attempt/tests/e2e-support.ts";

const PRS = {
  prs: [
    {
      number: 41,
      url: "https://github.com/acme/app/pull/41",
      title: "Magic link",
      findings: [
        {
          path: "src/a.ts",
          line: 3,
          severity: "high",
          category: "security",
          blocking: true,
          problem: "Token logged",
          why: "Leaks the token",
          fix: "Drop the log line",
        },
        {
          path: "src/b.ts",
          line: 9,
          severity: "low",
          category: "tests",
          blocking: false,
          problem: "Missing case",
          fix: "Add a test",
        },
      ],
    },
    {
      number: 42,
      url: "https://github.com/acme/app/pull/42",
      title: "Docs",
      findings: [],
    },
  ],
};

function render(root: string, ...flags: string[]) {
  return answered(bdk(["review", "render", ...flags, "--json"], root), "output/review-render.json");
}

describe("bdk review render", () => {
  // A whole executed Change spawns dozens of kernel and git processes: about 10 s
  // alone, over the 30 s project default when the whole E2E suite loads the machine.
  it("renders the report of an executed Change, the same bytes twice", () => {
    const change = executed(
      started('review:\n  risks:\n    - {id: core, instruction: "Core code", paths: ["src/**"]}\n'),
    );
    const finding = (
      answered(
        bdk(
          ["log", "add", "finding", "token compared with ==", "--ref", "src/01-1.ts", "--json"],
          change.root,
        ),
        "output/log-add.json",
      ).entry as { id: string }
    ).id;
    const head = git(change.root, "rev-parse", "HEAD").trim();

    const first = render(change.root);
    expect(first).toMatchObject({
      change: change.id,
      format: "html",
      path: `.bdk/.machine/review/${change.id}.html`,
      undecided: expect.arrayContaining([finding]) as unknown,
      decided: [],
      tracker: null,
    });
    expect(first.range).toMatch(new RegExp(`\\.\\.${head}$`));
    const page = readFileSync(join(change.root, first.path as string), "utf8");
    expect(page).toContain("<td");
    expect(page).toContain("<h3>core</h3>");
    expect(page).toContain("Task <code>01-1</code> Task 1");
    expect(page).toMatch(/<code>[0-9a-f]{7}<\/code> /);
    expect(page).toContain(`id="entry-${finding}"`);
    expect(page).not.toContain('value="track"');

    render(change.root);
    expect(readFileSync(join(change.root, first.path as string), "utf8")).toBe(page);
  }, 120_000);

  it("--format md writes the Markdown fallback without a form", () => {
    const change = executed(started());
    const result = render(change.root, "--format", "md");
    expect(result).toMatchObject({ format: "md", path: `.bdk/.machine/review/${change.id}.md` });
    const md = readFileSync(join(change.root, result.path as string), "utf8");
    expect(md).toContain("## Decisions");
    expect(md).not.toContain("<form");
  });

  it("--pr - with --out writes the decision page and nothing under .bdk/", () => {
    const root = repository();
    const out = join(mkdtempSync(join(tmpdir(), "bdk-pr-")), "pr.html");
    const result = answered(
      bdk(["review", "render", "--pr", "-", "--out", out, "--json"], root, {
        stdin: JSON.stringify(PRS),
      }),
      "output/review-render.json",
    );
    expect(result).toStrictEqual({
      change: null,
      format: "html",
      path: out,
      range: null,
      undecided: ["41-1", "41-2"],
      decided: [],
      tracker: null,
    });
    const page = readFileSync(out, "utf8");
    expect(page).toContain('name="d-41-1" value="blocker" checked');
    expect(page).toContain('name="d-41-2" value="nice-to-have" checked');
    expect(page).toContain("<dt>Why it matters</dt><dd>Leaks the token</dd>");
    expect(page).toContain('data-pr="41">request-changes</span>');
    expect(page).toContain('data-pr="42">approve</span>');
    expect(readdirSync(root)).not.toContain(".bdk");
  });

  it("exit 3 input/missing-argument: --pr without --out", () => {
    refused(
      bdk(["review", "render", "--pr", "-", "--json"], repository(), { stdin: "{}" }),
      3,
      "input/missing-argument",
    );
  });

  it("exit 3 input/invalid-argument: malformed --pr input names the field", () => {
    const result = refused(
      bdk(["review", "render", "--pr", "-", "--out", "x.html", "--json"], repository(), {
        stdin: JSON.stringify({ prs: [{ number: "x" }] }),
      }),
      3,
      "input/invalid-argument",
    );
    expect(result.why).toContain("prs[0].number");
  });

  it("exit 5 runtime/git-missing: git is not on PATH", () => {
    const change = started();
    refused(
      bdk(["review", "render", "--json"], change.root, { git: false }),
      5,
      "runtime/git-missing",
    );
  });
});
