// Consistency tests for the kernel CLI contract: the OpenSpec main specs under
// openspec/specs/kernel-cli/ (cross-cutting rules in spec.md, one spec per
// command group in <group>/spec.md), openspec/specs/kernel-architecture/ and
// schema/cli/. Ported from the T10 `node --test` suite unchanged in substance;
// the kernel-specific contract checks live next to it in this directory.
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "vitest";

import { REPO_ROOT as ROOT } from "../support/run.ts";
import { backticked, requirement, tableFirstColumn } from "../support/specs.ts";

const SPECS_DIR = join(ROOT, "openspec", "specs");
const CLI_SPEC_DIR = join(SPECS_DIR, "kernel-cli");
const CORE_SPEC_PATH = join(CLI_SPEC_DIR, "spec.md");
const ARCH_SPEC_PATH = join(SPECS_DIR, "kernel-architecture", "spec.md");
const SCHEMA_DIR = join(ROOT, "schema", "cli");
const INDEX_PATH = join(SCHEMA_DIR, "commands.json");
const DESIGN_PATH = join(ROOT, "docs", "v3", "2026-09-23-0703-bdk-v3-change-centric-design.md");
const PLAN_PATH = join(ROOT, "docs", "V3-IMPLEMENTATION-PLAN.md");
const HOST_FACTS_PATH = join(ROOT, "docs", "HOST-FACTS.md");

// The raw index as the file holds it; the first test checks this shape. Arrays
// stay mutable in the type: `Array.isArray` narrows a readonly array to any[].
interface RawCommand {
  readonly id: string;
  readonly argv: string[];
  readonly availability: string;
  readonly mode: string;
  readonly slice: string;
  readonly owner: string;
  readonly changeScoped: boolean;
  readonly standalone?: boolean;
  readonly args: unknown[];
  readonly flags: { readonly name: string }[];
  readonly output: string;
  readonly exits: number[];
  readonly refusals: string[];
  readonly writes: string[];
}

interface RawIndex {
  readonly contract: number;
  readonly base: { readonly all: string[]; readonly changeScoped: string[] };
  readonly commands: RawCommand[];
}

type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };

const AVAILABILITY = new Set(["orchestrator", "agent", "hook", "read"]);
const MODES = new Set(["inject", "command", "guard"]);
const EXIT_CODES = new Set([0, 2, 3, 4, 5]);
const RULE_ID = /^(policy|guard|input|state|runtime|kernel)\/[a-z0-9-]+$/;
const COMMAND_ID = /^[a-z][a-z0-9-]*$/;
const OWNER = /^T\d\d$/;

// `bdk ...` mentions in the design and the plan that are not commands. Every
// entry needs a reason; the acceptance task reviews this list by hand.
const MENTION_ALLOWLIST = new Map([
  ["<args>", "placeholder for any invocation"],
  ["<group> --help", "placeholder in the R-13 authoring rule"],
  ["stage enter", "fallback rejected by HOST-FACTS upe-fires; never added"],
  ["stage enter <gate>", "same fallback, with its argument"],
  ["hooks stop", "removed by T02 decision Q-6; the Stop hook is not ported"],
  ["design done", "Approach B command; Approach B was rejected"],
  ["review open", "Approach B command; Approach B was rejected"],
  ["execute --wave N", "plan wording replaced by dispatch run (design D-9)"],
  ["run", "plan wording replaced by dispatch run (design D-9); /bdk:run is a skill"],
  [
    "stage",
    "the group of the stage enter fallback, in the design's pre-tool deny wording; never added",
  ],
  ["close", "design shorthand for change close in the V1-7 merge-hash paragraph"],
]);

function read(path: string): string {
  assert.ok(existsSync(path), `missing file: ${path}`);
  return readFileSync(path, "utf8");
}

function loadIndex(): RawIndex {
  const index = JSON.parse(read(INDEX_PATH)) as RawIndex;
  assert.ok(Array.isArray(index.commands), "commands.json must have a commands array");
  return index;
}

function loadCoreSpec(): string {
  return read(CORE_SPEC_PATH);
}

