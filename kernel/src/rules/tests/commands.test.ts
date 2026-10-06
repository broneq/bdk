// The rules verbs that write or report on project rules (`kernel-cli/rules`;
// design D-6, D-9 of v3-t31) on a memory store with the in-memory index:
// `accept`, `prune` and the text mode of `explain`.
import { describe, expect, it } from "vitest";

import { AUTHOR, CHANGE, fakeGit, repository, ROOT, runBdk } from "../../log/tests/support.ts";
import type { FakeGit } from "../../log/tests/support.ts";
import { settingsRegistry } from "../../registrations.ts";
import { fixedClock } from "../../shared/clock/index.ts";
import { memoryIndex, memoryRegistry, writeDocument } from "../../shared/store/index.ts";
import type { Store } from "../../shared/store/index.ts";
import { rulesRegistrations } from "../index.ts";
import { rulesAcceptOutput, rulesPruneOutput } from "../schema/outputs.ts";
import { ruleFile } from "../../../tests/support/rule-file.ts";

const PLUGIN = "/plugin";
/** The required `--path` and `--stage` of `rules accept`, for a test about another flag. */
const WHERE = ["--path", "**", "--stage", "plan"] as const;
const RULES = `${ROOT}/.bdk/rules`;
const HOST = `${ROOT}/.claude/rules`;

/** A git whose `ls-files` lists `files`. */
function gitListing(files: readonly string[]): FakeGit {
  const git = fakeGit();
  git.workTree.push(...files);
  return git;
}

function run(
  store: Store,
  argv: readonly string[],
  options: { git?: FakeGit; stdin?: string } = {},
) {
  const deps = {
    store,
    git: options.git ?? fakeGit(),
    openIndex: memoryIndex,
    openRegistry: memoryRegistry(),
    clock: fixedClock("2026-09-30T10:00:00.000Z"),
    pluginRoot: PLUGIN,
    settings: settingsRegistry(),
  };
  return runBdk(rulesRegistrations(deps), store, deps.git, argv, options.stdin);
}

function refusedWith(result: { code: number; stdout: string }, code: number, rule: string): void {
  expect(result.code, result.stdout).toBe(code);
  expect(result.stdout).toContain(rule);
}

