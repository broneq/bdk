import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// The BDK OpenSpec schema (spec `bdk-openspec-schema`, design D7 and D8 of v3-180) run through the
// pinned OpenSpec CLI in a temporary project, the way `/bdk:setup` installs it: a copy of the
// shipped directory into `openspec/schemas/bdk/`. A bump of `@fission-ai/openspec` that breaks
// project schemas fails here.

const PLUGIN = join(import.meta.dirname, "..");
const SCHEMA = join(PLUGIN, "openspec", "schemas", "bdk");
const OPENSPEC = join(PLUGIN, "node_modules", "@fission-ai", "openspec");
const PINNED = "1.13.2";
const CHANGE = "demo";

let root: string;
let project: string;
let env: NodeJS.ProcessEnv;

function openspec(...args: string[]): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [join(OPENSPEC, "bin", "openspec.js"), ...args], {
    cwd: project,
    env,
    encoding: "utf8",
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function ok(...args: string[]): string {
  const result = openspec(...args);
  expect(result.status, `openspec ${args.join(" ")}\n${result.stdout}${result.stderr}`).toBe(0);
  return result.stdout;
}

function json(...args: string[]): unknown {
  return JSON.parse(ok(...args));
}

function write(path: string, text: string): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, text);
}

interface Status {
  schemaName: string;
  artifacts: { id: string; outputPath: string; status: string; requires: string[] }[];
}

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "bdk-openspec-schema-"));
  project = join(root, "project");
  env = {
    PATH: process.env.PATH,
    HOME: join(root, "home"),
    XDG_CONFIG_HOME: join(root, "config"),
    XDG_DATA_HOME: join(root, "data"),
    OPENSPEC_TELEMETRY: "0",
    DO_NOT_TRACK: "1",
    NO_COLOR: "1",
  };
  mkdirSync(join(project, "openspec", "changes"), { recursive: true });
  mkdirSync(join(project, "openspec", "specs"), { recursive: true });
  write(join(project, "openspec", "config.yaml"), "schema: bdk\n");
  if (existsSync(SCHEMA)) {
    cpSync(SCHEMA, join(project, "openspec", "schemas", "bdk"), { recursive: true });
  }
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("shipped files", () => {
  it("runs the pinned OpenSpec version from the workspace", () => {
    const pkg = JSON.parse(readFileSync(join(OPENSPEC, "package.json"), "utf8")) as {
      version: string;
    };
    expect(pkg.version).toBe(PINNED);
    expect(ok("--version").trim()).toBe(PINNED);
  });

  it("gives every artifact a description, a template file and an instruction, and has no apply section", () => {
    const schema = readFileSync(join(SCHEMA, "schema.yaml"), "utf8");
    const templates = [...schema.matchAll(/^ {4}template: (\S+)$/gm)].map((match) => match[1]);
    expect(templates).toEqual(["proposal.md", "spec.md", "design.md", "part.md"]);
    for (const template of templates) {
      expect(existsSync(join(SCHEMA, "templates", template ?? ""))).toBe(true);
    }
    expect(schema.match(/^ {4}description: \S/gm)).toHaveLength(4);
    expect(schema.match(/^ {4}instruction: \|$/gm)).toHaveLength(4);
    expect(schema).not.toMatch(/^apply:/m);
    expect(schema).not.toMatch(/tracks:/);
  });

  it("starts the part template with the part frontmatter", () => {
    const part = readFileSync(join(SCHEMA, "templates", "part.md"), "utf8");
    const frontmatter = /^---\n([\s\S]*?)\n---\n/.exec(part)?.[1] ?? "";
    expect(frontmatter).toMatch(/^id: "\d\d"$/m);
    expect(frontmatter).toMatch(/^depends-on: \[.*\]$/m);
    expect(frontmatter).toMatch(/^isolation: (worktree|shared)$/m);
    expect(frontmatter).toMatch(/^files:$/m);
    expect([...frontmatter.matchAll(/^(\S[^:]*):/gm)].map((match) => match[1])).toEqual([
      "id",
      "depends-on",
      "isolation",
      "files",
    ]);
  });

  it("shows the task contract lines in the part template and the plan instruction", () => {
    const part = readFileSync(join(SCHEMA, "templates", "part.md"), "utf8");
    const tasks = /^## Tasks$([\s\S]*)/m.exec(part)?.[1] ?? "";
    expect(tasks).toMatch(/^1\. .+\n {3}- File: .+\n {3}- Interface: .+\n {3}- Verified by: .+$/m);
    const schema = readFileSync(join(SCHEMA, "schema.yaml"), "utf8");
    for (const label of ["`File:`", "`Interface:`", "`Verified by:`"])
      expect(schema).toContain(label);
  });
});