// The group specs, one per subdirectory of openspec/specs/kernel-cli/.
function loadGroupSpecs(): { group: string; text: string }[] {
  const groups = readdirSync(CLI_SPEC_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  assert.ok(groups.length > 0, "no group specs under openspec/specs/kernel-cli/");
  return groups.map((g) => ({ group: g, text: read(join(CLI_SPEC_DIR, g, "spec.md")) }));
}

// One requirement per command: `### Requirement: bdk <argv...>`; the id is the
// argv joined by "-", the join key to commands.json.
function commandRequirements(text: string): { id: string; heading: string; body: string }[] {
  const parts = text.split(/^### Requirement: /m).slice(1);
  return parts
    .filter((p) => p.startsWith("bdk "))
    .map((p) => {
      const heading = (p.split("\n")[0] ?? "").trim();
      return { id: heading.slice(4).split(/\s+/).join("-"), heading, body: p };
    });
}

function fencedBlocks(doc: string, infoString: string): string[] {
  const re = new RegExp(
    "^```" + infoString.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\n([\\s\\S]*?)^```",
    "gm",
  );
  return [...doc.matchAll(re)].map((m) => m[1] ?? "");
}

// The set of rules a command may emit: its own plus the common ones.
function rulesOf(index: RawIndex, c: RawCommand): Set<string> {
  const rules = new Set(c.refusals);
  if (c.standalone !== true) for (const r of index.base.all) rules.add(r);
  if (c.changeScoped) for (const r of index.base.changeScoped) rules.add(r);
  return rules;
}

const EXIT_OF_CLASS: Readonly<Record<string, number>> = {
  policy: 2,
  guard: 2,
  kernel: 2,
  input: 3,
  state: 4,
  runtime: 5,
};

function expectedExits(index: RawIndex, c: RawCommand): number[] {
  if (c.mode === "inject") return [0];
  if (c.mode === "guard") return [0, 2];
  const exits = new Set([0]);
  for (const r of rulesOf(index, c)) exits.add(EXIT_OF_CLASS[r.split("/")[0] ?? ""] ?? -1);
  return [...exits].sort((a, b) => a - b);
}

// Words of a `bdk ...` mention that name a command: placeholders (<x>, [x],
// --flag, *, N, digits) are dropped.
function commandWords(text: string): string[] {
  return text
    .replace(/<[^>]*>/g, " ")
    .split(/\s+/)
    .filter((w) => /^[a-z]/.test(w));
}

function collectRefs(node: Json, out: string[] = []): string[] {
  if (Array.isArray(node)) for (const n of node as readonly Json[]) collectRefs(n, out);
  else if (node !== null && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if (k === "$ref" && typeof v === "string") out.push(v);
      else collectRefs(v, out);
    }
  }
  return out;
}

function resolvePointer(schema: Json, fragment: string): Json | undefined {
  if (fragment === "" || fragment === "#") return schema;
  const parts = fragment.replace(/^#\//, "").split("/");
  let node: Json | undefined = schema;
  for (const p of parts) {
    const key = p.replace(/~1/g, "/").replace(/~0/g, "~");
    node =
      node !== null && typeof node === "object" && !Array.isArray(node)
        ? (node as Record<string, Json>)[key]
        : undefined;
    if (node === undefined) return undefined;
  }
  return node;
}

test("index: shape of every command record", () => {
  const index = loadIndex();
  assert.equal(index.contract, 3, "contract version is the kernel major, 3");
  assert.ok(index.commands.length > 0, "the index is empty");
  for (const key of ["all", "changeScoped"] as const) {
    assert.ok(
      Array.isArray(index.base[key]) && index.base[key].length > 0,
      `base.${key} must list the common rules`,
    );
    for (const r of index.base[key]) assert.match(r, RULE_ID, `base.${key}: rule id ${r}`);
  }
  assert.ok(
    index.base.changeScoped.includes("policy/no-active-change"),
    "Change-scoped commands share policy/no-active-change",
  );
  const ids = new Set();
  for (const c of index.commands) {
    assert.match(c.id, COMMAND_ID, `bad id ${c.id}`);
    assert.ok(!ids.has(c.id), `duplicate id ${c.id}`);
    ids.add(c.id);
    assert.ok(Array.isArray(c.argv) && c.argv.length > 0, `${c.id}: argv`);
    assert.equal(c.id, c.argv.join("-"), `${c.id}: id must equal argv joined by "-"`);
    assert.ok(AVAILABILITY.has(c.availability), `${c.id}: availability ${c.availability}`);
    assert.ok(MODES.has(c.mode), `${c.id}: mode ${c.mode}`);
    assert.ok(Array.isArray(c.exits) && c.exits.length > 0, `${c.id}: exits`);
    for (const e of c.exits) assert.ok(EXIT_CODES.has(e), `${c.id}: exit code ${e}`);
    assert.equal(typeof c.changeScoped, "boolean", `${c.id}: changeScoped`);
    assert.deepEqual(
      [...c.exits].sort((a, b) => a - b),
      expectedExits(index, c),
      `${c.id}: exits must follow from the classes of its rules (specific + common)`,
    );
    if (c.mode === "guard")
      assert.ok(
        c.refusals.some((r) => /^(policy|guard)\//.test(r)),
        `${c.id}: a guard needs at least one policy or guard rule for its block outcome`,
      );
    if (c.standalone === true)
      assert.equal(c.changeScoped, false, `${c.id}: a standalone command cannot be Change-scoped`);
    assert.match(c.owner, OWNER, `${c.id}: owner`);
    assert.equal(typeof c.slice, "string", `${c.id}: slice`);
    assert.equal(typeof c.output, "string", `${c.id}: output schema path`);
    assert.ok(Array.isArray(c.refusals), `${c.id}: refusals`);
    for (const r of c.refusals) assert.match(r, RULE_ID, `${c.id}: rule id ${r}`);
    for (const r of c.refusals)
      assert.ok(
        !(c.standalone !== true && index.base.all.includes(r)) &&
          !(c.changeScoped && index.base.changeScoped.includes(r)),
        `${c.id}: ${r} is a common rule; do not repeat it per command`,
      );
    if (!c.changeScoped && c.standalone !== true)
      assert.ok(
        !c.refusals.some((r) => r === "policy/no-active-change"),
        `${c.id}: no-active-change implies changeScoped`,
      );
    assert.ok(Array.isArray(c.writes), `${c.id}: writes`);
    if (c.availability === "read")
      assert.equal(c.writes.length, 0, `${c.id}: read commands write nothing`);
    assert.ok(Array.isArray(c.args), `${c.id}: args`);
    assert.ok(Array.isArray(c.flags), `${c.id}: flags`);
    for (const f of c.flags) assert.match(f.name, /^--[a-z][a-z-]*$/, `${c.id}: flag ${f.name}`);
    assert.ok(
      !c.flags.some((f) => f.name === "--skip-verify"),
      `${c.id}: --skip-verify is never a CLI flag (P2)`,
    );
  }
});

test("index: output schemas exist, parse, and their $refs resolve", () => {
  const index = loadIndex();
  const seen = new Set();
  for (const c of index.commands) {
    const path = join(SCHEMA_DIR, c.output);
    seen.add(resolve(path));
    const schema = JSON.parse(read(path)) as Json & { $schema?: string };
    assert.equal(
      schema.$schema,
      "https://json-schema.org/draft/2020-12/schema",
      `${c.output}: draft 2020-12`,
    );
    for (const ref of collectRefs(schema)) {
      const [file, fragment = ""] = ref.split("#");
      const target =
        file === "" ? schema : (JSON.parse(read(resolve(dirname(path), file ?? ""))) as Json);
      assert.ok(
        resolvePointer(target, fragment ? `#${fragment}` : "") !== undefined,
        `${c.output}: unresolved $ref ${ref}`,
      );
    }
  }
  const outputDir = join(SCHEMA_DIR, "output");
  for (const f of readdirSync(outputDir)) {
    assert.ok(seen.has(resolve(join(outputDir, f))), `orphan output schema ${f}`);
  }
  for (const f of readdirSync(join(SCHEMA_DIR, "common"))) {
    JSON.parse(read(join(SCHEMA_DIR, "common", f)));
  }
});

