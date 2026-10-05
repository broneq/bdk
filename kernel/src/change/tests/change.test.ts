// The change commands through the real registry on an in-memory repository
// (`kernel-cli/change`; `kernel-state`, Branch binding, Derived state).
import { describe, expect, it } from "vitest";

import {
  harness as graphHarness,
  passGate,
  PLUGIN,
  withPluginFiles,
  writeDesign,
  writeDesignVerdict,
  writeEntry as writeGraphEntry,
  writePlanPart,
} from "../../graph/tests/support.ts";
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
  TOOL_SETTINGS,
  withTools,
  writeChangeDoc,
} from "../../log/tests/support.ts";
import type { FakeGit } from "../../log/tests/support.ts";
import { settingsRegistry } from "../../registrations.ts";
import { fixedClock } from "../../shared/clock/index.ts";
import {
  memoryIndex,
  memoryRegistry,
  memoryStore,
  readDocument,
  readMarker,
  secondStamp,
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

const NOW = "2026-09-26T08:00:00.000Z";
const NEW_ID = "2026-09-26-users-log-in-with-a-one-time-link";

interface Harness {
  readonly store: Store;
  readonly git: FakeGit;
  readonly run: (argv: readonly string[]) => ReturnType<typeof runBdk>;
}

function harness(store: Store = withTools(memoryStore())): Harness {
  withPluginFiles(store);
  const git = fakeGit();
  return {
    store,
    git,
    run: (argv) => {
      const deps: ChangeDeps = {
        store,
        git,
        openIndex: memoryIndex,
        openRegistry: memoryRegistry(),
        clock: fixedClock(NOW),
        random: sequentialRandom(),
        pluginRoot: PLUGIN,
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
  writeDocument(store, `${DIR}/log/${secondStamp(at)}-transition-${id}.md`, {
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
      "opened-at": "2026-09-25T10:00:00.000Z",
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
    expect(changeIdOf("2026-09-26T23:59:59.000Z", "Add dark mode")).toBe(
      "2026-09-26-add-dark-mode",
    );
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
      next: "/bdk:design",
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
    expect(h.store.list(`${ROOT}/.bdk`)).toEqual(["settings.yaml"]);
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

  describe("--kind review", () => {
    const HEAD = "a".repeat(40);
    const ORIGIN = "b".repeat(40);
    const MAIN = "c".repeat(40);
    const BASE = "d".repeat(40);
    const REVIEW_ID = "2026-09-26-review-the-login-branch";

    /** Git answering `rev-parse` from `refs` and `merge-base HEAD` from `bases`. */
    function reviewing(
      refs: Record<string, string>,
      bases: Record<string, string>,
    ): { h: Harness; calls: string[][] } {
      const h = harness();
      const calls: string[][] = [];
      const run = h.git.run.bind(h.git);
      h.git.run = (args, cwd) => {
        calls.push([...args]);
        if (args[0] === "rev-parse") {
          const sha = refs[(args.at(-1) ?? "").replace("^{commit}", "")];
          return Promise.resolve(
            sha === undefined
              ? { code: 1, stdout: "", stderr: "" }
              : { code: 0, stdout: `${sha}\n`, stderr: "" },
          );
        }
        if (args[0] === "merge-base") {
          const sha = bases[args.at(-1) ?? ""];
          return Promise.resolve(
            sha === undefined
              ? { code: 1, stdout: "", stderr: "" }
              : { code: 0, stdout: `${sha}\n`, stderr: "" },
          );
        }
        return run(args, cwd);
      };
      return { h, calls };
    }

    const refs = { HEAD, "origin/HEAD": ORIGIN, main: MAIN };

    it("stamps kind review and the merge base with origin/HEAD; next is /bdk:cr", async () => {
      const { h, calls } = reviewing(refs, { [ORIGIN]: BASE });
      const result = await h.run([
        "change",
        "new",
        "Review the login branch",
        "--inferred",
        "--kind",
        "review",
        "--json",
      ]);

      expect(result.code).toBe(0);
      expect(changeNewOutput.parse(result.json)).toMatchObject({
        change: REVIEW_ID,
        kind: "review",
        source: "inferred",
        next: "/bdk:cr",
      });
      expect(calls).toContainEqual(["merge-base", "HEAD", ORIGIN]);
      expect(readDocument(h.store, `${ROOT}/.bdk/changes/${REVIEW_ID}/change.md`)).toMatchObject({
        data: { kind: "review", source: "inferred", base: BASE },
      });
    });

    it("--base main reviews from the merge base with main", async () => {
      const { h } = reviewing(refs, { [ORIGIN]: BASE, [MAIN]: MAIN });
      const result = await h.run([
        "change",
        "new",
        "Review the login branch",
        "--kind",
        "review",
        "--base",
        "main",
        "--json",
      ]);

      expect(result.code).toBe(0);
      expect(readDocument(h.store, `${ROOT}/.bdk/changes/${REVIEW_ID}/change.md`)).toMatchObject({
        data: { base: MAIN },
      });
    });

    it("refuses --base without --kind review and writes nothing", async () => {
      const { h } = reviewing(refs, { [MAIN]: MAIN });
      const result = await h.run(["change", "new", "x", "--base", "main", "--json"]);

      expect(result.code).toBe(3);
      expect(result.json).toMatchObject({ rule: "input/invalid-argument" });
      expect(h.store.list(`${ROOT}/.bdk`)).toEqual(["settings.yaml"]);
    });

    it.each([
      ["names no commit", { HEAD }, {}],
      ["shares no history with HEAD", refs, {}],
    ])("refuses a ref that %s as input/not-found and writes nothing", async (_, known, bases) => {
      const { h } = reviewing(known, bases);
      const result = await h.run([
        "change",
        "new",
        "x",
        "--kind",
        "review",
        "--base",
        "main",
        "--json",
      ]);

      expect(result.code).toBe(3);
      expect(result.json).toMatchObject({
        rule: "input/not-found",
        why: expect.stringContaining("main") as string,
        instead: expect.arrayContaining([expect.stringContaining("--base <ref>")]) as string[],
      });
      expect(h.store.list(`${ROOT}/.bdk`)).toEqual(["settings.yaml"]);
    });

    it("refuses a base equal to HEAD as policy/empty-range and writes nothing", async () => {
      const { h } = reviewing(refs, { [ORIGIN]: HEAD });
      const result = await h.run(["change", "new", "x", "--kind", "review", "--json"]);

      expect(result.code).toBe(2);
      expect(result.json).toMatchObject({ rule: "policy/empty-range" });
      expect(h.store.list(`${ROOT}/.bdk`)).toEqual(["settings.yaml"]);
    });

    it("a feature Change carries no base", async () => {
      const { h, calls } = reviewing(refs, { [ORIGIN]: BASE });
      await h.run(["change", "new", "Add dark mode"]);

      const change = readDocument(
        h.store,
        `${ROOT}/.bdk/changes/2026-09-26-add-dark-mode/change.md`,
      );
      expect(change).toMatchObject({ data: { kind: "feature" } });
      expect(change).not.toMatchObject({ data: { base: expect.anything() as unknown } });
      expect(calls.filter((args) => args[0] === "merge-base")).toEqual([]);
    });
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

  it("opens the Change without next when the graph refuses the settings", async () => {
    const h = harness();
    h.store.write(`${ROOT}/.bdk/settings.local.yaml`, "rules:\n  max-learnings-per-change: 3\n");

    const result = await h.run(["change", "new", "Add dark mode", "--json"]);

    expect(result.code).toBe(0);
    expect(result.json).not.toHaveProperty("next");
    const status = await h.run(["change", "status", "--json"]);
    expect(status.json).toMatchObject({ rule: "policy/unknown-config-key" });
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

  describe("tool groups (T49)", () => {
    it("refuses an unset tools.lint as policy/tools-unset and writes nothing", async () => {
      const store = memoryStore();
      store.write(
        `${ROOT}/.bdk/settings.yaml`,
        "tools:\n  test:\n    - { id: unit, tier: fast, command: vitest run }\n",
      );
      const h = harness(store);

      const result = await h.run(["change", "new", "Add dark mode", "--json"]);

      expect(result.code).toBe(2);
      expect(result.json).toStrictEqual({
        refused: true,
        rule: "policy/tools-unset",
        why: "tools.lint is unset: the Change runs lint and lint-full; configure the project's lint commands or declare that it has none",
        instead: [
          "bdk config set tools.lint.<id> '{tier: lint, command: <command>}'",
          "bdk config set tools.lint none",
          "/bdk:setup",
        ],
      });
      expect(h.store.list(`${ROOT}/.bdk`)).toEqual(["settings.yaml"]);
    });

    it("names both groups when neither is set", async () => {
      const h = harness(memoryStore());
      const result = await h.run(["change", "new", "Login fails", "--kind", "bug", "--json"]);

      expect(result.code).toBe(2);
      const refusal = result.json as { why: string; instead: string[] };
      expect(refusal.why).toMatch(
        /^tools\.test is unset: the Change runs tests-scoped and tests-full; .*; tools\.lint is unset: the Change runs lint and lint-full; /,
      );
      expect(refusal.instead).toStrictEqual([
        "bdk config set tools.test.<id> '{tier: fast, command: <command>}'",
        "bdk config set tools.test none",
        "bdk config set tools.lint.<id> '{tier: lint, command: <command>}'",
        "bdk config set tools.lint none",
        "/bdk:setup",
      ]);
      expect(h.store.list(ROOT)).toEqual([]);
    });

    it("opens a Change when both groups are declared none", async () => {
      const store = memoryStore();
      store.write(`${ROOT}/.bdk/settings.yaml`, "tools:\n  test: none\n  lint: none\n");
      const h = harness(store);

      const result = await h.run(["change", "new", "Add dark mode", "--json"]);

      expect(result.code).toBe(0);
    });

    it("leaves settings that do not validate to bdk next", async () => {
      const store = memoryStore();
      store.write(`${ROOT}/.bdk/settings.yaml`, "tools:\n  lint: []\n");
      const h = harness(store);

      const result = await h.run(["change", "new", "Add dark mode", "--json"]);

      expect(result.code).toBe(0);
    });
  });

  it("refuses on a detached HEAD", async () => {
    const h = harness();
    h.git.branch = undefined;

    const result = await h.run(["change", "new", "Add dark mode", "--json"]);

    expect(result.code).toBe(2);
    expect(result.json).toMatchObject({ rule: "policy/detached-head" });
    expect(h.store.list(`${ROOT}/.bdk`)).toEqual(["settings.yaml"]);
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
    writeTransition(h.store, "L-t0000001", "2026-09-25T09:10:00.000Z", "design");
    writeTransition(h.store, "L-t0000002", "2026-09-25T09:20:00.000Z", "plan-part:02");

    const result = await h.run(["change", "status", "--json"]);

    expect(result.code).toBe(0);
    expect(changeStatusOutput.parse(result.json)).toMatchObject({
      change: CHANGE,
      kind: "feature",
      profile: "small",
      source: "user",
      confirmed: true,
      stage: "plan",
      parts: [],
      openTickets: [],
      overriddenKeys: [],
    });
  });

  it("names the tool group states, lint declared none (T49)", async () => {
    const h = harness(repository());
    h.store.write(
      `${ROOT}/.bdk/settings.yaml`,
      "tools:\n  test:\n    - { id: unit, tier: fast, command: vitest run }\n  lint: none\n",
    );

    const json = await h.run(["change", "status", "--json"]);
    expect(changeStatusOutput.parse(json.json).tools).toStrictEqual({
      test: "configured",
      lint: "none",
    });
    const text = await h.run(["change", "status"]);
    expect(text.stdout).toContain("tools: lint not used (tools.lint is none)\n");
    expect(text.stdout).not.toContain("no test tool");
  });

  it("warns when the Change runs no test (T49)", async () => {
    const h = harness(repository());
    h.store.write(`${ROOT}/.bdk/settings.yaml`, "tools:\n  test: none\n");

    const json = await h.run(["change", "status", "--json"]);
    expect(json.json).toMatchObject({ tools: { test: "none", lint: "unset" } });
    const text = await h.run(["change", "status"]);
    expect(text.stdout).toContain(
      "warning: no test tool (tools.test is none): this Change runs no test\n",
    );
    expect(text.stdout).not.toContain("tools: lint");
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
          openedAt: "2026-09-25T10:00:00.000Z",
        },
      ],
    });
  });

  it("lists 20 open tickets in the text and points at attempt list for the rest", async () => {
    const h = harness(repository());
    for (let i = 0; i < 150; i++) addAttempt(h.store, `A-${String(i).padStart(8, "0")}`);

    const result = await h.run(["change", "status"]);

    const lines = result.stdout.trimEnd().split("\n");
    expect(lines.filter((line) => line.startsWith("open ticket "))).toHaveLength(20);
    expect(lines).toContain("... 130 more open tickets (bdk attempt list)");
    expect(lines.length).toBeLessThanOrEqual(100);
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
    writeTransition(h.store, "L-t0000001", "2026-09-25T09:10:00.000Z", "design");
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
      checkpoint: {
        done: false,
        skipped: `nothing under .bdk/changes/${CHANGE}/ changed since the last commit`,
      },
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
      next: "/bdk:design",
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

describe("change on the artifact graph", () => {
  const T0 = "2026-09-25T10:00:00.000Z";
  const T1 = "2026-09-25T10:05:00.000Z";

  it.each([
    [[], "/bdk:design"],
    [["--profile", "large", "--reason", "spans auth and mail"], "/bdk:design"],
    [["--profile", "tiny", "--reason", "a typo"], "/bdk:plan"],
    [["--kind", "bug"], "/bdk:plan"],
  ])("change new %j answers next %s", async (flags, next) => {
    const h = harness();
    const result = await h.run(["change", "new", "Users log in with a link", ...flags, "--json"]);
    expect(changeNewOutput.parse(result.json).next).toBe(next);
  });

  it("change resume answers the command of the gate the Change waits for", async () => {
    const h = graphHarness();
    writeDesign(h.store, "design");
    writeDesign(h.store, "architecture");
    await h.run(["done", "design"], T0);
    await h.run(["done", "architecture"], T0);
    writeDesignVerdict(h.store, T0);
    await h.run(["done", "design-verify"], T0);
    await h.run(["change", "park"], T0);
    const result = await h.run(["change", "resume", CHANGE, "--option", "1", "--json"], T1);
    expect(changeResumeOutput.parse(result.json)).toMatchObject({
      stage: "design",
      next: "/bdk:plan",
    });
  });

  it("change status fills the nodes and gates and derives the stage through the pipeline", async () => {
    const h = graphHarness();
    writeDesign(h.store, "design");
    await h.run(["done", "design"], T0);
    writeGraphEntry(h.store, {
      type: "question",
      at: T0,
      review: true,
      status: "proposed",
      summary: "WebAuthn?",
    });
    const status = changeStatusOutput.parse((await h.run(["change", "status", "--json"], T1)).json);
    expect(status.stage).toBe("design");
    expect(status.nodes.map((node) => [node.id, node.state])).toStrictEqual([
      ["intent", "done"],
      ["design", "done"],
      ["design-parts", "skipped"],
      ["design-index", "skipped"],
      ["architecture", "ready"],
      ["design-verify", "blocked"],
      ["gate:design", "blocked"],
      ["plan", "blocked"],
      ["plan-verify", "blocked"],
      ["execute", "blocked"],
      ["simplify", "blocked"],
      ["tests-scoped", "blocked"],
      ["lint", "blocked"],
      ["spec-delta", "skipped"],
      ["tests-full", "blocked"],
      ["lint-full", "blocked"],
      ["review", "blocked"],
      ["gate:review", "blocked"],
      ["close", "blocked"],
    ]);
    expect(status.nodes[1]?.inputHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(status.nodes[2]?.why).toBe("profile small is not in profiles [large]");
    expect(status.gates[0]).toMatchObject({
      gate: "gate:design",
      ready: false,
      done: false,
      command: "/bdk:plan",
      pending: [expect.objectContaining({ summary: "WebAuthn?" })],
    });
  });

  it("change status text stays within 100 lines on 8 parts and 1 000 entries", async () => {
    const h = graphHarness();
    h.store.write(
      `${ROOT}/.bdk/settings.yaml`,
      `${TOOL_SETTINGS}policy:\n  gates:\n    design: auto\n`,
    );
    writeDesign(h.store, "design");
    writeDesign(h.store, "architecture");
    await h.run(["done", "design"], T0);
    await h.run(["done", "architecture"], T0);
    writeDesignVerdict(h.store, T0);
    await h.run(["done", "design-verify"], T0);
    passGate(h.store, "gate:design", "plan", T1, "policy");
    for (let nn = 1; nn <= 8; nn++) writePlanPart(h.store, `0${String(nn)}`);
    await h.run(["done", "plan"], T1);
    for (let i = 0; i < 1000; i++) {
      writeGraphEntry(h.store, {
        type: "finding",
        at: T1,
        review: true,
        summary: `Finding ${String(i)}`,
      });
    }
    const result = await h.run(["change", "status"], T1);
    const lines = result.stdout.trimEnd().split("\n");
    expect(lines.length).toBeLessThanOrEqual(100);
    expect(lines).toContain("  plan-part:01..08 done (8)");
    expect(lines).toContain("gate:design: passed by policy");
  });
});
