// The change commands through the real registry on an in-memory repository
// (`kernel-cli/change`; `kernel-state`, Branch binding, Derived state).
import { describe, expect, it } from "vitest";

import { logRegistrations } from "../../log/index.ts";
import {
  AUTHOR,
  BRANCH,
  CHANGE,
  DIR,
  fakeGit,
  repository,
  ROOT,
  runBdk,
  sequentialRandom,
  writeChangeDoc,
} from "../../log/tests/support.ts";
import type { FakeGit } from "../../log/tests/support.ts";
import { settingsRegistry } from "../../registrations.ts";
import { fixedClock } from "../../shared/clock/index.ts";
import {
  memoryIndex,
  memoryStore,
  readDocument,
  readMarker,
  writeDocument,
  writeMarker,
} from "../../shared/store/index.ts";
import type { Store } from "../../shared/store/index.ts";
import { changeIdOf, slugOf } from "../domain/change.ts";
import { changeRegistrations } from "../index.ts";
import type { ChangeDeps } from "../index.ts";
import {
  changeListOutput,
  changeNewOutput,
  changeParkOutput,
  changeResumeOutput,
  changeStatusOutput,
} from "../schema/outputs.ts";

const NOW = "2026-09-26T08:00:00Z";
const NEW_ID = "2026-09-26-users-log-in-with-a-one-time-link";

interface Harness {
  readonly store: Store;
  readonly git: FakeGit;
  readonly run: (argv: readonly string[]) => ReturnType<typeof runBdk>;
}

function harness(store: Store = memoryStore()): Harness {
  const git = fakeGit();
  return {
    store,
    git,
    run: (argv) => {
      const deps: ChangeDeps = {
        store,
        git,
        openIndex: memoryIndex,
        clock: fixedClock(NOW),
        random: sequentialRandom(),
        pluginRoot: "/plugins/bdk",
        settings: settingsRegistry(),
      };
      return runBdk([...changeRegistrations(deps), ...logRegistrations(deps)], store, git, argv);
    },
  };
}

function logFiles(store: Store, dir: string): string[] {
  return store.list(`${dir}/log`);
}

function entries(store: Store, dir: string): Record<string, unknown>[] {
  return logFiles(store, dir).map((name) => {
    const document = readDocument(store, `${dir}/log/${name}`);
    if (document === undefined || !("data" in document)) throw new Error(`unreadable ${name}`);
    return { ...document.data, body: document.body };
  });
}

function writeTransition(
  store: Store,
  id: string,
  at: string,
  to: string,
  source = "kernel",
): void {
  writeDocument(store, `${DIR}/log/${at.replace(/[-:]/g, "")}-transition-${id}.md`, {
    data: {
      schema: 1,
      id,
      type: "transition",
      summary: `Stage ${to}`,
      status: "accepted",
      source,
      author: AUTHOR,
      at,
      refs: ["change.md"],
      to,
    },
    body: "",
  });
}

function addAttempt(store: Store, ticket: string): void {
  writeDocument(store, `${DIR}/attempts/task-redispatch-02-3-${ticket}.md`, {
    data: {
      schema: 1,
      ticket,
      loop: "task-redispatch",
      target: "02-3",
      attempt: 1,
      of: 3,
      scope: "full",
      "opened-at": "2026-09-25T10:00:00Z",
      author: AUTHOR,
    },
    body: "",
  });
}

describe("domain", () => {
  it.each([
    ["Users log in with a one-time link", "users-log-in-with-a-one-time-link"],
    ["Zażółć gęślą jaźń!", "zazolc-gesla-jazn"],
    ["Fix   the  README.md typo", "fix-the-readme-md-typo"],
    ["!!! ???", "change"],
    ["a".repeat(50), "a".repeat(40)],
    ["alpha beta gamma delta epsilon zeta eta theta", "alpha-beta-gamma-delta-epsilon-zeta-eta"],
  ])("slugs %j as %s", (intent, slug) => {
    expect(slugOf(intent)).toBe(slug);
  });

  it("builds the id from the UTC date and the slug", () => {
    expect(changeIdOf("2026-09-26T23:59:59Z", "Add dark mode")).toBe("2026-09-26-add-dark-mode");
  });
});

