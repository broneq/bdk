// `kernel-cli/service` through the committed bundle: every exit code and rule
// the three records declare, the scenarios of the spec, the JSON Schemas.
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createFixture } from "../../../tests/support/fixture.ts";
import type { Fixture } from "../../../tests/support/fixture.ts";
import { runBdk } from "../../../tests/support/run.ts";
import { answered, bdk, git, refused, repository } from "../../../tests/support/repo.ts";
import { validatorFor } from "../../../tests/support/schemas.ts";
import { fileStore } from "../../shared/store/index.ts";

const validVersion = validatorFor("common/version.json");
const validDoctor = validatorFor("output/doctor.json");

const fixtures: Fixture[] = [];
function fixture(...args: Parameters<typeof createFixture>): Fixture {
  const created = createFixture(...args);
  fixtures.push(created);
  return created;
}
afterEach(() => {
  for (const created of fixtures.splice(0)) created.remove();
});

describe("bdk version", () => {
  it("exit 0: the example run validates against common/version.json", () => {
    const result = runBdk(["version", "--json"], fixture().root);
    expect(result.code).toBe(0);
    expect(validVersion(result.json), JSON.stringify(validVersion.errors)).toBe(true);
    expect(result.json).toMatchObject({ contract: 3, node: process.versions.node });
  });

  it("exit 0: prints the text form outside any work tree", () => {
    const result = runBdk(["version"], fixture({ git: false }).root);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe(
      `bdk ${(runBdk(["version", "--json"], fixture().root).json as { kernel: string }).kernel} (contract 3, node ${process.versions.node})\n`,
    );
  });

  it("exit 3: input/unknown-flag", () => {
    const result = runBdk(["version", "--bogus", "--json"], fixture().root);
    expect(result.code).toBe(3);
    expect(result.json).toMatchObject({ rule: "input/unknown-flag" });
  });

  it("exit 3: input/invalid-argument", () => {
    const result = runBdk(["version", "extra", "--json"], fixture().root);
    expect(result.code).toBe(3);
    expect(result.json).toMatchObject({ rule: "input/invalid-argument" });
  });
});

