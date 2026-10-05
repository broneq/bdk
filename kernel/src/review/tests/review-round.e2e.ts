// The command sequence `/bdk:cr` names, on a `review` Change through the
// committed bundle (T42, `review-skills`): `change new --inferred --kind
// review`, a round whose triaged blocker fails it, a next round that fixes
// the blocker first through an implementer package, commits it with `bdk
// commit <change-id>` and resolves it, reviews only the delta, and passes
// `done review`. Then the report step: an earlier entry is triaged, the
// report rendered, a `fix` decision runs a round that starts with the full
// budget (the `ok` before it ended its round), the rest is deferred, and the
// Change closes.
import { appendFileSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

import { answered, bdk, git, read, refused, repository } from "../../../tests/support/repo.ts";
import { passGate } from "../../graph/tests/e2e-support.ts";

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

/** The attempt record of a ticket, relative to the project root. */
function attemptFile(review: Review, ticket: string): string {
  const dir = `.bdk/changes/${review.id}/attempts`;
  const name = readdirSync(join(review.root, dir)).find((file) => file.includes(ticket));
  if (name === undefined) throw new Error(`no attempt record of ${ticket}`);
  return `${dir}/${name}`;
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

/** The live findings the kernel wrote, which no reviewer triaged. */
function kernelFindings(review: Review): string[] {
  const listed = answered(run(review, ["log", "list"]), "output/log-list.json") as {
    items: { id: string; type: string; status: string; level?: string }[];
  };
  return listed.items
    .filter((entry) => entry.type === "finding" && entry.status !== "resolved")
    .filter((entry) => entry.level === undefined)
    .map((entry) => entry.id);
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

// Two review rounds spawn dozens of kernel and git processes: 13 s alone,
// over the 30 s project default when the whole E2E suite loads the machine.
describe("a cr round on a review Change", { timeout: 120_000 }, () => {
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
    expect(
      answered(run(review, ["attempt", "close", second, "ok"]), "output/attempt-close.json"),
    ).toMatchObject({ next: { action: "review-done" } });
    expect(answered(run(review, ["done", "review"]), "output/done.json")).toMatchObject({
      artifact: "review",
      state: "done",
    });

    // The report step after `done review` (R5): an entry of an earlier stage
    // the rounds did not write is triaged, so nothing is left untriaged.
    const earlier = (
      answered(
        run(review, [
          "log",
          "add",
          "observation",
          "dates built by hand",
          "--ref",
          "web/forms/form.ts",
        ]),
        "output/log-add.json",
      ).entry as { id: string }
    ).id;
    answered(run(review, ["log", "triage", earlier, "should-fix"]), "output/log-triage.json");
    // The kernel's own findings of the rounds (a narrowed scope, a package
    // closed without its rules) carry no level either.
    const untriaged = kernelFindings(review);
    expect(untriaged).toHaveLength(2);
    for (const id of untriaged) {
      answered(run(review, ["log", "triage", id, "nice-to-have"]), "output/log-triage.json");
    }
    const rendered = answered(run(review, ["review", "render"]), "output/review-render.json");
    expect(rendered).toMatchObject({ decided: [] });
    expect([...(rendered.undecided as string[])].sort()).toStrictEqual(
      [earlier, minor, ...untriaged].sort(),
    );
    const page = read(review.root, rendered.path as string);
    expect(page).toContain(`id="entry-${earlier}"`);
    expect(page).toContain("<h3>should-fix");
    expect(page).toContain("<h3>untriaged (0)</h3>");

    // The user decides `fix`: an `ok` record ended round 2 (kernel-loops), so
    // the fixing round starts with the full budget and fixes the entry first.
    answered(run(review, ["log", "decide", earlier, "fix"]), "output/log-decide.json");
    const third = answered(
      run(review, ["attempt", "open", "review-fix", review.id]),
      "output/attempt-open.json",
    );
    expect(third).toMatchObject({ attempt: 1, scope: "full" });
    const fixing = third.ticket as string;
    expect(read(review.root, attemptFile(review, fixing))).toContain(`after: ${second}`);
    expect(
      answered(run(review, ["attempt", "list", "--for", review.id]), "output/attempt-list.json"),
    ).toMatchObject({ budgets: { "review-fix": { used: 0, of: 2 } } });
    const embedded = answered(
      run(review, ["dispatch", "build", review.id, "implementer", fixing]),
      "output/dispatch-build.json",
    );
    expect(bdk(["dispatch", "show", embedded.path as string], review.root).stdout).toContain(
      earlier,
    );
    put(review.root, "web/forms/form.ts", 'export const at = "dates by Intl";\n');
    answered(run(review, ["commit", review.id]), "output/commit.json");
    answered(
      run(review, ["log", "resolve", earlier, "resolved", "--reason", "dates by Intl"]),
      "output/log-resolve.json",
    );
    const last = answered(
      run(review, ["review", "plan"]),
      "output/review-plan.json",
    ) as unknown as Plan;
    packages(review, fixing, last);
    for (const group of last.groups) ingest(review, `${fixing}@${group.id}`, []);
    gate(review, fixing);
    merged(review, fixing, [], "no entries");
    answered(run(review, ["attempt", "close", fixing, "ok"]), "output/attempt-close.json");
    answered(run(review, ["done", "review"]), "output/done.json");

    // The report again: the fixed entry left Decisions; the rest is deferred.
    // Closing the ticket can write a kernel finding; the report triages it first.
    const fixRound = kernelFindings(review);
    for (const id of fixRound) {
      answered(run(review, ["log", "triage", id, "nice-to-have"]), "output/log-triage.json");
    }
    const again = answered(run(review, ["review", "render"]), "output/review-render.json");
    const rest = [minor, ...untriaged, ...fixRound].sort();
    expect([...(again.undecided as string[])].sort()).toStrictEqual(rest);
    expect(read(review.root, again.path as string)).not.toContain(`id="entry-${earlier}"`);
    for (const id of rest) {
      answered(run(review, ["log", "decide", id, "defer"]), "output/log-decide.json");
    }
    const final = answered(run(review, ["review", "render"]), "output/review-render.json");
    expect(final.undecided).toStrictEqual([]);
    expect([...(final.decided as string[])].sort()).toStrictEqual(rest);
    passGate(join(review.root, ".bdk/changes", review.id), "gate:review", "close");
    expect(answered(run(review, ["change", "close"]), "output/change-close.json")).toMatchObject({
      change: review.id,
    });
  });
});