describe("rules accept", () => {
  it("writes the next number with origin user and leaves .claude/rules/ alone", async () => {
    const store = repository();
    store.write(`${RULES}/API-2.md`, ruleFile("API-2"));
    store.write(`${HOST}/naming.md`, "- Name booleans as questions.\n");
    const result = await run(store, [
      "rules",
      "accept",
      "Validate every request body.",
      "--prefix",
      "API",
      "--path",
      "src/api/**",
      "--stage",
      "execute",
      "--stage",
      "review",
      "--severity",
      "high",
      "--json",
    ]);
    expect(result.code, result.stdout).toBe(0);
    const report = rulesAcceptOutput.parse(result.json);
    expect(report).toMatchObject({ id: "API-3", path: ".bdk/rules/API-3.md", origin: "user" });
    expect(result.json).not.toHaveProperty("projection");
    expect(store.list(HOST)).toStrictEqual(["naming.md"]);
    expect(store.read(`${HOST}/naming.md`)).toBe("- Name booleans as questions.\n");
    const text = store.read(`${RULES}/API-3.md`) ?? "";
    expect(text).toContain("paths:\n  - src/api/**\nstages:\n  - execute\n  - review\n");
    expect(text).toContain("severity: high");
    expect(text).toContain("since: 2026-09-30");
    expect(text).toContain("Validate every request body.");
  });

  it("reads the text from stdin and prints the adoption", async () => {
    const store = repository();
    const result = await run(store, ["rules", "accept", "-", "--prefix", "API", ...WHERE], {
      stdin: "  Name the owner.\n",
    });
    expect(result.stdout.split("\n")[0]).toBe("accepted API-1: .bdk/rules/API-1.md (origin user)");
    expect(store.read(`${RULES}/API-1.md`)).toContain("Name the owner.");
  });

  it("takes the first --from as origin and keeps every one as evidence", async () => {
    const store = repository();
    writeDocument(
      store,
      `${ROOT}/.bdk/changes/${CHANGE}/log/20260930T100000Z-learning-L-00000001.md`,
      {
        data: {
          schema: 1,
          id: "L-00000001",
          type: "learning",
          summary: "negative case missed",
          status: "proposed",
          source: "user",
          author: AUTHOR,
          at: "2026-09-30T10:00:00.000Z",
          refs: ["src/a.test.ts"],
          fingerprint: `sha256:${"4".repeat(64)}`,
        },
        body: "",
      },
    );
    const from = `${CHANGE}/L-00000001`;
    const result = await run(store, [
      "rules",
      "accept",
      "Test the negative case.",
      "--prefix",
      "TEST",
      ...WHERE,
      "--from",
      from,
      "--json",
    ]);
    expect(result.code, result.stdout).toBe(0);
    expect(rulesAcceptOutput.parse(result.json).origin).toBe(from);
    expect(store.read(`${RULES}/TEST-1.md`)).toContain(`evidence:\n  - ${from}`);
  });

  it("writes a knowledge rule with its source and verified date", async () => {
    const store = repository();
    const result = await run(store, [
      "rules",
      "accept",
      "The API rate limit is 100 per minute.",
      "--prefix",
      "API",
      ...WHERE,
      "--kind",
      "knowledge",
      "--source",
      "https://example.com/limits",
      "--verified",
      "2026-09-29",
    ]);
    expect(result.code, result.stdout).toBe(0);
    expect(store.read(`${RULES}/API-1.md`)).toContain("verified: 2026-09-29");
  });

  it.each([
    ["no --prefix", ["Text.", ...WHERE], 3, "input/missing-argument"],
    ["no --path", ["Text.", "--prefix", "API", "--stage", "plan"], 3, "input/missing-argument"],
    ["no --stage", ["Text.", "--prefix", "API", "--path", "**"], 3, "input/missing-argument"],
    [
      "--stage close",
      ["Text.", "--prefix", "API", "--path", "**", "--stage", "close"],
      3,
      "input/invalid-argument",
    ],
    [
      "--stage *",
      ["Text.", "--prefix", "API", "--path", "**", "--stage", "*"],
      3,
      "input/invalid-argument",
    ],
    [
      "the removed --applies",
      ["Text.", "--prefix", "API", ...WHERE, "--applies", "**"],
      3,
      "input/unknown-flag",
    ],
    ["an empty text", [" ", "--prefix", "API", ...WHERE], 3, "input/invalid-argument"],
    ["the BDK prefix", ["Text.", "--prefix", "BDK", ...WHERE], 2, "policy/rule-format"],
    [
      "knowledge without a source",
      ["Text.", "--prefix", "API", ...WHERE, "--kind", "knowledge"],
      2,
      "policy/rule-format",
    ],
    [
      "house with a source",
      ["Text.", "--prefix", "API", ...WHERE, "--source", "x"],
      2,
      "policy/rule-format",
    ],
    [
      "a malformed --from",
      ["Text.", "--prefix", "API", ...WHERE, "--from", "L-1"],
      3,
      "input/invalid-argument",
    ],
    [
      "an invalid verified date",
      [
        "Text.",
        "--prefix",
        "API",
        ...WHERE,
        "--kind",
        "knowledge",
        "--source",
        "x",
        "--verified",
        "yesterday",
      ],
      2,
      "policy/rule-format",
    ],
  ])("refuses %s", async (_, args, code, rule) => {
    const store = repository();
    refusedWith(await run(store, ["rules", "accept", ...args]), code, rule);
    expect(store.exists(`${RULES}/API-1.md`)).toBe(false);
  });

  it("refuses a --from the index does not hold", async () => {
    const store = repository();
    refusedWith(
      await run(store, [
        "rules",
        "accept",
        "Text.",
        "--prefix",
        "API",
        ...WHERE,
        "--from",
        `${CHANGE}/A-00000001`,
      ]),
      3,
      "input/not-found",
    );
  });

  it("refuses while the prefix already holds a duplicate id", async () => {
    const store = repository();
    store.write(`${RULES}/API-1.md`, ruleFile("API-1"));
    store.write(`${RULES}/api-copy.md`, ruleFile("API-1"));
    refusedWith(
      await run(store, ["rules", "accept", "Text.", "--prefix", "API", ...WHERE]),
      2,
      "policy/duplicate-rule-id",
    );
  });
});