describe("bdk doctor", () => {
  it("exit 0: a healthy project is ok with no findings", () => {
    const result = runBdk(["doctor", "--json"], fixture({ files: { ".bdk/": "" } }).root);
    expect(result.code).toBe(0);
    expect(validDoctor(result.json), JSON.stringify(validDoctor.errors)).toBe(true);
    expect(result.json).toMatchObject({ ok: true, layout: "v3", findings: [] });
  });

  it("exit 0: the v2 layout is a warn finding repaired by /bdk:setup", () => {
    const root = fixture({ files: { ".bdk/settings.json": "{}", ".bdk/plans/": "" } }).root;
    const result = runBdk(["doctor", "--json"], root);
    expect(result.code).toBe(0);
    expect(validDoctor(result.json), JSON.stringify(validDoctor.errors)).toBe(true);
    expect(result.json).toMatchObject({
      ok: false,
      layout: "v2",
      findings: [
        {
          id: "v2-layout",
          level: "warn",
          summary: ".bdk/settings.json and .bdk/plans/ found",
          repair: "/bdk:setup",
        },
      ],
    });
  });

  it("exit 0: --fix is accepted and the text form lists the findings", () => {
    const root = fixture({ files: { ".bdk/runs/": "" } }).root;
    const result = runBdk(["doctor", "--fix"], root);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("warn v2-layout: .bdk/runs/ found\n  repair: /bdk:setup\n");
  });

  it("exit 0: a settings file without modeline is a schema-modeline finding", () => {
    const root = fixture({ files: { ".bdk/settings.yaml": "languages: [go]\n" } }).root;
    const result = runBdk(["doctor", "--json"], root);
    expect(result.code).toBe(0);
    expect(validDoctor(result.json), JSON.stringify(validDoctor.errors)).toBe(true);
    expect(result.json).toMatchObject({ ok: false });
    expect((result.json as { findings: unknown[] }).findings).toContainEqual({
      id: "schema-modeline",
      level: "warn",
      summary: expect.stringContaining(".bdk/settings.yaml") as unknown,
      repair: "bdk doctor --fix",
    });
  });

  it("exit 0: --fix repairs the schema findings", () => {
    const content = "# mine\nlanguages: [go]\n";
    const root = fixture({ files: { ".bdk/settings.yaml": content } }).root;
    const result = runBdk(["doctor", "--fix", "--json"], root);
    expect(result.code).toBe(0);
    expect(result.json).toMatchObject({ ok: true, findings: [] });
    const url = (runBdk(["config", "schema", "--url", "--json"], root).json as { url: string }).url;
    expect(readFileSync(join(root, ".bdk/settings.yaml"), "utf8")).toBe(
      `# yaml-language-server: $schema=${url}\n${content}`,
    );
    const schema = (runBdk(["config", "schema", "--json"], root).json as { schema: unknown })
      .schema;
    expect(
      JSON.parse(readFileSync(join(root, ".bdk/.machine/schema/settings.json"), "utf8")),
    ).toStrictEqual(schema);
  });

  it("names no uv, uvx or MCP server on a machine without them", () => {
    const result = runBdk(["doctor", "--json"], fixture().root, { env: { PATH: "" } });
    expect(result.code).toBe(0);
    expect(result.stdout).not.toMatch(/\buvx?\b|mcp/i);
  });

  it("exit 3: input/unknown-flag", () => {
    const result = runBdk(["doctor", "--bogus", "--json"], fixture().root);
    expect(result.code).toBe(3);
    expect(result.json).toMatchObject({ rule: "input/unknown-flag" });
  });

  it("exit 5: runtime/not-a-repo outside a work tree", () => {
    const result = runBdk(["doctor", "--json"], fixture({ git: false }).root);
    expect(result.code).toBe(5);
    expect(result.json).toMatchObject({ rule: "runtime/not-a-repo" });
  });

  it("policy/merge-hash-mismatch: never refuses, reports the merge-hash finding", () => {
    const { root } = fixture();
    const spec = ".bdk/specs/auth/login/spec.md";
    fileStore().write(
      join(root, spec),
      `---\nbdk-merge-hash: sha256:${"0".repeat(64)}\n---\n# auth/login Specification\n`,
    );
    const result = runBdk(["doctor", "--json"], root);
    expect(result.code).toBe(0);
    expect(result.json).toMatchObject({
      ok: false,
      findings: [expect.objectContaining({ id: "merge-hash", level: "fail" })],
    });
    expect(JSON.stringify(result.json)).toContain(spec);
  });

  it("exit 0: a hand-written rule file without an id is a rule-without-id finding", () => {
    const root = fixture({ files: { ".claude/rules/naming.md": "- Name things well.\n" } }).root;
    const result = runBdk(["doctor", "--json"], root);
    expect(result.code).toBe(0);
    expect(validDoctor(result.json), JSON.stringify(validDoctor.errors)).toBe(true);
    expect(result.json).toMatchObject({ ok: false });
    expect((result.json as { findings: unknown[] }).findings).toContainEqual({
      id: "rule-without-id",
      level: "warn",
      summary: ".claude/rules/naming.md holds rules without an id",
      repair: "bdk rules import",
    });
  });
});

/** A tiny Change with part 01 (tasks 01-1, 01-2) started; answers the root, the Change dir and id. */
function started(): { root: string; dir: string; id: string } {
  const root = repository();
  const result = bdk(
    ["change", "new", "Reject expired links", "--profile", "tiny", "--reason", "r", "--json"],
    root,
  );
  expect(result.code, result.stdout).toBe(0);
  const id = (result.json as { change: string }).change;
  const dir = join(root, ".bdk/changes", id);
  const tasks = ["01-1", "01-2"]
    .map(
      (task) =>
        `## ${task} Task ${task}\n\n**Files:**\n\n- \`src/${task}.ts\`\n\n**Verification:** none\n`,
    )
    .join("\n");
  fileStore().write(
    join(dir, "plan/parts/01-part.md"),
    `---\nschema: 1\nid: "01"\ntitle: Part 01\ngoal: g\nsuccess-measure: m\ndo-not-touch: []\ndepends-on: []\nspec-impact: none\n---\n${tasks}`,
  );
  answered(bdk(["done", "plan", "--json"], root), "output/done.json");
  answered(bdk(["part", "start", "01", "--json"], root), "output/part-start.json");
  return { root, dir, id };
}

