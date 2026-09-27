// `kernel-cli/change` (T20 records) through the committed bundle in real
// repositories: one case per exit code and per declared rule of `change new`,
// `status`, `list`, `resume` and `park`, every output validated against its
// schema, and the T20 acceptance cases that concern Changes.
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  answered,
  bdk,
  BRANCH,
  git,
  outsideRepository,
  read,
  refused,
  repository,
} from "../../../tests/support/repo.ts";
import { fileStore, writeDocument } from "../../shared/store/index.ts";

const INTENT = "Users log in with a one-time link";

/** A repository with an open Change on BRANCH; answers the root and the Change id. */
function opened(...flags: string[]): { root: string; id: string } {
  const root = repository();
  const result = answered(
    bdk(["change", "new", INTENT, ...flags, "--json"], root),
    "output/change-new.json",
  ) as { change: string };
  return { root, id: result.change };
}

function logFiles(root: string, id: string): string[] {
  return readdirSync(join(root, ".bdk/changes", id, "log"));
}

function openAttempt(root: string, id: string): void {
  writeDocument(
    fileStore(),
    join(root, ".bdk/changes", id, "attempts/task-redispatch-02-3-A-open0001.md"),
    {
      data: {
        schema: 1,
        ticket: "A-open0001",
        loop: "task-redispatch",
        target: "02-3",
        attempt: 1,
        of: 3,
        scope: "full",
        "opened-at": "2026-09-25T10:00:00Z",
        author: "BDK Test <test@example.com>",
      },
      body: "",
    },
  );
}

describe("bdk change new", () => {
  it("exit 0: opens the Change, its assumption entry, the marker and .gitignore", () => {
    const root = repository();
    const result = answered(
      bdk(["change", "new", INTENT, "--json"], root),
      "output/change-new.json",
    );

    expect(result).toMatchObject({
      branch: BRANCH,
      kind: "feature",
      profile: { value: "small", defaulted: true },
      source: "user",
    });
    expect(result.next).toBe("/bdk:design");
    const id = String(result.change);
    expect(id).toMatch(/^\d{4}-\d{2}-\d{2}-users-log-in-with-a-one-time-link$/);
    expect(read(root, `.bdk/changes/${id}/change.md`)).toContain("profile: small");
    expect(logFiles(root, id)).toEqual([expect.stringMatching(/-assumption-L-[0-9a-z]{8}\.md$/)]);
    expect(read(root, ".bdk/.machine/branches/feat%2Flogin")).toContain(id);
  });

  it("acceptance: the fixture .gitignore holds exactly the two .bdk lines", () => {
    const { root } = opened();
    const lines = read(root, ".gitignore")
      .split("\n")
      .filter((line) => line.includes(".bdk"));
    expect(lines).toEqual(["/.bdk/.machine/", "/.bdk/settings.local.yaml"]);
    expect(git(root, "status", "--porcelain", "--ignored", ".bdk/.machine")).toContain("!!");
  });

  it("exit 2 policy/change-exists: the branch already has an active Change", () => {
    const { root, id } = opened();
    const why = refused(
      bdk(["change", "new", "Add dark mode", "--json"], root),
      2,
      "policy/change-exists",
    );
    expect(why.why).toContain(id);
  });

  it("exit 2 policy/change-exists: the Change directory exists", () => {
    const { root, id } = opened();
    git(root, "checkout", "--quiet", "-b", "feat/other");
    const why = refused(bdk(["change", "new", INTENT, "--json"], root), 2, "policy/change-exists");
    expect(why.why).toContain(`.bdk/changes/${id}/`);
  });

  it("exit 2 policy/detached-head: HEAD is detached", () => {
    const root = repository();
    git(root, "checkout", "--quiet", "--detach");
    refused(bdk(["change", "new", INTENT, "--json"], root), 2, "policy/detached-head");
    expect(readdirSync(root)).not.toContain(".bdk");
  });

  it("exit 3 input/missing-argument: --profile tiny without --reason, nothing written", () => {
    const root = repository();
    refused(
      bdk(["change", "new", "Fix typo", "--profile", "tiny", "--json"], root),
      3,
      "input/missing-argument",
    );
    expect(readdirSync(root)).not.toContain(".bdk");
  });

  it("exit 5 runtime/git-missing: git is not on PATH", () => {
    const root = repository();
    refused(
      bdk(["change", "new", INTENT, "--json"], root, { git: false }),
      5,
      "runtime/git-missing",
    );
  });

  it("exit 5 runtime/not-a-repo: outside a work tree", () => {
    refused(bdk(["change", "new", INTENT, "--json"], outsideRepository()), 5, "runtime/not-a-repo");
  });
});