describe("change new", () => {
  it("opens a Change with the default small profile, its assumption entry and the marker", async () => {
    const h = harness();
    const result = await h.run(["change", "new", "Users log in with a one-time link", "--json"]);

    expect(result.code).toBe(0);
    expect(changeNewOutput.parse(result.json)).toEqual({
      change: NEW_ID,
      branch: BRANCH,
      kind: "feature",
      profile: { value: "small", defaulted: true, entry: "L-00000001" },
      source: "user",
      overriddenKeys: [],
    });
    const dir = `${ROOT}/.bdk/changes/${NEW_ID}`;
    const change = readDocument(h.store, `${dir}/change.md`);
    expect(change).toMatchObject({
      data: { id: NEW_ID, kind: "feature", profile: "small", source: "user", at: NOW },
    });
    expect(entries(h.store, dir)).toEqual([
      expect.objectContaining({
        id: "L-00000001",
        type: "assumption",
        summary: "Profile small by default: no size decision taken at change new",
        source: "kernel",
        refs: ["change.md"],
        body: "Recorded by change new: the caller passed no --profile.\n",
      }),
    ]);
    expect(readMarker(h.store, ROOT, BRANCH)).toBe(NEW_ID);
  });

  it("appends both ignored paths to .gitignore", async () => {
    const h = harness();
    h.store.write(`${ROOT}/.gitignore`, "node_modules/");

    await h.run(["change", "new", "Add dark mode"]);

    expect(h.store.read(`${ROOT}/.gitignore`)).toBe(
      "node_modules/\n/.bdk/.machine/\n/.bdk/settings.local.yaml\n",
    );
  });

  it("leaves .gitignore alone when git already ignores both paths", async () => {
    const h = harness();
    h.git.ignored.add(".bdk/.machine/");
    h.git.ignored.add(".bdk/settings.local.yaml");

    await h.run(["change", "new", "Add dark mode"]);

    expect(h.store.exists(`${ROOT}/.gitignore`)).toBe(false);
  });

  it.each([
    ["tiny", "one word in one doc file, no behaviour change"],
    ["large", "spans auth, mail and the admin UI"],
  ])("records --profile %s with --reason as the entry body", async (profile, reason) => {
    const h = harness();
    const result = await h.run([
      "change",
      "new",
      "Fix typo in README",
      "--profile",
      profile,
      "--reason",
      reason,
      "--json",
    ]);

    expect(result.code).toBe(0);
    expect(result.json).toMatchObject({ profile: { value: profile, defaulted: false } });
    const dir = `${ROOT}/.bdk/changes/2026-09-26-fix-typo-in-readme`;
    expect(entries(h.store, dir)).toEqual([
      expect.objectContaining({
        summary: `Profile ${profile} set at change new`,
        body: `${reason}\n`,
      }),
    ]);
  });

  it("refuses --profile tiny without --reason and writes nothing", async () => {
    const h = harness();
    const result = await h.run(["change", "new", "Fix typo", "--profile", "tiny", "--json"]);

    expect(result.code).toBe(3);
    expect(result.json).toMatchObject({ rule: "input/missing-argument" });
    expect(h.store.list(ROOT)).toEqual([]);
  });

  it("stamps --kind bug and --inferred", async () => {
    const h = harness();
    const result = await h.run([
      "change",
      "new",
      "Login fails after reset",
      "--kind",
      "bug",
      "--inferred",
      "--json",
    ]);

    expect(result.json).toMatchObject({ kind: "bug", source: "inferred" });
    expect(
      readDocument(h.store, `${ROOT}/.bdk/changes/2026-09-26-login-fails-after-reset/change.md`),
    ).toMatchObject({ data: { kind: "bug", source: "inferred" } });
  });

  it("records the keys the local layer overrides", async () => {
    const h = harness();
    h.store.write(
      `${ROOT}/.bdk/settings.local.yaml`,
      "policy:\n  escalation:\n    enabled: false\n",
    );

    const result = await h.run(["change", "new", "Add dark mode", "--json"]);

    expect(result.json).toMatchObject({ overriddenKeys: ["policy.escalation.enabled"] });
    expect(
      readDocument(h.store, `${ROOT}/.bdk/changes/2026-09-26-add-dark-mode/change.md`),
    ).toMatchObject({ data: { overridden: ["policy.escalation.enabled"] } });
  });

  it("refuses a branch that already has an active Change", async () => {
    const h = harness(repository());
    const result = await h.run(["change", "new", "Add dark mode", "--json"]);

    expect(result.code).toBe(2);
    expect(result.json).toMatchObject({ rule: "policy/change-exists" });
    expect(result.json).toMatchObject({ why: expect.stringContaining(CHANGE) as string });
  });

  it("refuses when the Change directory exists", async () => {
    const h = harness();
    writeChangeDoc(h.store, NEW_ID);

    const result = await h.run(["change", "new", "Users log in with a one-time link", "--json"]);

    expect(result.code).toBe(2);
    expect(result.json).toMatchObject({
      rule: "policy/change-exists",
      why: expect.stringContaining(`.bdk/changes/${NEW_ID}/`) as string,
    });
  });

  it("refuses on a detached HEAD", async () => {
    const h = harness();
    h.git.branch = undefined;

    const result = await h.run(["change", "new", "Add dark mode", "--json"]);

    expect(result.code).toBe(2);
    expect(result.json).toMatchObject({ rule: "policy/detached-head" });
    expect(h.store.list(ROOT)).toEqual([]);
  });

  it("renders the opened Change as text", async () => {
    const h = harness();
    const result = await h.run(["change", "new", "Add dark mode"]);

    expect(result.stdout).toBe(
      "opened 2026-09-26-add-dark-mode on feat/login (feature, user)\nprofile small (default), recorded as L-00000001\n",
    );
  });
});

