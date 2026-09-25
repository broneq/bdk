import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { main } from "./main.ts";
import { skill, tree } from "./testing.ts";

async function cli(cwd: string, args: string[]) {
  let stdout = "";
  let stderr = "";
  const code = await main(args, {
    cwd,
    env: {},
    stdout: (s) => (stdout += s),
    stderr: (s) => (stderr += s),
  });
  return { code, stdout, stderr };
}

const plugin = `export default { name: "t", rules: [
  { id: "bad-word", kinds: ["skills"], defaultSeverity: "error",
    check(doc, ctx) { doc.lines.forEach((l, i) => { if (l.includes("BAD")) ctx.report({ line: i + 1, message: "no BAD", match: l }); }); } },
] };`;

function project(files: Record<string, string>, baseline = ""): string {
  return tree({
    "skill-check.config.mjs": `import t from "./t.mjs"; export default { targets: [{ kind: "skills", dirs: ["skills"] }], plugins: [t]${baseline} };`,
    "t.mjs": plugin,
    ...files,
  });
}

const write = (root: string, file: string, text: string) => {
  writeFileSync(join(root, file), text);
};
const entries = (root: string, file = "baseline.json") =>
  JSON.parse(readFileSync(join(root, file), "utf8")) as { rule: string; file: string }[];
const B = ["--baseline", "baseline.json"];

