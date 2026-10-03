// `bdk rules show` (`kernel-cli/rules`; T23-D27, D28, T31) through the
// registry on a memory store with the in-memory index: one rule by id, the
// rules a ticket's package records in its order with the glob that matched,
// the `rules-read` stamp and the refusals.
import { describe, expect, it } from "vitest";

import { writePlanPart } from "../../graph/tests/support.ts";
import { AUTHOR, CHANGE, DIR, fakeGit, repository, ROOT, runBdk } from "../../log/tests/support.ts";
import { settingsRegistry } from "../../registrations.ts";
import { fixedClock } from "../../shared/clock/index.ts";
import {
  memoryIndex,
  readAttempts,
  stampPackage,
  writeDocument,
} from "../../shared/store/index.ts";
import type { Store } from "../../shared/store/index.ts";
import { rulesRegistrations } from "../index.ts";
import { oneRuleOutput, rulesShowOutput, ticketRulesOutput } from "../schema/show.ts";

const PLUGIN = "/plugin";
const FIRST = "2026-09-25T10:00:41.000Z";
const LATER = "2026-09-25T10:09:00.000Z";

function rule(id: string, extra = "", origin = "bdk"): string {
  return `---\nschema: 1\nid: ${id}\nkind: house\nseverity: medium\norigin: ${origin}\nsince: 2026-09-30\n${extra}---\n\nText of ${id}.\n`;
}

function withRules(store: Store): Store {
  store.write(`${PLUGIN}/rules/code-quality/BDK-CQ-1.md`, rule("BDK-CQ-1"));
  store.write(
    `${PLUGIN}/rules/languages/typescript/BDK-TS-1.md`,
    rule("BDK-TS-1", "applies: ['**/*.ts']\n"),
  );
  store.write(`${ROOT}/.bdk/rules/API-1.md`, rule("API-1", "applies: [src/api/**]\n", "user"));
  store.write(`${ROOT}/.bdk/rules/API-2.md`, rule("API-2", "removed: superseded\n", "user"));
  store.write(
    `${ROOT}/.bdk/settings.yaml`,
    "languages: [typescript]\nrules:\n  disabled: [BDK-CQ-1]\n",
  );
  writePlanPart(store, "02", {
    body: "## 02-3 Verify\n\n**Files:**\n\n- Create: `src/api/login.ts`\n\n**Test cases:**\n\n- verifies\n",
  });
  return store;
}

function ticket(
  store: Store,
  id: string,
  role: string | undefined,
  fields: { closed?: boolean; rules?: readonly string[] } = {},
): void {
  writeDocument(store, `${DIR}/attempts/task-redispatch-02-3-${id}.md`, {
    data: {
      schema: 1,
      ticket: id,
      loop: "task-redispatch",
      target: "02-3",
      attempt: 1,
      of: 3,
      scope: "full",
      "opened-at": "2026-09-25T10:00:00.000Z",
      author: AUTHOR,
      ...(fields.closed === true ? { "closed-at": "2026-09-25T10:30:00.000Z", outcome: "ok" } : {}),
    },
    body: "",
  });
  if (role !== undefined) built(store, id, role, fields.rules ?? []);
}

/** What `dispatch build` leaves: the role's package, stamped as the ticket's active one. */
function built(store: Store, id: string, role: string, rules: readonly string[] = []): void {
  const path = `.bdk/changes/${CHANGE}/dispatch/02-3-${role}-${id}.md`;
  writeDocument(store, `${ROOT}/${path}`, {
    data: {
      schema: 1,
      ticket: id,
      target: "02-3",
      role,
      adapter: role === "implementer" ? "worker" : "reader",
      attempt: 1,
      of: 3,
      scope: "full",
      at: "2026-09-25T10:00:01.000Z",
      "kernel-version": "3.0.0-dev",
      "template-hash": `sha256:${"a".repeat(64)}`,
      report: `.bdk/changes/${CHANGE}/reports/02-3-${role}-${id}.md`,
      rules: [...rules],
    },
    body: "",
  });
  stampPackage(store, DIR, id, path);
}

function run(store: Store, argv: readonly string[], at = FIRST) {
  const deps = {
    store,
    git: fakeGit(),
    openIndex: memoryIndex,
    clock: fixedClock(at),
    pluginRoot: PLUGIN,
    settings: settingsRegistry(),
  };
  return runBdk(rulesRegistrations(deps), store, deps.git, argv);
}

const show = (store: Store, id: string, at = FIRST) =>
  run(store, ["rules", "show", "--ticket", id, "--json"], at);

