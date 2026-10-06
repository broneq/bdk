// The kernel side of the rules audit (`kernel-cli/rules`; design D-6, D-8 of
// v3-t31) on a memory store with the in-memory index: recurrence across
// distinct Changes, the raw entry list and its cap, `rules.disabled` naming
// an unknown id, and the pure parts of import and export.
import { describe, expect, it } from "vitest";

import {
  AUTHOR,
  fakeGit,
  repository,
  ROOT,
  runBdk,
  writeChangeDoc,
} from "../../log/tests/support.ts";
import { settingsRegistry } from "../../registrations.ts";
import { fixedClock } from "../../shared/clock/index.ts";
import { memoryIndex, memoryRegistry, writeDocument } from "../../shared/store/index.ts";
import type { Store } from "../../shared/store/index.ts";
import { prefixFromName, prefixProblem, ruleTexts } from "../domain/import.ts";
import { projectionFiles } from "../domain/projection.ts";
import type { LoadedRule } from "../domain/rule.ts";
import { rulesRegistrations } from "../index.ts";
import { rulesCheckOutput, rulesStatsOutput } from "../schema/outputs.ts";

const PLUGIN = "/plugin";
const FINGERPRINT = `sha256:${"4".repeat(64)}`;

function run(store: Store, argv: readonly string[]) {
  const deps = {
    store,
    git: fakeGit(),
    openIndex: memoryIndex,
    openRegistry: memoryRegistry(),
    clock: fixedClock("2026-09-30T10:00:00.000Z"),
    pluginRoot: PLUGIN,
    settings: settingsRegistry(),
  };
  return runBdk(rulesRegistrations(deps), store, deps.git, argv);
}

/** A Change directory, archived or not, holding one learning per `at`. */
function changeWith(
  store: Store,
  id: string,
  ats: readonly string[],
  options: { archived?: boolean; fingerprint?: string; type?: string } = {},
): void {
  const dir = `${ROOT}/.bdk/changes/${options.archived === true ? "archive/" : ""}${id}`;
  writeChangeDoc(store, id, dir);
  ats.forEach((at, index) => {
    const entry = `L-${id.slice(-3)}${String(index).padStart(5, "0")}`;
    const stamp = at.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
    const type = options.type ?? "learning";
    writeDocument(store, `${dir}/log/${stamp}-${type}-${entry}.md`, {
      data: {
        schema: 1,
        id: entry,
        type,
        summary: `negative case missed in ${id}`,
        status: "proposed",
        source: "user",
        author: AUTHOR,
        at,
        refs: ["src/a.test.ts"],
        ...(type === "learning" ? { fingerprint: options.fingerprint ?? FINGERPRINT } : {}),
      },
      body: "",
    });
  });
}

function recurring(json: unknown) {
  return rulesStatsOutput.parse(json).recurring;
}