describe("baseline", () => {
  it("--baseline-init writes every current finding, and the next run suppresses them", async () => {
    const root = project({
      "skills/alpha/SKILL.md": skill("alpha", "", "BAD one\n"),
      "skills/beta/SKILL.md": skill("beta", "", "BAD two\n"),
    });
    const init = await cli(root, [...B, "--baseline-init"]);
    expect(init).toEqual({
      code: 0,
      stdout: "",
      stderr: "skill-check: wrote 2 entries to baseline.json\n",
    });
    expect(entries(root).map((e) => Object.keys(e).join())).toEqual([
      "rule,file,fingerprint",
      "rule,file,fingerprint",
    ]);
    expect(entries(root).map((e) => [e.rule, e.file])).toEqual([
      ["t/bad-word", "skills/alpha/SKILL.md"],
      ["t/bad-word", "skills/beta/SKILL.md"],
    ]);
    expect(await cli(root, B)).toEqual({
      code: 0,
      stdout: "No findings in 2 files (2 baselined findings).\n",
      stderr: "",
    });
  });

  it("reads the baseline path from the config", async () => {
    const root = project(
      { "skills/alpha/SKILL.md": skill("alpha", "", "BAD\n") },
      `, baseline: "known.json"`,
    );
    expect((await cli(root, ["--baseline-init"])).code).toBe(0);
    expect(entries(root, "known.json")).toHaveLength(1);
    expect((await cli(root, [])).code).toBe(0);
  });

  it("keeps a finding suppressed when lines are inserted above it", async () => {
    const root = project({ "skills/alpha/SKILL.md": skill("alpha", "", "BAD\n") });
    await cli(root, [...B, "--baseline-init"]);
    write(root, "skills/alpha/SKILL.md", skill("alpha", "", "New intro.\n\nMore text.\n\nBAD\n"));
    expect((await cli(root, B)).code).toBe(0);
  });

  it("reports a new finding in a baselined file", async () => {
    const root = project({ "skills/alpha/SKILL.md": skill("alpha", "", "BAD old\n") });
    await cli(root, [...B, "--baseline-init"]);
    write(root, "skills/alpha/SKILL.md", skill("alpha", "", "BAD old\nBAD new\n"));
    const out = await cli(root, B);
    expect(out.code).toBe(1);
    expect(out.stdout).toBe(
      "skills/alpha/SKILL.md:7  error  t/bad-word  no BAD\n\n1 error, 0 warnings in 1 file, 1 baselined finding suppressed.\n",
    );
  });

  it("suppresses one finding per entry when identical findings repeat", async () => {
    const root = project({ "skills/alpha/SKILL.md": skill("alpha", "", "BAD\n") });
    await cli(root, [...B, "--baseline-init"]);
    write(root, "skills/alpha/SKILL.md", skill("alpha", "", "BAD\nBAD\n"));
    const out = await cli(root, [...B, "--json"]);
    const json = JSON.parse(out.stdout) as { findings: { line: number }[] };
    expect(json.findings.map((f) => f.line)).toEqual([7]);
  });

  it("reports an entry that matches no finding as baseline-stale, exit 1", async () => {
    const root = project({ "skills/alpha/SKILL.md": skill("alpha", "", "BAD\n") });
    await cli(root, [...B, "--baseline-init"]);
    write(root, "skills/alpha/SKILL.md", skill("alpha", "", "Fixed.\n"));
    const out = await cli(root, [...B, "--json"]);
    expect(out.code).toBe(1);
    expect(JSON.parse(out.stdout)).toMatchObject({
      findings: [
        {
          rule: "baseline-stale",
          severity: "error",
          file: "skills/alpha/SKILL.md",
          line: 1,
          message:
            "the baseline entry for `t/bad-word` matches no finding; remove it with --baseline-prune",
        },
      ],
      baseline: { suppressed: 0, stale: 1 },
      summary: { errors: 1, warnings: 0 },
    });
  });

  it("--baseline-prune drops stale entries and never adds new ones", async () => {
    const root = project({
      "skills/alpha/SKILL.md": skill("alpha", "", "BAD\n"),
      "skills/beta/SKILL.md": skill("beta", "", "BAD\n"),
    });
    await cli(root, [...B, "--baseline-init"]);
    write(root, "skills/alpha/SKILL.md", skill("alpha", "", "Fixed.\n"));
    write(root, "skills/beta/SKILL.md", skill("beta", "", "BAD\nBAD new\n"));
    const out = await cli(root, [...B, "--baseline-prune"]);
    expect(entries(root).map((e) => e.file)).toEqual(["skills/beta/SKILL.md"]);
    expect(out.stderr).toBe("skill-check: pruned 1 stale entry from baseline.json\n");
    expect(out.code).toBe(1);
    expect(out.stdout).toContain("skills/beta/SKILL.md:7  error  t/bad-word  no BAD");
    expect(out.stdout).not.toContain("baseline-stale");
  });

  it("does not call entries outside the path arguments stale", async () => {
    const root = project({
      "skills/alpha/SKILL.md": skill("alpha", "", "BAD\n"),
      "skills/beta/SKILL.md": skill("beta"),
    });
    await cli(root, [...B, "--baseline-init"]);
    expect((await cli(root, [...B, "skills/beta"])).code).toBe(0);
  });

  it.each([
    [
      "an existing file on --baseline-init",
      ["--baseline-init"],
      "baseline `baseline.json` already exists; shrink it with --baseline-prune instead",
    ],
    [
      "--baseline-init with path arguments",
      ["--baseline-init", "skills/alpha"],
      "--baseline-init and --baseline-prune check the whole tree; drop the path arguments",
    ],
    [
      "--baseline-init together with --baseline-prune",
      ["--baseline-init", "--baseline-prune"],
      "--baseline-init and --baseline-prune cannot be combined",
    ],
  ])("refuses %s with exit 2", async (_what, args, message) => {
    const root = project({ "skills/alpha/SKILL.md": skill("alpha") });
    write(root, "baseline.json", "[]\n");
    expect(await cli(root, [...B, ...args])).toEqual({
      code: 2,
      stdout: "",
      stderr: `skill-check: ${message}\n`,
    });
    expect(readFileSync(join(root, "baseline.json"), "utf8")).toBe("[]\n");
  });

  it.each([
    [
      "no baseline path",
      null,
      ["--baseline-init"],
      "--baseline-init needs a baseline file: set `baseline` in the config or pass --baseline",
    ],
    [
      "a missing baseline file",
      null,
      B,
      "baseline `baseline.json` does not exist; create it with --baseline-init",
    ],
    [
      "a baseline that is not JSON",
      "{",
      B,
      "baseline `baseline.json` must be a JSON array of { rule, file, fingerprint } entries",
    ],
    [
      "a baseline entry without a fingerprint",
      `[{ "rule": "t/bad-word", "file": "x" }]`,
      B,
      "baseline `baseline.json` must be a JSON array of { rule, file, fingerprint } entries",
    ],
  ])("fails with exit 2 on %s", async (_what, content, args, message) => {
    const root = project({ "skills/alpha/SKILL.md": skill("alpha") });
    if (content !== null) write(root, "baseline.json", content);
    expect(await cli(root, args)).toEqual({
      code: 2,
      stdout: "",
      stderr: `skill-check: ${message}\n`,
    });
    if (content === null) expect(existsSync(join(root, "baseline.json"))).toBe(false);
  });
});