test("specs: one `### Requirement: bdk ...` per command across the group specs and no extras", () => {
  const index = loadIndex();
  const specIds = loadGroupSpecs().flatMap(({ text }) =>
    commandRequirements(text).map((r) => r.id),
  );
  const indexIds = index.commands.map((c) => c.id);
  assert.deepEqual([...new Set(specIds)].sort(), [...indexIds].sort());
  assert.equal(specIds.length, new Set(specIds).size, "duplicate command requirements");
});

test("specs: every command requirement follows the mini-template and has a scenario per declared rule", () => {
  const index = loadIndex();
  const byId = new Map(index.commands.map((c) => [c.id, c]));
  for (const { group, text } of loadGroupSpecs()) {
    assert.match(text, /^## Purpose\s*$/m, `${group}: spec needs a Purpose section`);
    assert.match(text, /^## Requirements\s*$/m, `${group}: spec needs a Requirements section`);
  }
  const parts = loadGroupSpecs().flatMap(({ text }) => commandRequirements(text));
  for (const { id, body: part } of parts) {
    const c = byId.get(id);
    assert.ok(c, `requirement without index record: ${id}`);
    assert.match(part, /^#### Scenario: /m, `${id}: at least one scenario`);
    for (const r of c.refusals)
      assert.ok(part.includes(`#### Scenario: ${r}`), `${id}: no scenario for rule ${r}`);
    for (const label of [
      "Synopsis",
      "Availability",
      "Mode",
      "Arguments",
      "Output",
      "Exit codes and rules",
      "Example",
      "Owner",
      "Slice",
    ]) {
      assert.ok(
        new RegExp(`^(- )?\\*\\*${label}:?\\*\\*`, "m").test(part),
        `${id}: missing ${label}`,
      );
    }
    assert.ok(
      part.includes(`\`${c.availability}\``),
      `${id}: Availability line must name ${c.availability}`,
    );
    assert.ok(part.includes(`\`${c.mode}\``), `${id}: Mode line must name ${c.mode}`);
    assert.ok(part.includes(c.owner), `${id}: Owner line must name ${c.owner}`);
    assert.ok(part.includes(`\`${c.slice}\``), `${id}: Slice line must name ${c.slice}`);
    assert.ok(part.includes(c.output), `${id}: Output line must reference ${c.output}`);
    for (const r of c.refusals)
      assert.ok(part.includes(r), `${id}: rule ${r} not mentioned in the entry`);
  }
});

test("specs: every refusal example has exactly the four fields", () => {
  const all = [loadCoreSpec(), ...loadGroupSpecs().map((g) => g.text)].join("\n");
  const blocks = fencedBlocks(all, "json refusal");
  assert.ok(blocks.length > 0, "no `json refusal` examples found");
  for (const block of blocks) {
    const obj = JSON.parse(block) as {
      refused: unknown;
      rule: string;
      why: unknown;
      instead: unknown;
    };
    assert.deepEqual(
      Object.keys(obj).sort(),
      ["instead", "refused", "rule", "why"],
      `refusal example keys: ${block}`,
    );
    assert.equal(obj.refused, true);
    assert.match(obj.rule, RULE_ID);
    assert.equal(typeof obj.why, "string");
    assert.ok(
      Array.isArray(obj.instead) && obj.instead.length > 0,
      "instead must be a non-empty array",
    );
  }
});

const EXIT_CODES_REQUIREMENT = "Exit codes and the error object";

test("specs: refusal rule catalogue covers every rule the index declares", () => {
  const index = loadIndex();
  const catalogue = new Set(
    backticked(requirement(loadCoreSpec(), EXIT_CODES_REQUIREMENT)).filter((s) => RULE_ID.test(s)),
  );
  for (const r of [...index.base.all, ...index.base.changeScoped])
    assert.ok(catalogue.has(r), `common rule ${r} missing from the rule catalogue`);
  for (const c of index.commands) {
    for (const r of c.refusals)
      assert.ok(catalogue.has(r), `${c.id}: rule ${r} missing from the rule catalogue`);
  }
});

test("specs: the catalogue's 'Emitted by' column matches the index for command-specific rules", () => {
  const index = loadIndex();
  const byArgv = new Map(index.commands.map((c) => [c.argv.join(" "), c]));
  const declaredBy = new Map<string, string[]>();
  for (const c of index.commands)
    for (const r of c.refusals) declaredBy.set(r, [...(declaredBy.get(r) ?? []), c.argv.join(" ")]);
  const common = new Set([...index.base.all, ...index.base.changeScoped]);
  for (const row of tableFirstColumn(requirement(loadCoreSpec(), EXIT_CODES_REQUIREMENT), "Rule")) {
    const rule = backticked(row[0] ?? "")[0] ?? "";
    if (!RULE_ID.test(rule) || common.has(rule)) continue;
    assert.equal(
      Number(row[1]),
      EXIT_OF_CLASS[rule.split("/")[0] ?? ""],
      `${rule}: exit column must match the class`,
    );
    const named = backticked(row[2] ?? "")
      .map((s) => commandWords(s).join(" "))
      .filter((s) => byArgv.has(s));
    if (named.length === 0) continue; // prose cell (e.g. "commands taking an id")
    assert.deepEqual(
      [...new Set(named)].sort(),
      [...new Set(declaredBy.get(rule) ?? [])].sort(),
      `${rule}: 'Emitted by' must list exactly the commands that declare it`,
    );
  }
});

test("specs: wrapper regexes accept the design's form and reject broken forms", () => {
  const doc = loadCoreSpec();
  const [content] = fencedBlocks(doc, "regex content-wrapper");
  const [guard] = fencedBlocks(doc, "regex guard-wrapper");
  assert.ok(content && guard, "both wrapper regex blocks must exist");
  const contentRe = new RegExp(content.trim());
  const guardRe = new RegExp(guard.trim());
  const good =
    '!`node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" ctx skill debug 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."`';
  assert.ok(contentRe.test(good), "design example must match the content wrapper");
  assert.ok(
    contentRe.test(good.replace("ctx skill debug", "next")),
    "next in a wrapper must match",
  );
  assert.ok(!contentRe.test(good.replace(" 2>&1", "")), "missing 2>&1 must not match");
  assert.ok(
    !contentRe.test(good.replace(/ \|\| echo.*`$/, "`")),
    "missing || echo branch must not match",
  );
  assert.ok(
    !contentRe.test(good.replace("ctx skill debug", "commit 02-3")),
    "a writing command in a ! block must not match",
  );
  const goodGuard = 'node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" hooks pre-tool || exit 2';
  assert.ok(guardRe.test(goodGuard), "guard form must match");
  assert.ok(
    !guardRe.test(goodGuard.replace(" || exit 2", "")),
    "guard without || exit 2 must not match",
  );
  assert.ok(
    !guardRe.test(goodGuard.replace("exit 2", "exit 0")),
    "guard with exit 0 must not match",
  );
});

test("specs: availability classes used in the index are the four defined ones", () => {
  const defined = new Set(
    tableFirstColumn(requirement(loadCoreSpec(), "Availability classes"), "Class").flatMap((row) =>
      backticked(row[0] ?? ""),
    ),
  );
  assert.deepEqual([...defined].sort(), [...AVAILABILITY].sort());
});

test("architecture: slices in the index equal the module list, matrix names only known slices", () => {
  const arch = read(ARCH_SPEC_PATH);
  const modules = new Set(
    tableFirstColumn(arch, "Slice").flatMap((row) => backticked(row[0] ?? "")),
  );
  const inIndex = new Set(loadIndex().commands.map((c) => c.slice));
  assert.deepEqual(
    [...inIndex].sort(),
    [...modules].sort(),
    "slice parity between commands.json and the kernel-architecture spec",
  );
  const matrix = tableFirstColumn(arch, "From");
  assert.ok(matrix.length > 0, "dependency matrix missing");
  for (const row of matrix) {
    for (const name of backticked(row[0] ?? "").concat(backticked(row[1] ?? ""))) {
      if (name === "shared") continue;
      assert.ok(modules.has(name), `dependency matrix names unknown slice ${name}`);
    }
  }
});

test("coverage: every bdk command mentioned in the design, the plan and HOST-FACTS resolves to a command", () => {
  const index = loadIndex();
  const argvs = index.commands.map((c) => c.argv);
  const groups = new Set(argvs.map((a) => a[0]));
  const sources = [DESIGN_PATH, PLAN_PATH, HOST_FACTS_PATH].map((p) => read(p)).join("\n");
  const mentions = new Set(
    [...sources.matchAll(/`bdk(?:\.mjs)? ([^`]+)`/g)].map((m) => (m[1] ?? "").trim()),
  );
  const unresolved: string[] = [];
  const resolves = (words: string[]): boolean => {
    if (words.length === 0) return true;
    if (words.length === 1) return groups.has(words[0]);
    return (
      argvs.some((argv) => argv.every((w, i) => words[i] === w)) ||
      argvs.some((argv) => words.every((w, i) => argv[i] === w))
    );
  };
  for (const mention of mentions) {
    if (MENTION_ALLOWLIST.has(mention)) continue;
    // `a b|c|d` lists verbs of one group: later alternatives inherit the group.
    const alternatives = mention
      .replace(/<[^>]*>/g, " ")
      .split("|")
      .map((s) => commandWords(s));
    const group = alternatives[0]?.[0];
    const resolved = alternatives.every(
      (words, i) =>
        resolves(words) || (i > 0 && group !== undefined && resolves([group, ...words])),
    );
    if (!resolved) unresolved.push(mention);
  }
  assert.deepEqual(
    unresolved,
    [],
    "unresolved bdk mentions (add the command or allowlist it with a reason)",
  );
});

test("coverage: the allowlist contains nothing that is now a command", () => {
  const index = loadIndex();
  const argvs = index.commands.map((c) => c.argv.join(" "));
  for (const entry of MENTION_ALLOWLIST.keys()) {
    const words = commandWords(entry).join(" ");
    assert.ok(
      !argvs.includes(words),
      `allowlist entry "${entry}" is a real command now; remove it`,
    );
  }
});