describe("rules stats: recurrence counts distinct Changes", () => {
  it("below the threshold: three times inside one Change and once in another", async () => {
    const store = repository();
    changeWith(store, "2026-09-20-one", [
      "2026-09-20T10:00:00.000Z",
      "2026-09-20T11:00:00.000Z",
      "2026-09-20T12:00:00.000Z",
    ]);
    changeWith(store, "2026-09-21-two", ["2026-09-21T10:00:00.000Z"]);
    const result = await run(store, ["rules", "stats", "--json"]);
    expect(result.code, result.stdout).toBe(0);
    expect(recurring(result.json)).toStrictEqual([]);
  });

  it("at the threshold: three distinct Changes, one archived, and no rule file written", async () => {
    const store = repository();
    changeWith(store, "2026-09-20-one", ["2026-09-20T10:00:00.000Z", "2026-09-20T11:00:00.000Z"], {
      archived: true,
    });
    changeWith(store, "2026-09-21-two", ["2026-09-21T10:00:00.000Z"]);
    changeWith(store, "2026-09-22-six", ["2026-09-22T10:00:00.000Z"]);
    const result = await run(store, ["rules", "stats", "--json"]);
    expect(recurring(result.json)).toStrictEqual([
      {
        fingerprint: FINGERPRINT,
        summary: "negative case missed in 2026-09-22-six",
        changes: 3,
        occurrences: 4,
        changeIds: ["2026-09-20-one", "2026-09-21-two", "2026-09-22-six"],
      },
    ]);
    expect(store.exists(`${ROOT}/.bdk/rules`)).toBe(false);
    const lower = await run(store, ["rules", "stats", "--min-changes", "4", "--json"]);
    expect(recurring(lower.json)).toStrictEqual([]);
  });

  it("counts attempt findings with the learnings, summarised by type and location", async () => {
    const store = repository();
    for (const id of ["2026-09-20-one", "2026-09-21-two", "2026-09-22-six"]) {
      const dir = `${ROOT}/.bdk/changes/${id}`;
      writeChangeDoc(store, id, dir);
      writeDocument(store, `${dir}/attempts/task-redispatch-01-1-A-0000000${id.slice(9, 10)}.md`, {
        data: {
          schema: 1,
          ticket: `A-0000000${id.slice(9, 10)}`,
          loop: "task-redispatch",
          target: "01-1",
          attempt: 1,
          of: 3,
          scope: "full",
          "opened-at": `${id.slice(0, 10)}T10:00:00.000Z`,
          author: AUTHOR,
          "closed-at": `${id.slice(0, 10)}T10:30:00.000Z`,
          outcome: "fail",
          findings: [
            { fingerprint: FINGERPRINT, type: "finding", file: "src/a.ts", symbol: "login" },
          ],
        },
        body: "",
      });
    }
    const report = rulesStatsOutput.parse(
      (await run(store, ["rules", "stats", "--entries", "--json"])).json,
    );
    expect(report.recurring).toMatchObject([
      {
        fingerprint: FINGERPRINT,
        summary: "finding at src/a.ts#login",
        changes: 3,
        occurrences: 3,
      },
    ]);
    expect(report.entries?.items[0]).toMatchObject({
      id: "2026-09-22-six/A-00000002",
      source: "attempt",
      refs: ["src/a.ts#login"],
      adopted: false,
    });
  });

  it("lists the raw entries newest first, at most 100 without --all", async () => {
    const store = repository();
    const ats = Array.from(
      { length: 101 },
      (_, index) =>
        `2026-09-20T${String(Math.floor(index / 60)).padStart(2, "0")}:${String(index % 60).padStart(2, "0")}:00.000Z`,
    );
    changeWith(store, "2026-09-20-one", ats, { type: "finding" });
    const page = rulesStatsOutput.parse(
      (await run(store, ["rules", "stats", "--entries", "--json"])).json,
    ).entries;
    expect(page?.items).toHaveLength(100);
    expect(page).toMatchObject({ total: 101, truncated: true });
    expect(page?.items[0]?.at).toBe("2026-09-20T01:40:00.000Z");
    const all = rulesStatsOutput.parse(
      (await run(store, ["rules", "stats", "--entries", "--all", "--json"])).json,
    ).entries;
    expect(all?.items).toHaveLength(101);
  });

  it("refuses a --min-changes that is not a positive integer", async () => {
    const result = await run(repository(), ["rules", "stats", "--min-changes", "0", "--json"]);
    expect(result).toMatchObject({ code: 3, json: { rule: "input/invalid-argument" } });
  });
});

describe("rules check", () => {
  it("refuses an id in rules.disabled that no rule carries", async () => {
    const store = repository();
    store.write(`${ROOT}/.bdk/settings.yaml`, "rules:\n  disabled: [BDK-CQ-99]\n");
    const result = await run(store, ["rules", "check", "--json"]);
    expect(result).toMatchObject({ code: 2, json: { rule: "policy/rule-format" } });
    expect((result.json as { why: string }).why).toContain("unknown-disabled-id");
    const clean = repository();
    const report = await run(clean, ["rules", "check", "--json"]);
    expect(rulesCheckOutput.parse(report.json)).toStrictEqual({
      valid: true,
      rules: 0,
      bundle: 0,
      project: 0,
      tombstones: 0,
    });
  });
});

describe("import parsing", () => {
  it("derives the prefix from the file name", () => {
    expect(prefixFromName("api-style.md")).toBe("API-STYLE");
    expect(prefixFromName("Naming_Rules.md")).toBe("NAMING-RULES");
    expect(prefixFromName("2fa.md")).toBeUndefined();
    expect(prefixProblem("BDK")).toContain("shipped pack");
    expect(prefixProblem("BDK-X")).toContain("shipped pack");
    expect(prefixProblem("api")).toContain("no rule prefix");
    expect(prefixProblem("BDKX")).toBeUndefined();
  });

  it("takes one rule per top-level bullet with its continuation, else the whole body", () => {
    const body =
      "# Heading\n\nIntro paragraph.\n\n- First rule.\n  More of it.\n  - nested stays\n* Second rule.\n\nTrailing prose.\n";
    expect(ruleTexts(body)).toStrictEqual([
      "First rule.\nMore of it.\n- nested stays",
      "Second rule.",
    ]);
    expect(ruleTexts("Just one paragraph.\n")).toStrictEqual(["Just one paragraph."]);
    expect(ruleTexts("\n\n")).toStrictEqual([]);
  });
});

