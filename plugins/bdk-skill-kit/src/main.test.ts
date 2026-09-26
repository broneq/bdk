import { spawn, spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { main } from "./main.ts";
import { skill, tree } from "./test-helpers.ts";

interface Captured {
  code: number;
  stdout: string;
  stderr: string;
}

async function cli(
  cwd: string,
  args: string[],
  env: Record<string, string> = {},
): Promise<Captured> {
  let stdout = "";
  let stderr = "";
  const code = await main(args, {
    cwd,
    env,
    stdout: (s) => (stdout += s),
    stderr: (s) => (stderr += s),
  });
  return { code, stdout, stderr };
}

const rulePlugin = `export default { name: "t", rules: [
  { id: "bad-word", kinds: ["skills"], defaultSeverity: "error",
    check(doc, ctx) { doc.lines.forEach((l, i) => { if (l.includes("BAD")) ctx.report({ line: i + 1, message: "no BAD", match: l }); }); } },
  { id: "soft", kinds: ["skills"], defaultSeverity: "warning",
    check(doc, ctx) { if (doc.text.includes("SOFT")) ctx.report({ message: "soft" }); } },
] };`;

function project(files: Record<string, string> = {}): string {
  return tree({
    "skill-check.config.mjs": `import t from "./t.mjs"; export default { targets: [{ kind: "skills", dirs: ["skills"] }], plugins: [t] };`,
    "t.mjs": rulePlugin,
    "skills/alpha/SKILL.md": skill("alpha"),
    ...files,
  });
}

describe("main", () => {
  it("exits 0 on a clean tree and says so", async () => {
    const out = await cli(project(), []);
    expect(out).toEqual({ code: 0, stdout: "No findings in 1 file.\n", stderr: "" });
  });

  it("prints one line per finding and a summary, exit 1 on an error", async () => {
    const root = project({ "skills/beta/SKILL.md": skill("beta", "", "BAD\n") });
    const out = await cli(root, []);
    expect(out.code).toBe(1);
    expect(out.stdout).toBe(
      "skills/beta/SKILL.md:6  error  t/bad-word  no BAD\n\n1 error, 0 warnings in 2 files.\n",
    );
  });

  it("exits 0 when only warnings remain, 1 under --strict", async () => {
    const root = project({ "skills/beta/SKILL.md": skill("beta", "", "SOFT\n") });
    expect((await cli(root, [])).code).toBe(0);
    expect((await cli(root, ["--strict"])).code).toBe(1);
  });

  it("adds GitHub annotations when GITHUB_ACTIONS is set", async () => {
    const root = project({ "skills/beta/SKILL.md": skill("beta", "", "BAD\n") });
    const out = await cli(root, [], { GITHUB_ACTIONS: "true" });
    expect(out.stdout).toContain(
      "::error file=skills/beta/SKILL.md,line=6,title=t/bad-word::no BAD\n",
    );
  });

  it("prints only one JSON object with --json", async () => {
    const root = project({ "skills/beta/SKILL.md": skill("beta", "", "BAD\n") });
    const out = await cli(root, ["--json"], { GITHUB_ACTIONS: "true" });
    expect(out.code).toBe(1);
    const parsed = JSON.parse(out.stdout) as Record<string, unknown>;
    expect(Object.keys(parsed)).toEqual(["version", "findings", "baseline", "summary"]);
    expect(parsed.findings).toEqual([
      expect.objectContaining({
        rule: "t/bad-word",
        severity: "error",
        file: "skills/beta/SKILL.md",
        line: 6,
        message: "no BAD",
      }),
    ]);
    expect(parsed.baseline).toEqual({ suppressed: 0, stale: 0 });
    expect(parsed.summary).toEqual({ files: 2, errors: 1, warnings: 0 });
  });

  it("exits 2 with the reason on stderr on a config error", async () => {
    const root = tree({ "skill-check.config.mjs": "export default {};" });
    const out = await cli(root, []);
    expect(out).toEqual({
      code: 2,
      stdout: "",
      stderr: "skill-check: the config must export a default object with a `targets` array\n",
    });
  });

  it("exits 2 naming a rule enabled without the option it needs", async () => {
    const root = tree({
      "skill-check.config.mjs": `export default { targets: [{ kind: "skills", dirs: ["skills"] }], rules: { "block-allowed-tools": "error" } };`,
      "skills/alpha/SKILL.md": skill("alpha"),
    });
    expect(await cli(root, [])).toEqual({
      code: 2,
      stdout: "",
      stderr:
        "skill-check: rule `block-allowed-tools` in target `skills`: option `require` must list at least one `allowed-tools` entry\n",
    });
  });

  it("exits 2 on an unknown flag", async () => {
    const out = await cli(project(), ["--nope"]);
    expect(out.code).toBe(2);
    expect(out.stderr).toMatch(/^skill-check: Unknown option '--nope'/);
  });

  it("prints usage with --help", async () => {
    const out = await cli(project(), ["--help"]);
    expect(out.code).toBe(0);
    expect(out.stdout).toMatch(/^Usage: skill-check \[paths\.\.\.\] \[options\]/);
    expect(out.stdout).toContain("--portable");
  });

  it("lists enabled rules with --list-rules", async () => {
    const out = await cli(project(), ["--list-rules", "--json"]);
    expect(JSON.parse(out.stdout)).toContain("t/bad-word");
  });

  it("narrows per-file rules to path arguments", async () => {
    const root = project({ "skills/beta/SKILL.md": skill("beta", "", "BAD\n") });
    expect((await cli(root, ["skills/alpha"])).code).toBe(0);
  });

  it("applies the portable profile to every skills target with --portable", async () => {
    const root = tree({
      "skill-check.config.mjs": `export default { targets: [{ kind: "skills", dirs: ["skills"] }], plugins: [{ name: "p", rules: [
        { id: "profile", kinds: ["skills"], defaultSeverity: "error", check(doc, ctx) { ctx.report({ message: doc.target.profile }); } } ] }] };`,
      "skills/alpha/SKILL.md": skill("alpha"),
    });
    const out = await cli(root, ["--portable", "--json"]);
    const parsed = JSON.parse(out.stdout) as { findings: { message: string }[] };
    expect(parsed.findings.map((f) => f.message)).toEqual(["portable"]);
  });
});

describe("dist/skill-check.mjs", () => {
  const kit = join(import.meta.dirname, "..");
  const bin = join(kit, "dist", "skill-check.mjs");

  it("runs as a child process with a TypeScript config importing the library", () => {
    const root = tree({
      "skill-check.config.ts": `import { defineConfig } from "${join(kit, "dist", "index.mjs")}";
export default defineConfig({ targets: [{ kind: "skills", dirs: ["skills"] }] });`,
      "skills/alpha/SKILL.md": skill("alpha"),
    });
    const run = spawnSync(process.execPath, [bin, "--json"], { cwd: root, encoding: "utf8" });
    expect(run.stderr).toBe("");
    expect(run.status).toBe(0);
    expect((JSON.parse(run.stdout) as { summary: { files: number } }).summary.files).toBe(1);
  });

  it("exits quietly when the reader closes stdout early, as `| head` does", async () => {
    const child = spawn(process.execPath, [bin, "--help"], { stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.destroy();
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    const code = await new Promise<number | null>((done) => child.on("close", done));
    expect(stderr).toBe("");
    expect(code).toBe(0);
  });
});
