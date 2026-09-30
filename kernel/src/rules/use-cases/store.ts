// The rule store (`kernel-cli/rules`, bdk rules check): the bundle's pack
// under the plugin's `rules/` and the project's `.bdk/rules/`, read with one
// schema. Every problem is collected, never thrown, so `rules check` can list
// them all and the other commands can refuse on the first.
import { join, posix } from "node:path";
import { parse } from "yaml";

import { STATE_KINDS, splitFrontmatter } from "../../shared/store/index.ts";
import type { Store } from "../../shared/store/index.ts";
import { BUNDLE_PREFIX, PACK_DIRS, numberOf, prefixOf } from "../domain/rule.ts";
import type { LoadedRule, RuleProblem, RuleScope } from "../domain/rule.ts";

export interface RuleStoreInput {
  readonly store: Store;
  readonly pluginRoot: string;
  readonly projectRoot: string;
  /** `rules.disabled`; checked against the loaded ids. */
  readonly disabled: readonly string[];
}

export interface RuleSet {
  /** Bundle rules by directory then id, then project rules by id. */
  readonly rules: readonly LoadedRule[];
  readonly problems: readonly RuleProblem[];
}

export const PROJECT_RULES_DIR = ".bdk/rules";

export function loadRules(input: RuleStoreInput): RuleSet {
  const problems: RuleProblem[] = [];
  const rules: LoadedRule[] = [];
  // Every id a parsed file declares, also when its file name differs, so a
  // third file declaring an existing id is named as a duplicate.
  const declared: Declared[] = [];
  const bundleRoot = join(input.pluginRoot, "rules");
  for (const [path, display, pack] of bundleFiles(input.store, bundleRoot)) {
    const loaded = readRule(input.store, path, display, "bundle", pack, problems, declared);
    if (loaded !== undefined) rules.push(loaded);
  }
  const projectDir = join(input.projectRoot, PROJECT_RULES_DIR);
  for (const name of input.store.list(projectDir)) {
    if (!name.endsWith(".md")) continue;
    const display = `${PROJECT_RULES_DIR}/${name}`;
    const loaded = readRule(
      input.store,
      join(projectDir, name),
      display,
      "project",
      undefined,
      problems,
      declared,
    );
    if (loaded !== undefined) rules.push(loaded);
  }
  problems.push(...duplicates(declared));
  const known = new Set(rules.map((rule) => rule.id));
  const unknown = input.disabled.filter((id) => !known.has(id));
  if (unknown.length > 0) {
    problems.push({
      code: "unknown-disabled-id",
      file: "rules.disabled",
      message: `rules.disabled names ${unknown.join(", ")}, which no rule of the bundle or the project carries`,
    });
  }
  return { rules, problems };
}

/** Every rule file of the pack as [path, display, pack]; README.md is the pack's only other file. */
function bundleFiles(store: Store, root: string, prefix = ""): [string, string, string][] {
  return store.list(join(root, prefix)).flatMap((name): [string, string, string][] => {
    if (name.endsWith("/")) return bundleFiles(store, root, `${prefix}${name}`);
    if (!name.endsWith(".md") || (prefix === "" && name === "README.md")) return [];
    const pack = prefix.replace(/\/$/, "");
    return [[join(root, prefix, name), posix.join("rules", prefix, name), pack]];
  });
}

function readRule(
  store: Store,
  path: string,
  display: string,
  scope: RuleScope,
  pack: string | undefined,
  problems: RuleProblem[],
  declared: Declared[],
): LoadedRule | undefined {
  const problem = (
    code: RuleProblem["code"],
    message: string,
    line?: number,
  ): LoadedRule | undefined => {
    problems.push({ code, file: display, ...(line === undefined ? {} : { line }), message });
    return undefined;
  };
  const text = store.read(path) ?? "";
  const split = splitFrontmatter(text);
  if (split.frontmatter === undefined) {
    return problem("format", `${display} has no YAML frontmatter`, 1);
  }
  let raw: unknown;
  try {
    raw = parse(split.frontmatter);
  } catch (error) {
    return problem("format", `${display}: ${(error as Error).message.split("\n")[0] ?? ""}`, 1);
  }
  const parsed = STATE_KINDS.rule.schema.safeParse(raw);
  if (!parsed.success) {
    const fields = parsed.error.issues.map(
      (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
    );
    return problem(
      "format",
      `${display}: ${fields.join("; ")}`,
      lineOf(split.frontmatter, parsed.error.issues[0]?.path[0]),
    );
  }
  const data = parsed.data as unknown as Omit<
    LoadedRule,
    "prefix" | "number" | "scope" | "file" | "pack" | "text"
  >;
  declared.push({ id: data.id, file: display });
  const name = posix.basename(display, ".md");
  const idLine = lineOf(split.frontmatter, "id");
  if (data.id !== name) {
    return problem(
      "id-mismatch",
      `${display} declares id ${data.id}; the id must equal the file name ${name}`,
      idLine,
    );
  }
  const bundled = data.id.startsWith(BUNDLE_PREFIX);
  if (bundled !== (scope === "bundle")) {
    return problem(
      "bundle-prefix",
      scope === "bundle"
        ? `${display}: a pack rule's id starts with ${BUNDLE_PREFIX}`
        : `${display}: ${BUNDLE_PREFIX} ids belong to the BDK pack; pick a project prefix`,
      idLine,
    );
  }
  const prefix = prefixOf(data.id);
  if (scope === "bundle") {
    const expected = pack === undefined ? undefined : PACK_DIRS[pack];
    if (expected === undefined || prefix !== `${BUNDLE_PREFIX}${expected}`) {
      return problem(
        "pack-dir",
        expected === undefined
          ? `${display} lies in rules/${pack ?? ""}, which is no pack directory`
          : `${display}: rules/${pack ?? ""} holds ${BUNDLE_PREFIX}${expected}-<n> rules`,
        idLine,
      );
    }
  }
  return {
    ...data,
    prefix,
    number: numberOf(data.id),
    scope,
    file: display,
    ...(pack === undefined ? {} : { pack }),
    text: split.body.trim(),
  };
}

interface Declared {
  readonly id: string;
  readonly file: string;
}

function duplicates(declared: readonly Declared[]): RuleProblem[] {
  const byId = new Map<string, Declared[]>();
  for (const rule of declared) byId.set(rule.id, [...(byId.get(rule.id) ?? []), rule]);
  return [...byId.values()]
    .filter((group) => group.length > 1)
    .map((group) => ({
      code: "duplicate-id" as const,
      file: group[0]?.file ?? "",
      message: `${group[0]?.id ?? ""} is declared by ${group.map((rule) => rule.file).join(" and ")}; the later file takes the next free number`,
    }));
}

/** The 1-based line of the frontmatter key, counting the opening `---`. */
function lineOf(frontmatter: string, key: PropertyKey | undefined): number | undefined {
  if (typeof key !== "string") return undefined;
  const index = frontmatter.split("\n").findIndex((line) => line.startsWith(`${key}:`));
  return index === -1 ? undefined : index + 2;
}