describe("projection", () => {
  const rule = (id: string, applies?: string[]): LoadedRule => ({
    id,
    prefix: id.replace(/-\d+$/, ""),
    number: Number(id.replace(/^.*-/, "")),
    scope: "project",
    file: `.bdk/rules/${id}.md`,
    kind: "house",
    severity: "medium",
    origin: "user",
    since: "2026-09-30",
    text: `Text of ${id}.`,
    ...(applies === undefined ? {} : { applies }),
  });

  it("writes no file for an empty side", () => {
    const [global, scoped] = projectionFiles([rule("NAMING-1")]);
    expect(global.content).toContain("- [NAMING-1] Text of NAMING-1.\n");
    expect(scoped).toMatchObject({ rules: 0, paths: [], content: undefined });
  });

  it("quotes every glob of paths:, sorted and without duplicates", () => {
    const [, scoped] = projectionFiles([
      rule("UI-2", ["web/**", "*.tsx"]),
      rule("API-1", ["web/**"]),
    ]);
    expect(scoped.content).toMatch(/^---\npaths:\n {2}- "\*\.tsx"\n {2}- "web\/\*\*"\n---\n/);
  });
});

describe("rules stats text mode", () => {
  function projectRule(id: string): string {
    return `---\nschema: 1\nid: ${id}\nkind: house\nseverity: medium\norigin: user\nsince: 2026-09-30\n---\n\nText of ${id}.\n`;
  }

  it("prints the recurring items, the entries with the hidden count and the citations", async () => {
    const store = repository();
    store.write(`${ROOT}/.bdk/rules/API-1.md`, projectRule("API-1"));
    store.write(`${ROOT}/.bdk/rules/API-2.md`, projectRule("API-2"));
    for (const id of ["2026-09-20-one", "2026-09-21-two", "2026-09-22-three"]) {
      changeWith(store, id, [`${id.slice(0, 10)}T10:00:00.000Z`]);
    }
    changeWith(store, "2026-09-23-cite", ["2026-09-23T10:00:00.000Z"], {
      type: "finding",
      fingerprint: "unused",
    });
    const cite = `${ROOT}/.bdk/changes/2026-09-23-cite/log`;
    const [file = ""] = store.list(cite);
    store.write(
      `${cite}/${file}`,
      (store.read(`${cite}/${file}`) ?? "").replace("src/a.test.ts", "API-1"),
    );

    const lines = (await run(store, ["rules", "stats", "--entries"])).stdout.split("\n");
    expect(lines[0]).toBe("recurring in at least 3 Changes:");
    expect(lines[1]).toMatch(/^ {2}3 Changes, 3x: negative case missed in 2026-09-2\d-\w+$/);
    expect(lines).toContain("entries:");
    expect(lines.filter((line) => /^ {2}2026-09-2\d-\w+\/L-/.test(line))).toHaveLength(4);
    expect(lines).toContain("citations: 1 of 2 rules cited");
    expect(lines).toContain("  API-1: 1 entries in 1 Changes");
  });

  it("says none when nothing recurs", async () => {
    const store = repository();
    const lines = (await run(store, ["rules", "stats"])).stdout.split("\n");
    expect(lines.slice(0, 3)).toStrictEqual([
      "recurring in at least 3 Changes:",
      "  none",
      "citations: 0 of 0 rules cited",
    ]);
  });
});

describe("rules check with a path", () => {
  it("counts only the rules under the path and ignores problems elsewhere", async () => {
    const store = repository();
    const rule = (id: string) =>
      `---\nschema: 1\nid: ${id}\nkind: house\nseverity: medium\norigin: user\nsince: 2026-09-30\n---\n\nText.\n`;
    store.write(`${ROOT}/.bdk/rules/API-1.md`, rule("API-1"));
    store.write(`${ROOT}/.bdk/rules/BAD-1.md`, "---\nschema: 1\nid: BAD-1\n---\n\nText.\n");
    const one = await run(store, ["rules", "check", ".bdk/rules/API-1.md"]);
    expect(one.code, one.stdout).toBe(0);
    expect(one.stdout).toBe("rules valid: 1 (0 bundle, 1 project, 0 tombstones)\n");
    const all = await run(store, ["rules", "check", "--json"]);
    expect(all).toMatchObject({ code: 2, json: { rule: "policy/rule-format" } });
    expect((all.json as { why: string }).why).toContain(".bdk/rules/BAD-1.md");
    const missing = await run(store, ["rules", "check", "nope.md", "--json"]);
    expect(missing).toMatchObject({ code: 3, json: { rule: "input/not-found" } });
  });
});