describe("installed by copying", () => {
  it("resolves from the project and validates", () => {
    expect(ok("schema", "which", "bdk")).toMatch(/Source: project/);
    expect(ok("schema", "validate", "bdk")).toMatch(/is valid/);
  });
});

describe("a Change made with the schema", () => {
  const dir = (): string => join(project, "openspec", "changes", CHANGE);

  it("is created and lists its artifacts in stage order", () => {
    ok("new", "change", CHANGE, "--schema", "bdk");
    const status = json("status", "--change", CHANGE, "--json") as Status;
    expect(status.schemaName).toBe("bdk");
    expect(
      status.artifacts.map(({ id, outputPath, status: state, requires }) => ({
        id,
        outputPath,
        state,
        requires,
      })),
    ).toEqual([
      { id: "proposal", outputPath: "proposal.md", state: "ready", requires: [] },
      { id: "specs", outputPath: "specs/**/*.md", state: "blocked", requires: ["proposal"] },
      { id: "design", outputPath: "design.md", state: "blocked", requires: ["specs"] },
      {
        id: "plan",
        outputPath: "plan/parts/*.md",
        state: "blocked",
        requires: ["specs", "design"],
      },
    ]);
  });

  it("gives the plan instruction and the part template of the schema", () => {
    const instructions = json("instructions", "plan", "--change", CHANGE, "--json") as {
      instruction: string;
      template: string;
    };
    expect(instructions.template).toBe(readFileSync(join(SCHEMA, "templates", "part.md"), "utf8"));
    expect(instructions.instruction).toMatch(/plan\/parts\/NN\.md/);
  });

  it("is complete and valid with one part", () => {
    write(
      join(dir(), "proposal.md"),
      [
        "# Proposal",
        "",
        "## Why",
        "",
        "Users want a greeting when the program starts.",
        "",
        "## What Changes",
        "",
        "- The program prints a greeting on start.",
        "",
        "## Capabilities",
        "",
        "### New Capabilities",
        "",
        "- `greeting`: the start-up greeting.",
        "",
        "## Impact",
        "",
        "- `src/main.ts`",
        "",
      ].join("\n"),
    );
    write(
      join(dir(), "specs", "greeting", "spec.md"),
      [
        "# Spec Delta",
        "",
        "## Purpose",
        "",
        "Greets the user with a short message every time the program starts.",
        "",
        "## ADDED Requirements",
        "",
        "### Requirement: Greeting on start",
        "",
        "The program SHALL print `hello` when it starts.",
        "",
        "#### Scenario: Start",
        "",
        "- **WHEN** the program starts",
        "- **THEN** it prints `hello`",
        "",
      ].join("\n"),
    );
    write(join(dir(), "design.md"), "# Design\n\n## Decisions\n\n### D1. Print in main\n");
    write(
      join(dir(), "plan", "parts", "01.md"),
      [
        "---",
        'id: "01"',
        "depends-on: []",
        "isolation: worktree",
        "files:",
        "  - src/main.ts",
        "---",
        "",
        "# Part 01: Greeting",
        "",
      ].join("\n"),
    );

    const status = json("status", "--change", CHANGE, "--json") as Status;
    expect(status.artifacts.map(({ id, status: state }) => [id, state])).toEqual([
      ["proposal", "done"],
      ["specs", "done"],
      ["design", "done"],
      ["plan", "done"],
    ]);
    ok("validate", CHANGE, "--strict");
  });

  it("archives with no task checklist and merges its spec delta", () => {
    const output = ok("archive", CHANGE, "--yes");
    expect(output).toMatch(/No tasks/);
    const spec = readFileSync(join(project, "openspec", "specs", "greeting", "spec.md"), "utf8");
    expect(spec).toContain("### Requirement: Greeting on start");
    expect(spec).toContain("#### Scenario: Start");
    expect(spec).toContain("Greets the user with a short message every time the program starts.");
    expect(existsSync(dir())).toBe(false);
    const archived = join(project, "openspec", "changes", "archive");
    const [entry] = spawnSync("ls", [archived], { encoding: "utf8" }).stdout.trim().split("\n");
    for (const path of ["proposal.md", "specs/greeting/spec.md", "design.md", "plan/parts/01.md"]) {
      expect(existsSync(join(archived, entry ?? "", path)), path).toBe(true);
    }
  });
});
