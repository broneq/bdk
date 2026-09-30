// The rules verbs that write or report on project rules (`kernel-cli/rules`;
// design D-6, D-8, D-9 of v3-t31) on a memory store with the in-memory index:
// `import`, `accept`, `prune` and the text mode of `explain` and `export`.
import { describe, expect, it } from "vitest";

import { AUTHOR, CHANGE, fakeGit, repository, ROOT, runBdk } from "../../log/tests/support.ts";
import type { FakeGit } from "../../log/tests/support.ts";
import { settingsRegistry } from "../../registrations.ts";
import { fixedClock } from "../../shared/clock/index.ts";
import { memoryIndex, writeDocument } from "../../shared/store/index.ts";
import type { Store } from "../../shared/store/index.ts";
import { rulesRegistrations } from "../index.ts";
import { rulesAcceptOutput, rulesImportOutput, rulesPruneOutput } from "../schema/outputs.ts";

const PLUGIN = "/plugin";
const RULES = `${ROOT}/.bdk/rules`;
const HOST = `${ROOT}/.claude/rules`;

function projectRule(id: string, extra = ""): string {
  return `---\nschema: 1\nid: ${id}\nkind: house\nseverity: medium\norigin: user\nsince: 2026-09-30\n${extra}---\n\nText of ${id}.\n`;
}