describe("change status", () => {
  it("derives the stage, profile and confirmation from the ledger", async () => {
    const h = harness(repository());
    writeTransition(h.store, "L-t0000001", "2026-09-25T09:10:00Z", "design");
    writeTransition(h.store, "L-t0000002", "2026-09-25T09:20:00Z", "plan");

    const result = await h.run(["change", "status", "--json"]);

    expect(result.code).toBe(0);
    expect(changeStatusOutput.parse(result.json)).toEqual({
      change: CHANGE,
      kind: "feature",
      profile: "small",
      source: "user",
      confirmed: true,
      stage: "plan",
      nodes: [],
      gates: [],
      parts: [],
      openTickets: [],
      overriddenKeys: [],
    });
  });

  it("answers the intent stage for a Change without transitions", async () => {
    const h = harness(repository());
    const result = await h.run(["change", "status", "--json"]);

    expect(result.json).toMatchObject({ stage: "intent" });
  });

  it("shows an inferred Change unconfirmed until a transition from the user", async () => {
    const h = harness();
    await h.run(["change", "new", "Add dark mode", "--inferred"]);

    const before = await h.run(["change", "status"]);
    expect(before.stdout).toContain("(feature, inferred, unconfirmed)");
    const json = await h.run(["change", "status", "--json"]);
    expect(json.json).toMatchObject({ source: "inferred", confirmed: false });
  });

  it("raises the profile after a decision carrying profile", async () => {
    const h = harness(repository());
    await h.run(["change", "resume", CHANGE, "--profile", "large"]);

    const result = await h.run(["change", "status", "--json"]);
    expect(result.json).toMatchObject({ profile: "large" });
  });

  it("shows the parked block and open tickets", async () => {
    const h = harness(repository());
    await h.run(["change", "park", "--option", "accept as debt", "--option", "split part 02"]);
    addAttempt(h.store, "A-00000009");

    const result = await h.run(["change", "status", "--json"]);

    expect(changeStatusOutput.parse(result.json)).toMatchObject({
      parked: {
        entry: "L-00000001",
        options: ["accept as debt", "split part 02"],
        resume: `bdk change resume ${CHANGE} --option <n>`,
      },
      openTickets: [
        {
          ticket: "A-00000009",
          loop: "task-redispatch",
          target: "02-3",
          attempt: 1,
          of: 3,
          scope: "full",
          openedAt: "2026-09-25T10:00:00Z",
        },
      ],
    });
  });

  it("keeps the text at most 100 lines", async () => {
    const h = harness(repository());
    for (let i = 0; i < 150; i++) addAttempt(h.store, `A-${String(i).padStart(8, "0")}`);

    const result = await h.run(["change", "status"]);

    expect(result.stdout.trimEnd().split("\n").length).toBeLessThanOrEqual(100);
  });

  it("refuses without an active Change", async () => {
    const h = harness();
    const result = await h.run(["change", "status", "--json"]);

    expect(result.code).toBe(2);
    expect(result.json).toMatchObject({ rule: "policy/no-active-change" });
  });
});

