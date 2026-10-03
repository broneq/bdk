// The command sequence `/bdk:cr` names, on a `review` Change through the
// committed bundle (T42, `review-skills`): `change new --inferred --kind
// review`, a round whose triaged blocker fails it, a next round that fixes
// the blocker first through an implementer package, commits it with `bdk
// commit <change-id>` and resolves it, reviews only the delta, and passes
// `done review`.
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

import { answered, bdk, git, refused, repository } from "../../../tests/support/repo.ts";

const SETTINGS =
  "tools:\n  test:\n    - id: unit\n      tier: fast\n      command: vitest run\n" +
  "  lint:\n    - id: lint\n      tier: lint\n      command: eslint .\n";

interface Plan {
  anchor: { kind: string };
  range: string;
  groups: { id: string; kind: string; files: string[] }[];
}

interface Review {
  readonly root: string;
  readonly id: string;
}

function run(review: Review, argv: string[], stdin?: string) {
  return bdk([...argv, "--json"], review.root, stdin === undefined ? {} : { stdin });
}

function put(root: string, path: string, content: string): void {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
}

/** A branch two commits over `origin/HEAD`, with a review Change opened and committed. */
function reviewChange(): Review {
  const root = repository({
    ".gitignore": "/.bdk/.machine/\n/.bdk/settings.local.yaml\n",
    ".bdk/settings.yaml": SETTINGS,
  });
  const base = git(root, "rev-parse", "HEAD").trim();
  git(root, "update-ref", "refs/remotes/origin/main", base);
  git(root, "symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main");
  for (const path of ["src/auth/login.ts", "web/forms/form.ts"]) {
    put(root, path, `export const at = "${path}";\n`);
    git(root, "add", path);
    git(root, "commit", "--quiet", "-m", `add ${path}`);
  }
  const opened = answered(
    bdk(
      ["change", "new", "Add login and its form", "--inferred", "--kind", "review", "--json"],
      root,
    ),
    "output/change-new.json",
  );
  git(root, "add", "--all");
  git(root, "commit", "--quiet", "-m", "open the review Change");
  appendFileSync(join(root, ".git/info/exclude"), "coverage/\n");
  return { root, id: opened.change as string };
}

const report = (entries: string[]) =>
  `---\nstatus: done\nfiles: []\nentries: [${entries.join(", ")}]\nevidence: []\n---\n# Review\n`;

function ticketOf(review: Review, ...flags: string[]): string {
  return answered(
    run(review, ["attempt", "open", "review-fix", review.id, ...flags]),
    "output/attempt-open.json",
  ).ticket as string;
}

/** Every group's package as `cr` builds it, the user's focus on each reviewer. */
function packages(review: Review, ticket: string, plan: Plan): void {
  for (const group of plan.groups) {
    const role = group.kind === "integration" ? "integration-reviewer" : "reviewer";
    const files =
      group.kind === "integration" ? [] : group.files.flatMap((file) => ["--file", file]);
    answered(
      run(review, [
        "dispatch",
        "build",
        review.id,
        role,
        ticket,
        "--group",
        group.id,
        "--range",
        plan.range,
        "--focus",
        "input validation",
        ...files,
      ]),
      "output/dispatch-build.json",
    );
  }
  answered(
    run(review, ["dispatch", "build", review.id, "runner", ticket, "--group", "gate"]),
    "output/dispatch-build.json",
  );
}

/** The gate runner's records of the full gate under `<ticket>@gate`. */
function gate(review: Review, ticket: string): void {
  for (const kind of ["tests-full", "lint-full"]) {
    const file = `.bdk/.machine/${kind}-${ticket}.json`;
    put(review.root, file, '{"failed":0}\n');
    answered(
      run(review, [
        "evidence",
        "record",
        kind,
        file,
        "--ticket",
        `${ticket}@gate`,
        "--verdict",
        "pass",
        "--cite",
        "/failed",
      ]),
      "output/evidence-record.json",
    );
  }
}

function ingest(review: Review, reference: string, entries: string[]): void {
  answered(
    run(review, ["log", "ingest", "--ticket", reference], report(entries)),
    "output/log-ingest.json",
  );
}