describe("bdk change status", () => {
  it("exit 0: the derived state with the graph's nodes and gates", () => {
    const { root, id } = opened();
    const result = answered(bdk(["change", "status", "--json"], root), "output/change-status.json");
    expect(result).toMatchObject({
      change: id,
      profile: "small",
      stage: "intent",
      confirmed: true,
      parts: [],
      openTickets: [],
    });
    expect(result.nodes).toContainEqual({
      id: "design",
      kind: "design",
      state: "ready",
      requires: ["intent"],
    });
    expect(result.gates).toContainEqual(
      expect.objectContaining({
        gate: "gate:design",
        ready: false,
        done: false,
        command: "/bdk:plan",
      }),
    );
  });

  it("acceptance: at most 100 lines, an --inferred Change shown unconfirmed", () => {
    const { root } = opened("--inferred");
    const text = bdk(["change", "status"], root);
    expect(text.code).toBe(0);
    expect(text.stdout.trimEnd().split("\n").length).toBeLessThanOrEqual(100);
    expect(text.stdout).toContain("unconfirmed");
    expect(bdk(["change", "status", "--json"], root).json).toMatchObject({ confirmed: false });
  });

  it("exit 2 policy/no-active-change: no marker on the branch", () => {
    refused(bdk(["change", "status", "--json"], repository()), 2, "policy/no-active-change");
  });

  it("exit 3 input/unknown-flag", () => {
    const { root } = opened();
    refused(bdk(["change", "status", "--verbose", "--json"], root), 3, "input/unknown-flag");
  });

  it("exit 4 state/change-dir-missing: the marker names a removed Change", () => {
    const { root, id } = opened();
    rmSync(join(root, ".bdk/changes", id), { recursive: true });
    const why = refused(bdk(["change", "status", "--json"], root), 4, "state/change-dir-missing");
    expect(why.instead.join(" ")).toContain("bdk rebuild");
  });

  it("exit 4 state/corrupted-index: the index path is a directory", () => {
    const { root } = opened();
    const index = join(root, ".bdk/.machine/index.sqlite");
    rmSync(index, { force: true });
    mkdirSync(index);
    refused(bdk(["change", "status", "--json"], root), 4, "state/corrupted-index");
  });

  it("exit 5 runtime/not-a-repo: outside a work tree", () => {
    refused(bdk(["change", "status", "--json"], outsideRepository()), 5, "runtime/not-a-repo");
  });
});

describe("bdk change list", () => {
  it("exit 0: live Changes, archived ones with --all", () => {
    const { root, id } = opened();
    const archived = "2026-01-02-old-work";
    mkdirSync(join(root, ".bdk/changes/archive"), { recursive: true });
    writeDocument(fileStore(), join(root, ".bdk/changes/archive", archived, "change.md"), {
      data: {
        schema: 1,
        id: archived,
        kind: "feature",
        profile: "small",
        intent: "Old work.",
        source: "user",
        at: "2026-01-02T09:00:00Z",
        author: "BDK Test <test@example.com>",
        overridden: [],
      },
      body: "",
    });

    const live = answered(bdk(["change", "list", "--json"], root), "output/change-list.json") as {
      items: { change: string }[];
    };
    expect(live.items).toEqual([
      expect.objectContaining({ change: id, branch: BRANCH, state: "active" }),
    ]);
    const all = answered(
      bdk(["change", "list", "--all", "--json"], root),
      "output/change-list.json",
    ) as { items: { change: string; state: string }[] };
    expect(all.items.map((item) => [item.change, item.state])).toEqual([
      [id, "active"],
      [archived, "archived"],
    ]);
  });

  it("exit 3 input/unknown-flag", () => {
    refused(bdk(["change", "list", "--archived", "--json"], repository()), 3, "input/unknown-flag");
  });

  it("exit 5 runtime/not-a-repo: outside a work tree", () => {
    refused(bdk(["change", "list", "--json"], outsideRepository()), 5, "runtime/not-a-repo");
  });
});