describe("change list", () => {
  function twoChanges(): Harness {
    const h = harness(repository());
    const other = "2026-09-24-dark-mode";
    writeChangeDoc(h.store, other);
    writeMarker(h.store, ROOT, "feat/dark", other);
    const archived = "2026-09-20-old-work";
    writeChangeDoc(h.store, archived, `${ROOT}/.bdk/changes/archive/${archived}`);
    return h;
  }

  it("lists live Changes newest updatedAt first, with branch and state", async () => {
    const h = twoChanges();
    writeTransition(h.store, "L-t0000001", "2026-09-25T09:10:00Z", "design");
    await h.run(["change", "park"]);
    writeChangeDoc(h.store, "2026-09-23-no-marker");

    const result = await h.run(["change", "list", "--json"]);

    expect(result.code).toBe(0);
    const page = changeListOutput.parse(result.json);
    expect(page.items.map((item) => [item.change, item.branch, item.state, item.stage])).toEqual([
      [CHANGE, BRANCH, "parked", "design"],
      ["2026-09-23-no-marker", undefined, "active", "intent"],
      ["2026-09-24-dark-mode", "feat/dark", "active", "intent"],
    ]);
    expect(page.total).toBe(3);
  });

  it("includes archived Changes with --all", async () => {
    const h = twoChanges();
    const result = await h.run(["change", "list", "--all", "--json"]);

    const page = changeListOutput.parse(result.json);
    expect(page.items.find((item) => item.change === "2026-09-20-old-work")).toMatchObject({
      state: "archived",
    });
    expect(page.total).toBe(3);
  });

  it("answers an empty page in a repository without Changes", async () => {
    const h = harness();
    const result = await h.run(["change", "list", "--json"]);

    expect(result.json).toEqual({ items: [], total: 0, truncated: false });
    expect((await h.run(["change", "list"])).stdout).toBe("no Changes\n");
  });
});

describe("change park", () => {
  it("writes the park question with the default options", async () => {
    const h = harness(repository());
    const result = await h.run(["change", "park", "--json"]);

    expect(result.code).toBe(0);
    expect(changeParkOutput.parse(result.json)).toEqual({
      change: CHANGE,
      entry: "L-00000001",
      options: ["accept as debt", "change decision X", "split part"],
      resume: `bdk change resume ${CHANGE} --option <n>`,
      checkpoint: { done: false, skipped: "change checkpoint lands with T22" },
    });
    expect(entries(h.store, DIR)).toEqual([
      expect.objectContaining({
        type: "question",
        summary: "Change parked: choose how to continue",
        source: "kernel",
        park: true,
        options: ["accept as debt", "change decision X", "split part"],
        refs: ["change.md"],
      }),
    ]);
  });

  it("uses --reason as the summary", async () => {
    const h = harness(repository());
    await h.run(["change", "park", "--reason", "Waiting for the security review"]);

    expect(entries(h.store, DIR)).toEqual([
      expect.objectContaining({ summary: "Waiting for the security review" }),
    ]);
  });

  it("refuses a reason over 120 characters", async () => {
    const h = harness(repository());
    const result = await h.run(["change", "park", "--reason", "x".repeat(121), "--json"]);

    expect(result.code).toBe(3);
    expect(result.json).toMatchObject({ rule: "input/invalid-argument" });
    expect(logFiles(h.store, DIR)).toEqual([]);
  });

  it("refuses an already parked Change", async () => {
    const h = harness(repository());
    await h.run(["change", "park"]);

    const result = await h.run(["change", "park", "--json"]);

    expect(result.code).toBe(2);
    expect(result.json).toMatchObject({ rule: "policy/invalid-transition" });
    expect(logFiles(h.store, DIR)).toHaveLength(1);
  });

  it("refuses while a ticket is open", async () => {
    const h = harness(repository());
    addAttempt(h.store, "A-00000009");

    const result = await h.run(["change", "park", "--json"]);

    expect(result.code).toBe(2);
    expect(result.json).toMatchObject({
      rule: "policy/ticket-open",
      why: expect.stringContaining("A-00000009") as string,
    });
  });
});