describe("rules prune", () => {
  it("reports a glob that matches no file, and uncited rules once the window is full", async () => {
    const store = repository();
    store.write(`${RULES}/API-1.md`, ruleFile("API-1", { paths: ["legacy/**"] }));
    store.write(`${RULES}/API-2.md`, ruleFile("API-2", { paths: ["src/**"] }));
    store.write(`${RULES}/OLD-1.md`, ruleFile("OLD-1", { paths: ["gone/**"] }));
    store.write(`${ROOT}/.bdk/settings.yaml`, "rules:\n  disabled: [OLD-1]\n");
    store.write(
      `${PLUGIN}/rules/languages/react/BDK-REACT-1.md`,
      ruleFile("BDK-REACT-1", { origin: "bdk", paths: ["**/*.tsx"] }),
    );
    const git = gitListing(["src/a.ts"]);

    const counted = await run(store, ["rules", "prune", "--json"], { git });
    expect(counted.code, counted.stdout).toBe(0);
    expect(rulesPruneOutput.parse(counted.json).items).toStrictEqual([
      { id: "API-1", reason: "no-match", detail: 'paths: ["legacy/**"] matches 0 files' },
    ]);

    const windowed = await run(store, ["rules", "prune", "--uncited", "1"], { git });
    expect(windowed.stdout).toBe(
      [
        'API-1 no-match: paths: ["legacy/**"] matches 0 files',
        "API-1 uncited: no entry of the last 1 Changes names API-1",
        "API-2 uncited: no entry of the last 1 Changes names API-2",
        "",
      ].join("\n"),
    );
  });

  it("says so when nothing is to prune, and refuses a non-numeric window", async () => {
    const store = repository();
    expect((await run(store, ["rules", "prune"])).stdout).toBe("No rule to prune.\n");
    refusedWith(
      await run(store, ["rules", "prune", "--uncited", "many"]),
      3,
      "input/invalid-argument",
    );
  });
});

describe("text mode", () => {
  it("rules explain names the matching glob, the global rules and the disabled ones", async () => {
    const store = repository();
    store.write(`${RULES}/API-1.md`, ruleFile("API-1", { paths: ["src/api/**"] }));
    store.write(`${RULES}/NAMING-1.md`, ruleFile("NAMING-1"));
    store.write(`${RULES}/OLD-1.md`, ruleFile("OLD-1"));
    store.write(`${ROOT}/.bdk/settings.yaml`, "rules:\n  disabled: [OLD-1]\n");
    store.write(`${ROOT}/src/api/a.ts`, "");
    const result = await run(store, ["rules", "explain", "src/api/a.ts", "--role", "reviewer"]);
    expect(result.stdout).toBe(
      [
        "src/api/a.ts (reviewer)",
        "- [NAMING-1] matched by **",
        "- [API-1] matched by src/api/**",
        "disabled: OLD-1",
        "",
      ].join("\n"),
    );
  });

  it("rules explain leaves out a rule of a stage the role does not read", async () => {
    const store = repository();
    store.write(
      `${RULES}/E2E-1.md`,
      ruleFile("E2E-1", { paths: ["tests/e2e/**"], stages: ["plan", "execute", "review"] }),
    );
    const explain = (role: string) =>
      run(store, ["rules", "explain", "tests/e2e/login.spec.ts", "--role", role, "--json"]);
    expect((await explain("reviewer")).json).toMatchObject({
      rules: [{ id: "E2E-1", matchedBy: "tests/e2e/**" }],
    });
    expect((await explain("design-verifier")).json).toMatchObject({ rules: [] });
  });

  it("rules explain says no rule applies when no glob matches the file", async () => {
    const store = repository();
    store.write(`${RULES}/API-1.md`, ruleFile("API-1", { paths: ["src/api/**"] }));
    store.write(`${ROOT}/src/a.ts`, "");
    const result = await run(store, ["rules", "explain", "src/a.ts"]);
    expect(result.stdout).toBe("src/a.ts (implementer)\nNo rule applies.\n");
  });
});