describe("bdk change park and resume", () => {
  it("exit 0: parks with options and resumes with the chosen one", () => {
    const { root, id } = opened();
    const park = answered(
      bdk(
        ["change", "park", "--option", "accept as debt", "--option", "split part 02", "--json"],
        root,
      ),
      "output/change-park.json",
    ) as { entry: string; resume: string };
    expect(park).toMatchObject({
      options: ["accept as debt", "split part 02"],
      resume: `bdk change resume ${id} --option <n>`,
      checkpoint: { done: false, skipped: "change checkpoint lands with T22" },
    });
    expect(bdk(["change", "status", "--json"], root).json).toMatchObject({
      parked: { entry: park.entry },
    });

    const resume = answered(
      bdk(["change", "resume", id, "--option", "2", "--json"], root),
      "output/change-resume.json",
    );
    expect(resume).toMatchObject({ change: id, branch: BRANCH, resumedFrom: "parked" });
    expect(bdk(["change", "status", "--json"], root).json).not.toHaveProperty("parked");
  });

  it("exit 0: resume rebinds the Change to another branch", () => {
    const { root, id } = opened();
    git(root, "checkout", "--quiet", "-b", "feat/login-2");
    const result = answered(
      bdk(["change", "resume", id, "--json"], root),
      "output/change-resume.json",
    );
    expect(result).toMatchObject({ branch: "feat/login-2", resumedFrom: "other-branch" });
  });

  it("park exit 2 policy/invalid-transition: already parked", () => {
    const { root } = opened();
    bdk(["change", "park"], root);
    refused(bdk(["change", "park", "--json"], root), 2, "policy/invalid-transition");
  });

  it("park exit 2 policy/ticket-open: an attempt is open", () => {
    const { root, id } = opened();
    openAttempt(root, id);
    refused(bdk(["change", "park", "--json"], root), 2, "policy/ticket-open");
  });

  it("park exit 3 input/invalid-argument: a reason over 120 characters", () => {
    const { root } = opened();
    refused(
      bdk(["change", "park", "--reason", "x".repeat(121), "--json"], root),
      3,
      "input/invalid-argument",
    );
  });

  it("park exit 4 state/ledger-invalid: a log file fails its schema", () => {
    const { root, id } = opened();
    const [file] = logFiles(root, id);
    fileStore().write(join(root, ".bdk/changes", id, "log", file ?? ""), "---\nschema: 1\n---\n");
    refused(bdk(["change", "park", "--json"], root), 4, "state/ledger-invalid");
  });

  it("park exit 5 runtime/git-missing: git is not on PATH", () => {
    const { root } = opened();
    refused(bdk(["change", "park", "--json"], root, { git: false }), 5, "runtime/git-missing");
  });

  it("park exit 2 policy/no-active-change", () => {
    refused(bdk(["change", "park", "--json"], repository()), 2, "policy/no-active-change");
  });

  it("resume exit 3 input/not-found: no such Change", () => {
    refused(
      bdk(["change", "resume", "2026-01-01-nothing", "--json"], repository()),
      3,
      "input/not-found",
    );
  });

  it("resume exit 2 policy/invalid-transition: bound, not parked, no --profile", () => {
    const { root, id } = opened();
    refused(bdk(["change", "resume", id, "--json"], root), 2, "policy/invalid-transition");
  });

  it("resume exit 2 policy/change-exists: the branch is bound to another live Change", () => {
    const { root, id } = opened();
    git(root, "checkout", "--quiet", "-b", "feat/dark");
    const other = answered(
      bdk(["change", "new", "Add dark mode", "--json"], root),
      "output/change-new.json",
    ) as { change: string };
    expect(other.change).not.toBe(id);
    refused(bdk(["change", "resume", id, "--json"], root), 2, "policy/change-exists");
  });

  it("resume exit 0 raises the profile, exit 2 policy/profile-downgrade lowers it", () => {
    const { root, id } = opened();
    expect(
      answered(
        bdk(["change", "resume", id, "--profile", "large", "--json"], root),
        "output/change-resume.json",
      ),
    ).toHaveProperty("decision");
    refused(
      bdk(["change", "resume", id, "--profile", "small", "--json"], root),
      2,
      "policy/profile-downgrade",
    );
  });

  it("resume exit 2 policy/detached-head", () => {
    const { root, id } = opened();
    git(root, "checkout", "--quiet", "--detach");
    refused(bdk(["change", "resume", id, "--json"], root), 2, "policy/detached-head");
  });

  it("resume exit 5 runtime/git-missing: the option decision needs the author", () => {
    const { root, id } = opened();
    bdk(["change", "park"], root);
    refused(
      bdk(["change", "resume", id, "--option", "1", "--json"], root, { git: false }),
      5,
      "runtime/git-missing",
    );
  });
});