function rebuild(root: string, ...flags: string[]) {
  return bdk(["rebuild", ...flags, "--json"], root);
}

describe("bdk rebuild", () => {
  it("exit 0: repairs a deleted index and a stale plan index; the lists answer as before", () => {
    const { root, dir } = started();
    answered(
      bdk(["attempt", "open", "task-redispatch", "01-1", "--json"], root),
      "output/attempt-open.json",
    );
    const lists = () =>
      [
        ["log", "list"],
        ["part", "list"],
        ["attempt", "list", "--for", "01"],
      ].map((argv) => bdk([...argv, "--json"], root).json);
    const before = lists();
    const index = readFileSync(join(dir, "plan/index.md"), "utf8");
    fileStore().write(join(dir, "plan/index.md"), "stale\n");
    rmSync(join(root, ".bdk/.machine/index.sqlite"));
    const report = answered(rebuild(root), "output/rebuild.json");
    expect(report).toMatchObject({
      changes: 1,
      attempts: 1,
      commits: 0,
      migrated: [],
      warnings: [],
    });
    expect(readFileSync(join(dir, "plan/index.md"), "utf8")).toBe(index);
    expect(lists()).toStrictEqual(before);
  });

  it("exit 0: a fresh clone rebuilds after change resume", () => {
    const { root, id } = started();
    git(root, "add", "--all");
    git(root, "commit", "--quiet", "-m", "work");
    const clone = realpathSync(mkdtempSync(join(tmpdir(), "bdk-clone-")));
    try {
      git(clone, "clone", "--quiet", root, ".");
      refused(rebuild(clone, "--all"), 2, "policy/no-active-change");
      answered(bdk(["change", "resume", id, "--json"], clone), "output/change-resume.json");
      expect(answered(rebuild(clone, "--all"), "output/rebuild.json")).toMatchObject({
        changes: 1,
      });
    } finally {
      rmSync(clone, { recursive: true, force: true });
    }
  });

  it("exit 4 state/trailer-mismatch: a BDK-Change commit without BDK-Part and BDK-Task", () => {
    const { root, dir, id } = started();
    git(root, "commit", "--quiet", "--allow-empty", "-m", "stray", "-m", `BDK-Change: ${id}`);
    const index = readFileSync(join(dir, "plan/index.md"), "utf8");
    fileStore().write(join(dir, "plan/index.md"), "stale\n");
    refused(rebuild(root), 4, "state/trailer-mismatch");
    expect(readFileSync(join(dir, "plan/index.md"), "utf8")).toBe(index);
  });

  it("exit 4 state/change-dir-missing", () => {
    const { root, dir } = started();
    rmSync(dir, { recursive: true });
    refused(rebuild(root), 4, "state/change-dir-missing");
  });

  it("exit 4 state/corrupted-index: the index path is a directory", () => {
    const { root } = started();
    const index = join(root, ".bdk/.machine/index.sqlite");
    rmSync(index, { force: true });
    mkdirSync(index);
    refused(rebuild(root), 4, "state/corrupted-index");
  });

  it("exit 4 state/ledger-invalid: a log file fails its schema", () => {
    const { root, dir } = started();
    fileStore().write(
      join(dir, "log/20260101T000000Z-finding-L-broken00.md"),
      "---\nschema: 1\n---\n",
    );
    refused(rebuild(root), 4, "state/ledger-invalid");
  });

  it("exit 2 policy/no-active-change", () => {
    refused(rebuild(repository()), 2, "policy/no-active-change");
  });

  it("exit 5 runtime/git-missing", () => {
    const { root } = started();
    refused(bdk(["rebuild", "--json"], root, { git: false }), 5, "runtime/git-missing");
  });
});