describe("change resume", () => {
  it("leaves the parked state with the chosen option as an accepted decision", async () => {
    const h = harness(repository());
    await h.run(["change", "park", "--option", "accept as debt", "--option", "split part 02"]);

    const result = await h.run(["change", "resume", CHANGE, "--option", "2", "--json"]);

    expect(result.code).toBe(0);
    expect(changeResumeOutput.parse(result.json)).toEqual({
      change: CHANGE,
      branch: BRANCH,
      stage: "intent",
      resumedFrom: "parked",
      decision: "L-00000002",
    });
    expect(entries(h.store, DIR)).toContainEqual(
      expect.objectContaining({
        type: "decision",
        summary: "split part 02",
        status: "accepted",
        source: "kernel",
        refs: ["L-00000001"],
      }),
    );
    expect((await h.run(["change", "status", "--json"])).json).not.toHaveProperty("parked");
  });

  it.each(["0", "3", "x"])("refuses --option %s outside the options", async (option) => {
    const h = harness(repository());
    await h.run(["change", "park", "--option", "a", "--option", "b"]);

    const result = await h.run(["change", "resume", CHANGE, "--option", option, "--json"]);

    expect(result.code).toBe(3);
    expect(result.json).toMatchObject({ rule: "input/invalid-argument" });
  });

  it("refuses a parked Change without --option", async () => {
    const h = harness(repository());
    await h.run(["change", "park"]);

    const result = await h.run(["change", "resume", CHANGE, "--json"]);

    expect(result.code).toBe(2);
    expect(result.json).toMatchObject({ rule: "policy/invalid-transition" });
  });

  it("refuses --option on a Change that is not parked", async () => {
    const h = harness(repository());
    const result = await h.run(["change", "resume", CHANGE, "--option", "1", "--json"]);

    expect(result.code).toBe(2);
    expect(result.json).toMatchObject({ rule: "policy/invalid-transition" });
  });

  it("rebinds from another local branch without writing an entry", async () => {
    const h = harness(repository());
    h.git.branch = "feat/login-2";

    const result = await h.run(["change", "resume", CHANGE, "--json"]);

    expect(result.json).toMatchObject({ branch: "feat/login-2", resumedFrom: "other-branch" });
    expect(readMarker(h.store, ROOT, "feat/login-2")).toBe(CHANGE);
    expect(readMarker(h.store, ROOT, BRANCH)).toBeUndefined();
    expect(logFiles(h.store, DIR)).toEqual([]);
  });

  it("binds a Change no marker names as coming from another machine", async () => {
    const h = harness();
    writeChangeDoc(h.store);

    const result = await h.run(["change", "resume", CHANGE, "--json"]);

    expect(result.json).toMatchObject({ branch: BRANCH, resumedFrom: "other-machine" });
    expect(readMarker(h.store, ROOT, BRANCH)).toBe(CHANGE);
  });

  it("raises the profile with a decision carrying profile", async () => {
    const h = harness(repository());
    const result = await h.run(["change", "resume", CHANGE, "--profile", "large", "--json"]);

    expect(result.code).toBe(0);
    expect(result.json).toMatchObject({ decision: "L-00000001" });
    expect(result.json).not.toHaveProperty("resumedFrom");
    expect(entries(h.store, DIR)).toEqual([
      expect.objectContaining({ type: "decision", profile: "large", refs: ["change.md"] }),
    ]);
  });

  it("writes nothing for the same profile", async () => {
    const h = harness(repository());
    const result = await h.run(["change", "resume", CHANGE, "--profile", "small", "--json"]);

    expect(result.code).toBe(0);
    expect(result.json).not.toHaveProperty("decision");
    expect(logFiles(h.store, DIR)).toEqual([]);
  });

  it("refuses a lower profile", async () => {
    const h = harness(repository());
    await h.run(["change", "resume", CHANGE, "--profile", "large"]);

    const result = await h.run(["change", "resume", CHANGE, "--profile", "small", "--json"]);

    expect(result.code).toBe(2);
    expect(result.json).toMatchObject({ rule: "policy/profile-downgrade" });
  });

  it("refuses a Change already bound, not parked and without --profile", async () => {
    const h = harness(repository());
    const result = await h.run(["change", "resume", CHANGE, "--json"]);

    expect(result.code).toBe(2);
    expect(result.json).toMatchObject({ rule: "policy/invalid-transition" });
  });

  it("refuses an archived Change", async () => {
    const h = harness();
    writeChangeDoc(h.store, CHANGE, `${ROOT}/.bdk/changes/archive/${CHANGE}`);

    const result = await h.run(["change", "resume", CHANGE, "--json"]);

    expect(result.code).toBe(2);
    expect(result.json).toMatchObject({ rule: "policy/invalid-transition" });
  });

  it("refuses a branch bound to another live Change", async () => {
    const h = harness(repository());
    writeChangeDoc(h.store, "2026-09-24-dark-mode");

    const result = await h.run(["change", "resume", "2026-09-24-dark-mode", "--json"]);

    expect(result.code).toBe(2);
    expect(result.json).toMatchObject({ rule: "policy/change-exists" });
  });

  it("refuses an unknown Change and a detached HEAD", async () => {
    const h = harness(repository());
    const missing = await h.run(["change", "resume", "2026-01-01-nothing", "--json"]);
    expect(missing.json).toMatchObject({ rule: "input/not-found" });

    h.git.branch = undefined;
    const detached = await h.run(["change", "resume", CHANGE, "--json"]);
    expect(detached.json).toMatchObject({ rule: "policy/detached-head" });
  });
});