describe("rules show --ticket", () => {
  it("prints the package's rules in its order with the matched glob, and stamps rules-read", async () => {
    const store = withRules(repository());
    ticket(store, "A-7f3k9m2q", "implementer", { rules: ["API-1", "BDK-TS-1"] });
    const result = await show(store, "A-7f3k9m2q");
    expect(result.code, result.stdout).toBe(0);
    expect(ticketRulesOutput.parse(result.json)).toStrictEqual({
      ticket: "A-7f3k9m2q",
      role: "implementer",
      target: "02-3",
      rules: [
        {
          id: "API-1",
          kind: "house",
          severity: "medium",
          applies: ["src/api/**"],
          matchedBy: "src/api/**",
          text: "Text of API-1.",
        },
        {
          id: "BDK-TS-1",
          kind: "house",
          severity: "medium",
          applies: ["**/*.ts"],
          matchedBy: "**/*.ts",
          text: "Text of BDK-TS-1.",
        },
      ],
      rulesRead: FIRST,
    });
    expect(readAttempts(store, DIR)[0]?.data["rules-read"]).toBe(FIRST);
  });

  it("prints an empty list for a package that records no rule", async () => {
    const store = withRules(repository());
    ticket(store, "A-r2n4t6m8", "runner");
    const result = await show(store, "A-r2n4t6m8");
    expect(result.code).toBe(0);
    expect(ticketRulesOutput.parse(result.json).rules).toStrictEqual([]);
  });

  it("stamps nothing under a simplifier's package (R2)", async () => {
    const store = withRules(repository());
    ticket(store, "A-s1m2p3l4", "implementer");
    built(store, "A-s1m2p3l4", "simplifier", ["API-1"]);
    const output = ticketRulesOutput.parse((await show(store, "A-s1m2p3l4")).json);
    expect(output.role).toBe("simplifier");
    expect(output.rulesRead).toBeUndefined();
    expect(readAttempts(store, DIR)[0]?.data["rules-read"]).toBeUndefined();
  });

  it("resolves the role through the active package, not the first package file", async () => {
    const store = withRules(repository());
    ticket(store, "A-7f3k9m2q", "runner");
    built(store, "A-7f3k9m2q", "verifier");
    expect(ticketRulesOutput.parse((await show(store, "A-7f3k9m2q")).json).role).toBe("verifier");
  });

  it("prints a stamp an implementer made to a later role, and keeps the first time", async () => {
    const store = withRules(repository());
    ticket(store, "A-7f3k9m2q", "implementer");
    await show(store, "A-7f3k9m2q", FIRST);
    expect(ticketRulesOutput.parse((await show(store, "A-7f3k9m2q", LATER)).json).rulesRead).toBe(
      FIRST,
    );
    built(store, "A-7f3k9m2q", "runner");
    const later = ticketRulesOutput.parse((await show(store, "A-7f3k9m2q", LATER)).json);
    expect(later).toMatchObject({ role: "runner", rulesRead: FIRST });
  });

  it("prints each rule as an id line in text mode", async () => {
    const store = withRules(repository());
    ticket(store, "A-9c2d4f6h", "reviewer", { rules: ["API-1"] });
    const result = await run(store, ["rules", "show", "--ticket", "A-9c2d4f6h"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("## BDK rules: A-9c2d4f6h (reviewer, 02-3)");
    expect(result.stdout).toContain("- [API-1] Text of API-1. (matched by src/api/**)");
  });

  it("refuses a package that records an id no rule file holds", async () => {
    const store = withRules(repository());
    ticket(store, "A-7f3k9m2q", "implementer", { rules: ["API-9"] });
    const result = await show(store, "A-7f3k9m2q");
    expect(result.code).toBe(3);
    expect(result.json).toMatchObject({ rule: "input/not-found" });
    expect((result.json as { why: string }).why).toMatch(/API-9/);
  });

  it("refuses a ticket the Change does not hold with input/not-found", async () => {
    const result = await show(withRules(repository()), "A-00000000");
    expect(result.code).toBe(3);
    expect(result.json).toMatchObject({ rule: "input/not-found" });
  });

  it.each([
    ["closed", true, "implementer"],
    ["without a package", false, undefined],
  ])("refuses a ticket %s with policy/no-open-ticket", async (_, closed, role) => {
    const store = withRules(repository());
    ticket(store, "A-7f3k9m2q", role, { closed });
    const result = await show(store, "A-7f3k9m2q");
    expect(result.code).toBe(2);
    expect(result.json).toMatchObject({ rule: "policy/no-open-ticket" });
    expect(readAttempts(store, DIR)[0]?.data["rules-read"]).toBeUndefined();
  });

  describe("with a group reference", () => {
    const ROUND = "A-r1v2w3x4";

    /** A review-fix round on the Change with the packages of groups p01 and p02. */
    function round(): Store {
      const store = withRules(repository());
      writeDocument(store, `${DIR}/attempts/review-fix-${CHANGE}-${ROUND}.md`, {
        data: {
          schema: 1,
          ticket: ROUND,
          loop: "review-fix",
          target: CHANGE,
          attempt: 1,
          of: 2,
          scope: "full",
          "opened-at": "2026-09-25T10:00:00.000Z",
          author: AUTHOR,
        },
        body: "",
      });
      for (const [group, rules, files] of [
        ["p01", ["API-1"], ["src/api/login.ts"]],
        ["p02", ["BDK-TS-1"], ["web/form.ts"]],
      ] as const) {
        writeDocument(store, `${DIR}/dispatch/${CHANGE}-reviewer-${ROUND}-${group}.md`, {
          data: {
            schema: 1,
            ticket: ROUND,
            target: CHANGE,
            role: "reviewer",
            adapter: "reviewer",
            attempt: 1,
            of: 2,
            scope: "full",
            at: "2026-09-25T10:00:01.000Z",
            "kernel-version": "3.0.0-dev",
            "template-hash": `sha256:${"a".repeat(64)}`,
            report: `.bdk/changes/${CHANGE}/reports/${CHANGE}-reviewer-${ROUND}-${group}.md`,
            rules: [...rules],
            group,
            files: [...files],
          },
          body: "",
        });
      }
      return store;
    }

    it("prints the group's rules, matched against the group's files", async () => {
      const result = await show(round(), `${ROUND}@p01`);
      expect(result.code, result.stdout).toBe(0);
      expect(ticketRulesOutput.parse(result.json)).toMatchObject({
        ticket: ROUND,
        group: "p01",
        role: "reviewer",
        rules: [{ id: "API-1", matchedBy: "src/api/**" }],
      });
    });

    it("refuses a group without a package with policy/no-open-ticket", async () => {
      const result = await show(round(), `${ROUND}@p09`);
      expect(result.code).toBe(2);
      expect(result.json).toMatchObject({ rule: "policy/no-open-ticket" });
    });

    it("refuses a malformed group with input/invalid-argument", async () => {
      const result = await show(round(), `${ROUND}@P_01`);
      expect(result.code).toBe(3);
      expect(result.json).toMatchObject({ rule: "input/invalid-argument" });
    });
  });

  it("refuses <id> together with --ticket", async () => {
    const result = await run(withRules(repository()), [
      "rules",
      "show",
      "API-1",
      "--ticket",
      "A-7f3k9m2q",
      "--json",
    ]);
    expect(result.json).toMatchObject({ rule: "input/invalid-argument" });
  });
});

describe("rules show <id>", () => {
  it("prints a project rule with its frontmatter and text", async () => {
    const result = await run(withRules(repository()), ["rules", "show", "API-1", "--json"]);
    expect(result.code, result.stdout).toBe(0);
    expect(oneRuleOutput.parse(result.json)).toStrictEqual({
      id: "API-1",
      scope: "project",
      file: ".bdk/rules/API-1.md",
      kind: "house",
      severity: "medium",
      applies: ["src/api/**"],
      origin: "user",
      since: "2026-09-30",
      disabled: false,
      text: "Text of API-1.",
    });
  });

  it("prints a tombstone with its reason and a disabled pack rule", async () => {
    const store = withRules(repository());
    const tombstone = await run(store, ["rules", "show", "API-2", "--json"]);
    expect(tombstone.code).toBe(0);
    expect(oneRuleOutput.parse(tombstone.json).removed).toBe("superseded");
    const disabled = oneRuleOutput.parse(
      (await run(store, ["rules", "show", "BDK-CQ-1", "--json"])).json,
    );
    expect(disabled).toMatchObject({
      scope: "bundle",
      file: "rules/code-quality/BDK-CQ-1.md",
      disabled: true,
    });
  });

  it("prints the frontmatter fields and the text in text mode", async () => {
    const result = await run(withRules(repository()), ["rules", "show", "API-1"]);
    expect(result.stdout).toContain("## API-1\n\nfile: .bdk/rules/API-1.md\nkind: house");
    expect(result.stdout).toContain("applies: src/api/**");
    expect(result.stdout).toContain("\n\nText of API-1.\n");
  });

  it("refuses an id no rule has with input/not-found", async () => {
    const result = await run(withRules(repository()), ["rules", "show", "API-7", "--json"]);
    expect(result.code).toBe(3);
    expect(rulesShowOutput.safeParse(result.json).success).toBe(false);
    expect(result.json).toMatchObject({ rule: "input/not-found" });
  });
});