/** A git whose `ls-files` lists `files`; the rest answers as `fakeGit`. */
function gitListing(files: readonly string[]): FakeGit {
  const git = fakeGit();
  const run = git.run.bind(git);
  git.run = (args, cwd) =>
    args[0] === "ls-files"
      ? Promise.resolve({ code: 0, stdout: files.map((file) => `${file}\0`).join(""), stderr: "" })
      : run(args, cwd);
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

describe("rules import", () => {
  function hostRules(store: Store): void {
    store.write(
      `${HOST}/api.md`,
      '---\npaths: "src/api/**"\n---\n\n- Validate input.\n- Log ids.\n',
    );
    store.write(`${HOST}/naming.md`, "- Name things plainly.\n");
    store.write(`${HOST}/owned.md`, "---\nid: X-1\n---\n\n- Already a rule.\n");
    store.write(`${HOST}/empty.md`, "\n");
    store.write(`${HOST}/broken.md`, "---\npaths: [\n---\n\n- A rule.\n");
    store.write(`${HOST}/9.md`, "- No prefix from this name.\n");
  }

  it("writes one rule per bullet, applies from paths:, and skips what is no rule", async () => {
    const store = repository();
    hostRules(store);
    const result = await run(store, ["rules", "import", "--json"]);
    expect(result.code, result.stdout).toBe(0);
    const report = rulesImportOutput.parse(result.json);
    expect(report.imported).toStrictEqual([
      { from: ".claude/rules/api.md", rules: ["API-1", "API-2"], applies: ["src/api/**"] },
      { from: ".claude/rules/naming.md", rules: ["NAMING-1"] },
    ]);
    expect(report.skipped.map((file) => [file.from, file.why.split(":")[0]])).toStrictEqual([
      [".claude/rules/9.md", "no project prefix from 9.md; rerun with --prefix"],
      [".claude/rules/broken.md", "unreadable frontmatter"],
      [".claude/rules/empty.md", "empty"],
      [".claude/rules/owned.md", "already carries an id"],
    ]);
    expect(report.projection.length).toBeGreaterThan(0);
    expect(store.read(`${RULES}/API-2.md`)).toContain("Log ids.");
    expect(store.read(`${RULES}/API-1.md`)).toContain("origin: import");
  });

  it("numbers after the prefix's highest file, a tombstone included", async () => {
    const store = repository();
    store.write(`${RULES}/API-1.md`, projectRule("API-1"));
    store.write(
      `${RULES}/API-4.md`,
      "---\nschema: 1\nid: API-4\nremoved: merged into API-1\n---\n",
    );
    store.write(`${HOST}/api.md`, "- Validate input.\n");
    const result = await run(store, ["rules", "import", "--json"]);
    expect(rulesImportOutput.parse(result.json).imported[0]?.rules).toStrictEqual(["API-5"]);
  });

  it("prints what it would import on --dry-run and writes nothing", async () => {
    const store = repository();
    store.write(`${HOST}/api.md`, "- Validate input.\n");
    const result = await run(store, ["rules", "import", "--dry-run"]);
    expect(result.code, result.stdout).toBe(0);
    expect(result.stdout).toBe("would import .claude/rules/api.md: API-1\n");
    expect(store.exists(`${RULES}/API-1.md`)).toBe(false);
  });

  it("prints the imports, the skips, the projection and the removal hint", async () => {
    const store = repository();
    store.write(`${HOST}/api.md`, '---\npaths: ["src/**"]\n---\n\n- Validate input.\n');
    store.write(`${HOST}/empty.md`, "\n");
    const lines = (await run(store, ["rules", "import"])).stdout.split("\n");
    expect(lines[0]).toBe("imported .claude/rules/api.md: API-1 (applies: src/**)");
    expect(lines[1]).toBe("skipped .claude/rules/empty.md: empty");
    expect(lines.filter((line) => line.startsWith("regenerated "))).not.toHaveLength(0);
    expect(lines).toContain(
      "Remove the imported files: the generated projection now carries their rules.",
    );
  });

  it("imports one file under --prefix", async () => {
    const store = repository();
    store.write(`${ROOT}/docs/style.md`, "- Keep lines short.\n");
    const result = await run(store, ["rules", "import", "docs/style.md", "--prefix", "STYLE"]);
    expect(result.stdout.split("\n")[0]).toBe("imported docs/style.md: STYLE-1");
  });

  it("says so when there is nothing to import", async () => {
    const store = repository();
    store.write(`${HOST}/.keep`, "");
    expect((await run(store, ["rules", "import"])).stdout).toBe("Nothing to import.\n");
  });

  it("refuses a missing directory, a BDK prefix and --prefix over several files", async () => {
    const store = repository();
    refusedWith(await run(store, ["rules", "import", "nope/"]), 3, "input/not-found");
    store.write(`${HOST}/a.md`, "- One.\n");
    store.write(`${HOST}/b.md`, "- Two.\n");
    refusedWith(
      await run(store, ["rules", "import", ".claude/rules/a.md", "--prefix", "BDK"]),
      2,
      "policy/rule-format",
    );
    refusedWith(
      await run(store, ["rules", "import", "--prefix", "API"]),
      3,
      "input/invalid-argument",
    );
  });

  it("refuses while the prefix already holds a duplicate id, writing nothing", async () => {
    const store = repository();
    store.write(`${RULES}/API-1.md`, projectRule("API-1"));
    store.write(`${RULES}/api-copy.md`, projectRule("API-1"));
    store.write(`${HOST}/api.md`, "- Validate input.\n");
    refusedWith(await run(store, ["rules", "import"]), 2, "policy/duplicate-rule-id");
    expect(store.exists(`${RULES}/API-2.md`)).toBe(false);
  });
});

describe("rules accept", () => {
  it("writes the next number with origin user and regenerates the projection", async () => {
    const store = repository();
    store.write(`${RULES}/API-2.md`, projectRule("API-2"));
    const result = await run(store, [
      "rules",
      "accept",
      "Validate every request body.",
      "--prefix",
      "API",
      "--applies",
      "src/api/**",
      "--role",
      "reviewer",
      "--severity",
      "high",
      "--json",
    ]);
    expect(result.code, result.stdout).toBe(0);
    const report = rulesAcceptOutput.parse(result.json);
    expect(report).toMatchObject({ id: "API-3", path: ".bdk/rules/API-3.md", origin: "user" });
    expect(report.projection.length).toBeGreaterThan(0);
    const text = store.read(`${RULES}/API-3.md`) ?? "";
    expect(text).toContain("severity: high");
    expect(text).toContain("since: 2026-09-30");
    expect(text).toContain("Validate every request body.");
  });

  it("reads the text from stdin and prints the adoption", async () => {
    const store = repository();
    const result = await run(store, ["rules", "accept", "-", "--prefix", "API"], {
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
    ["no --prefix", ["Text."], 3, "input/missing-argument"],
    ["an empty text", [" ", "--prefix", "API"], 3, "input/invalid-argument"],
    ["the BDK prefix", ["Text.", "--prefix", "BDK"], 2, "policy/rule-format"],
    [
      "knowledge without a source",
      ["Text.", "--prefix", "API", "--kind", "knowledge"],
      2,
      "policy/rule-format",
    ],
    ["house with a source", ["Text.", "--prefix", "API", "--source", "x"], 2, "policy/rule-format"],
    [
      "a malformed --from",
      ["Text.", "--prefix", "API", "--from", "L-1"],
      3,
      "input/invalid-argument",
    ],
    [
      "an invalid verified date",
      [
        "Text.",
        "--prefix",
        "API",
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
        "--from",
        `${CHANGE}/A-00000001`,
      ]),
      3,
      "input/not-found",
    );
  });

  it("refuses while the prefix already holds a duplicate id", async () => {
    const store = repository();
    store.write(`${RULES}/API-1.md`, projectRule("API-1"));
    store.write(`${RULES}/api-copy.md`, projectRule("API-1"));
    refusedWith(
      await run(store, ["rules", "accept", "Text.", "--prefix", "API"]),
      2,
      "policy/duplicate-rule-id",
    );
  });
});

describe("rules prune", () => {
  it("reports a glob that matches no file, and uncited rules once the window is full", async () => {
    const store = repository();
    store.write(`${RULES}/API-1.md`, projectRule("API-1", "applies: [legacy/**]\n"));
    store.write(`${RULES}/API-2.md`, projectRule("API-2", "applies: [src/**]\n"));
    store.write(`${RULES}/OLD-1.md`, projectRule("OLD-1", "applies: [gone/**]\n"));
    store.write(`${ROOT}/.bdk/settings.yaml`, "rules:\n  disabled: [OLD-1]\n");
    const git = gitListing(["src/a.ts"]);

    const counted = await run(store, ["rules", "prune", "--json"], { git });
    expect(counted.code, counted.stdout).toBe(0);
    expect(rulesPruneOutput.parse(counted.json).items).toStrictEqual([
      { id: "API-1", reason: "no-match", detail: 'applies: ["legacy/**"] matches 0 files' },
    ]);

    const windowed = await run(store, ["rules", "prune", "--uncited", "1"], { git });
    expect(windowed.stdout).toBe(
      [
        'API-1 no-match: applies: ["legacy/**"] matches 0 files',
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
    store.write(`${RULES}/API-1.md`, projectRule("API-1", "applies: [src/api/**]\n"));
    store.write(`${RULES}/NAMING-1.md`, projectRule("NAMING-1"));
    store.write(`${RULES}/OLD-1.md`, projectRule("OLD-1"));
    store.write(`${ROOT}/.bdk/settings.yaml`, "rules:\n  disabled: [OLD-1]\n");
    store.write(`${ROOT}/src/api/a.ts`, "");
    const result = await run(store, ["rules", "explain", "src/api/a.ts", "--role", "reviewer"]);
    expect(result.stdout).toBe(
      [
        "src/api/a.ts (reviewer)",
        "- [NAMING-1] global",
        "- [API-1] matched by src/api/**",
        "disabled: OLD-1",
        "",
      ].join("\n"),
    );
  });

  it("rules explain says no rule applies when no glob matches the file", async () => {
    const store = repository();
    store.write(`${RULES}/API-1.md`, projectRule("API-1", "applies: [src/api/**]\n"));
    store.write(`${ROOT}/src/a.ts`, "");
    const result = await run(store, ["rules", "explain", "src/a.ts"]);
    expect(result.stdout).toBe("src/a.ts (implementer)\nNo rule applies.\n");
  });

  it("rules export --claude lists each projection file and whether it changed", async () => {
    const store = repository();
    store.write(`${RULES}/API-1.md`, projectRule("API-1", "applies: [src/api/**]\n"));
    const first = await run(store, ["rules", "export", "--claude"]);
    expect(first.code, first.stdout).toBe(0);
    expect(first.stdout).toMatch(/: 1 rules, changed\n$/);
    const again = await run(store, ["rules", "export", "--claude"]);
    expect(again.stdout).toMatch(/: 1 rules\n$/);
  });
});
