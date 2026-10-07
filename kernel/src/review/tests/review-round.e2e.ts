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

/** The reviewer packages and the gate's, as `cr` builds them first, the user's focus on each reviewer. */
function packages(review: Review, ticket: string, plan: Plan): void {
  for (const group of plan.groups.filter((group) => group.kind !== "integration")) {
    answered(
      run(review, [
        "dispatch",
        "build",
        review.id,
        "reviewer",
        ticket,
        "--group",
        group.id,
        "--range",
        plan.range,
        "--focus",
        "input validation",
        ...group.files.flatMap((file) => ["--file", file]),
      ]),
      "output/dispatch-build.json",
    );
  }
  answered(
    run(review, ["dispatch", "build", review.id, "runner", ticket, "--group", "gate"]),
    "output/dispatch-build.json",
  );
}

/**
 * A package `cr` builds after the agents before it have returned (#158): the
 * integration reviewer's after the reviewers', the judge's after the
 * integration reviewer's. Returns the package as `dispatch show` prints it.
 */
function laterPackage(
  review: Review,
  ticket: string,
  plan: Plan,
  role: "integration-reviewer" | "judge",
): string {
  const group = role === "judge" ? "judge" : "integration";
  const focus = role === "judge" ? [] : ["--focus", "input validation"];
  const built = answered(
    run(review, [
      "dispatch",
      "build",
      review.id,
      role,
      ticket,
      "--group",
      group,
      "--range",
      plan.range,
      ...focus,
    ]),
    "output/dispatch-build.json",
  );
  return bdk(["dispatch", "show", built.path as string], review.root).stdout;
}

/**
 * A round whose reviewers find nothing: every package in `cr`'s order, each
 * report stored. The judge triages what its package lists, such as a kernel
 * finding of an earlier round; returns those ids.
 */
function cleanRound(review: Review, ticket: string, plan: Plan): string[] {
  packages(review, ticket, plan);
  for (const group of plan.groups.filter((group) => group.kind !== "integration")) {
    ingest(review, `${ticket}@${group.id}`, []);
  }
  laterPackage(review, ticket, plan, "integration-reviewer");
  ingest(review, `${ticket}@integration`, []);
  const listed = laterPackage(review, ticket, plan, "judge");
  const judged = [...listed.matchAll(/^- `(L-[a-z0-9]+)` /gm)].map((match) => match[1] ?? "");
  for (const id of judged) {
    answered(
      run(review, ["log", "triage", id, "nice-to-have", "--reason", "no failure stated"]),
      "output/log-triage.json",
    );
  }
  ingest(review, `${ticket}@judge`, []);
  gate(review, ticket);
  return judged;
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
    const minor = add("form label wording", "web/forms/form.ts", "m1");
    ingest(review, `${first}@m1`, [blocker, minor]);

    // Built only once the reviewer of m1 stored its report, the integration
    // package names that report, not a group left unreviewed (#158).
    const integration = laterPackage(review, first, plan, "integration-reviewer");
    expect(integration).toContain(`reviewer-${first}-m1.md\``);
    expect(integration).not.toContain("(not reviewed");
    const repeat = add("password check missing in login", "src/auth/login.ts", "integration");
    ingest(review, `${first}@integration`, [repeat]);
    gate(review, first);

    // The judge's package lists every entry of the round, and it triages them.
    const judge = laterPackage(review, first, plan, "judge");
    for (const id of [blocker, minor, repeat]) expect(judge).toContain(`\`${id}\``);
    const triage = (id: string, level: string, reason: string) =>
      answered(
        run(review, ["log", "triage", id, level, "--reason", reason]),
        "output/log-triage.json",
      );
    triage(blocker, "blocker", "login accepts any password");
    triage(repeat, "not-a-problem", `repeats ${blocker}`);
    triage(minor, "nice-to-have", "wording only");
    ingest(review, `${first}@judge`, []);
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
    const judged = cleanRound(review, second, delta);
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
    // The judge of round 2 triaged the narrowed scope; the kernel finding
    // written after it (a package closed without its rules) has no level yet.
    expect(judged).toHaveLength(1);
    const untriaged = kernelFindings(review);
    expect(untriaged).toHaveLength(1);
    for (const id of untriaged) {
      answered(run(review, ["log", "triage", id, "nice-to-have"]), "output/log-triage.json");
    }
    const rendered = answered(run(review, ["review", "render"]), "output/review-render.json");
    expect(rendered).toMatchObject({ decided: [] });
    expect([...(rendered.undecided as string[])].sort()).toStrictEqual(
      [earlier, minor, ...judged, ...untriaged].sort(),
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
    const judgedLater = cleanRound(review, fixing, last);
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
    const rest = [minor, ...judged, ...untriaged, ...judgedLater, ...fixRound].sort();
    expect([...(again.undecided as string[])].sort()).toStrictEqual(rest);
    expect(read(review.root, again.path as string)).not.toContain(`data-entry="${earlier}"`);
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