/** The merged review under `<ticket>@merge` and its report entry. */
function merged(review: Review, ticket: string, entries: string[], counts: string): void {
  ingest(review, `${ticket}@merge`, entries);
  answered(
    run(review, ["log", "add", "report", counts, "--ticket", `${ticket}@merge`]),
    "output/log-add.json",
  );
}

describe("a cr round on a review Change", () => {
  it("fails on a blocker, fixes it first in the next round, reviews the delta and passes review", () => {
    const review = reviewChange();
    expect(answered(run(review, ["next"]), "output/next.json")).toMatchObject({
      command: "/bdk:cr",
    });

    // Round 1: plan, packages, findings and reports, the gate, triage, merge.
    const plan = answered(
      run(review, ["review", "plan"]),
      "output/review-plan.json",
    ) as unknown as Plan;
    expect(plan.anchor.kind).toBe("full");
    const first = ticketOf(review);
    packages(review, first, plan);

    const add = (summary: string, ref: string, group: string): string =>
      (
        answered(
          run(review, [
            "log",
            "add",
            "finding",
            summary,
            "--ref",
            ref,
            "--ticket",
            `${first}@${group}`,
          ]),
          "output/log-add.json",
        ).entry as { id: string }
      ).id;
    const blocker = add("login skips the password check", "src/auth/login.ts", "m1");
    const repeat = add("password check missing in login", "src/auth/login.ts", "integration");
    const minor = add("form label wording", "web/forms/form.ts", "m2");
    ingest(review, `${first}@m1`, [blocker]);
    ingest(review, `${first}@m2`, [minor]);
    ingest(review, `${first}@integration`, [repeat]);
    gate(review, first);

    const round = answered(
      run(review, ["log", "list", "--since-ticket-start", first]),
      "output/log-list.json",
    );
    expect(JSON.stringify(round)).toContain(blocker);
    answered(run(review, ["log", "triage", blocker, "blocker"]), "output/log-triage.json");
    answered(
      run(review, ["log", "triage", repeat, "not-a-problem", "--reason", `repeats ${blocker}`]),
      "output/log-triage.json",
    );
    answered(run(review, ["log", "triage", minor, "nice-to-have"]), "output/log-triage.json");
    merged(review, first, [blocker, repeat, minor], "1 blocker, 1 nice-to-have, 1 not-a-problem");
    expect(refused(run(review, ["done", "review"]), 2, "policy/validation-failed").why).toContain(
      blocker,
    );
    expect(
      answered(run(review, ["attempt", "close", first, "fail"]), "output/attempt-close.json"),
    ).toMatchObject({ next: { action: "narrow" } });

    // Round 2 fixes the blocker first: the implementer package embeds it.
    const second = ticketOf(review);
    const fixPackage = answered(
      run(review, ["dispatch", "build", review.id, "implementer", second]),
      "output/dispatch-build.json",
    );
    const shown = bdk(["dispatch", "show", fixPackage.path as string], review.root);
    expect(shown.stdout).toContain(blocker);
    expect(shown.stdout).not.toContain(minor);

    put(review.root, "src/auth/login.ts", 'export const at = "checked";\n');
    expect(answered(run(review, ["commit", review.id]), "output/commit.json")).toMatchObject({
      ticket: second,
      trailers: { "BDK-Ticket": second },
    });
    answered(
      run(review, ["log", "resolve", blocker, "resolved", "--reason", "password checked"]),
      "output/log-resolve.json",
    );

    const delta = answered(
      run(review, ["review", "plan"]),
      "output/review-plan.json",
    ) as unknown as Plan;
    expect(delta.anchor.kind).toBe("delta");
    expect(delta.groups.map((group) => [group.id, group.files])).toStrictEqual([
      ["m1", ["src/auth/login.ts"]],
      ["integration", ["src/auth/login.ts"]],
    ]);
    packages(review, second, delta);
    ingest(review, `${second}@m1`, []);
    ingest(review, `${second}@integration`, []);
    gate(review, second);
    merged(review, second, [], "no entries");
    answered(run(review, ["attempt", "close", second, "ok"]), "output/attempt-close.json");
    expect(answered(run(review, ["done", "review"]), "output/done.json")).toMatchObject({
      artifact: "review",
      state: "done",
    });
  });
});
