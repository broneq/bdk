// `bdk dispatch build <target> <role> <ticket>` (`kernel-cli/dispatch`;
// T23-D31 to D33, D37, D42): the package of an open ticket from the one
// template, stamped whole, at most 12 288 bytes. A ticket keeps one package per
// role, and the last one built is its active package. Nothing is written
// before every check has passed.
import { createHash } from "node:crypto";
import { join, posix } from "node:path";

import { ROLE_ADAPTERS } from "../../export/index.ts";
import { artifactPaths } from "../../graph/index.ts";
import { verifierPolicy, withChangeIndex } from "../../log/index.ts";
import type { VerifierCategory } from "../../log/index.ts";
import { roleSections } from "../../rules/index.ts";
import { readKernelVersion, resolveOrRefuse } from "../../shared/config/index.ts";
import { isRefusal, refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import {
  listEntries,
  planPlaceholders,
  readAttempts,
  readDocument,
  readPlanParts,
  renderDocument,
  splitFrontmatter,
  stampPackage,
  STATE_KINDS,
  TASK_ID,
  taskHolders,
  writeDocument,
} from "../../shared/store/index.ts";
import type { EntryRow, IndexDb, PlanPartFile } from "../../shared/store/index.ts";
import { ROLES } from "../../shared/vocabulary/index.ts";
import type { Role } from "../../shared/vocabulary/index.ts";
import { selectEntries, taskText } from "../domain/entries.ts";
import type { BuildReport } from "../domain/report.ts";
import {
  bytes,
  demoteHeadings,
  largestSection,
  normalise,
  packageBody,
  renderSections,
  templateSkeleton,
} from "../domain/template.ts";
import type { DispatchDeps } from "./deps.ts";

/** `kernel-state`, Dispatch package. */
const PACKAGE_LIMIT = 12_288;

const PART_ID = /^\d{2}$/;

export interface BuildInput {
  readonly target: string;
  readonly role: string;
  readonly ticket: string;
}

/** What the target section says and which names select its entries. */
interface TargetFacts {
  readonly body: string;
  readonly names: readonly string[];
}

export function buildPackage(
  deps: DispatchDeps,
  change: ActiveChange,
  globalDir: string,
  input: BuildInput,
): Promise<BuildReport | Refusal> {
  if (!isRole(input.role)) {
    return Promise.resolve(
      refuse("input/invalid-argument", `${input.role} is not a role; one of: ${ROLES.join(", ")}`, [
        `bdk dispatch build ${input.target} <role> ${input.ticket}`,
      ]),
    );
  }
  const role = input.role;
  return withChangeIndex(deps, change, async (index): Promise<BuildReport | Refusal> => {
    const target = await targetFacts(deps, change, index, globalDir, input.target);
    if (isRefusal(target)) return target;
    const record = readAttempts(deps.store, change.dir).find(
      (file) => file.data.ticket === input.ticket,
    );
    if (record?.data["closed-at"] !== undefined || record?.data.target !== input.target) {
      return refuse(
        "policy/no-open-ticket",
        record === undefined
          ? `${change.id} has no ticket ${input.ticket}`
          : record.data["closed-at"] !== undefined
            ? `ticket ${input.ticket} is closed`
            : `ticket ${input.ticket} targets ${record.data.target}, not ${input.target}`,
        ["bdk attempt list", `bdk attempt open <loop> ${input.target}`],
      );
    }
    const resolved = resolveOrRefuse(
      {
        store: deps.store,
        settings: deps.settings,
        globalDir,
        projectRoot: change.projectRoot,
        pluginRoot: deps.pluginRoot,
      },
      { removed: "ignore" },
    );
    if ("refused" in resolved) return resolved;
    const verifier = role === "verifier" || role === "design-verifier";
    const policy = verifier ? verifierPolicy(deps, change, globalDir) : undefined;
    if (policy !== undefined && isRefusal(policy)) return policy;

    const name = `${input.target}-${role}-${input.ticket}.md`;
    const changeRel = posix.relative(change.projectRoot, change.dir);
    const report = `${changeRel}/reports/${name}`;
    const roleBody = readRoleBody(deps, role);
    const selection = selectEntries(listEntries(index, change.id), target.names);
    const sections = renderSections(
      {
        ticket: input.ticket,
        role,
        attempt: String(record.data.attempt),
        of: String(record.data.of),
        scope: record.data.scope,
        intent: intentOf(deps, change),
        target: input.target,
        "target-body": target.body,
        entries: entriesText(deps, change, selection.full, selection.counted, input.target),
        "role-body": demoteHeadings(roleBody),
        report,
        blocking: categoryList(policy?.blocking ?? []),
        "not-a-fail": categoryList(policy?.notAFail ?? []),
      },
      verifier,
    );
    const rules = roleSections(deps, resolved, role).map((section) => section.text);
    const templateHash = hashOf([templateSkeleton(), roleBody, ...rules]);
    const kernelVersion = readKernelVersion(deps.store, deps.pluginRoot);
    const data = {
      schema: STATE_KINDS.dispatch.version,
      ticket: input.ticket,
      target: input.target,
      role,
      adapter: ROLE_ADAPTERS[role],
      attempt: record.data.attempt,
      of: record.data.of,
      scope: record.data.scope,
      at: deps.clock.now(),
      "kernel-version": kernelVersion,
      "template-hash": templateHash,
      report,
    };
    const text = renderDocument(data, packageBody(sections));
    const size = bytes(text);
    if (size > PACKAGE_LIMIT) {
      const largest = largestSection(sections);
      return refuse(
        "policy/package-too-large",
        `the package is ${String(size)} bytes, above ${String(PACKAGE_LIMIT)}; the largest section is ${largest.name} with ${String(bytes(largest.text))} bytes`,
        ["split the task or the part so its text and entries fit", "bdk part split <nn>"],
      );
    }
    const dir = join(change.dir, "dispatch");
    const path = join(dir, name);
    writeDocument(deps.store, path, { data, body: packageBody(sections) });
    stampPackage(deps.store, change.dir, input.ticket, posix.relative(change.projectRoot, path));
    return {
      path: posix.relative(change.projectRoot, path),
      bytes: size,
      ticket: input.ticket,
      target: input.target,
      role,
      adapter: ROLE_ADAPTERS[role],
      scope: record.data.scope,
      kernelVersion,
      templateHash,
      report,
      entries: { full: selection.full.map((entry) => entry.id), counted: selection.counted },
    };
  });
}

function isRole(role: string): role is Role {
  return (ROLES as readonly string[]).includes(role);
}

/** The target's section text and the names its entries are selected by, or the refusal. */
async function targetFacts(
  deps: DispatchDeps,
  change: ActiveChange,
  index: IndexDb,
  globalDir: string,
  target: string,
): Promise<TargetFacts | Refusal> {
  const changeRel = posix.relative(change.projectRoot, change.dir);
  const parts = readPlanParts(deps.store, change.dir);
  if (TASK_ID.test(target)) {
    const part = taskHolders(parts).get(target);
    const task = part?.tasks.find((found) => found.id === target);
    const text = part === undefined ? undefined : taskText(part.body, target);
    if (part === undefined || task === undefined || text === undefined) {
      return notFound(change, `no plan part holds task ${target}`);
    }
    const placeholders = planPlaceholders(part.data, [task]).filter((field) =>
      field.startsWith("task "),
    );
    if (placeholders.length > 0) {
      return refuse(
        "policy/placeholder",
        `${placeholders.join(", ")} of ${part.file} holds a placeholder`,
        [`finish task ${target} in ${changeRel}/${part.file}, then build the package again`],
      );
    }
    const body = `From \`${changeRel}/${part.file}\`:\n\n${demoteHeadings(text)}\n\n${doNotTouch(part)}`;
    return { body, names: [target, part.id, ...task.files.map((file) => file.path)] };
  }
  if (PART_ID.test(target)) {
    const part = parts.find((found) => found.id === target);
    if (part === undefined) return notFound(change, `no plan part ${target}`);
    return {
      body: `${readList([`${changeRel}/${part.file}`])}\n\n${doNotTouch(part)}`,
      names: [target],
    };
  }
  if (target === change.id) {
    return {
      body: readList([
        `${changeRel}/change.md`,
        ...parts.map((part) => `${changeRel}/${part.file}`),
      ]),
      names: [target],
    };
  }
  const paths = await artifactPaths(deps, change, index, globalDir, target);
  if (paths !== undefined && isRefusal(paths)) return paths;
  if (paths === undefined)
    return notFound(change, `the graph of ${change.id} has no artifact ${target}`);
  return {
    body:
      paths.length === 0
        ? "The artifact has no file: work on the committed code tree of the Change."
        : readList(paths.map((path) => `${changeRel}/${path}`)),
    names: [target],
  };
}

function notFound(change: ActiveChange, why: string): Refusal {
  return refuse("input/not-found", `${why} in ${change.id}`, ["bdk part list", "bdk status"]);
}

function readList(paths: readonly string[]): string {
  return `Read:\n\n${paths.map((path) => `- \`${path}\``).join("\n")}`;
}

function doNotTouch(part: PlanPartFile): string {
  const globs = part.data["do-not-touch"];
  return globs.length === 0
    ? "`do-not-touch`: none."
    : `\`do-not-touch\`: ${globs.map((glob) => `\`${glob}\``).join(", ")}.`;
}

function intentOf(deps: DispatchDeps, change: ActiveChange): string {
  const document = readDocument(deps.store, join(change.dir, "change.md"));
  const intent = document !== undefined && "data" in document ? document.data.intent : undefined;
  return typeof intent === "string" ? intent : `Change ${change.id}.`;
}

/** The plugin's role skill without its frontmatter; a missing file is a broken plugin. */
function readRoleBody(deps: DispatchDeps, role: Role): string {
  const path = join(deps.pluginRoot, "skills", "roles", role, "SKILL.md");
  const text = deps.store.read(path);
  if (text === undefined) throw new Error(`the plugin has no role skill at ${path}`);
  return splitFrontmatter(text).body.trim();
}

function entriesText(
  deps: DispatchDeps,
  change: ActiveChange,
  full: readonly EntryRow[],
  counted: Readonly<Record<string, number>>,
  target: string,
): string {
  const embedded =
    full.length === 0
      ? "No accepted decision or open blocker names this target."
      : full.map((entry) => entryText(deps, change, entry)).join("\n\n");
  const counts = Object.entries(counted)
    .map(([type, count]) => `${String(count)} ${type}`)
    .join(", ");
  const others =
    counts === ""
      ? `No other entry names this target; \`bdk log list --for ${target}\` shows later ones.`
      : `Other entries of this target: ${counts}; read them with \`bdk log list --for ${target}\`.`;
  return `${embedded}\n\n${others}`;
}

function entryText(deps: DispatchDeps, change: ActiveChange, entry: EntryRow): string {
  const document = readDocument(deps.store, join(change.projectRoot, entry.path));
  const body = document === undefined ? "" : document.body.trim();
  const refs = entry.refs.map((ref) => `\`${ref}\``).join(", ");
  return `### ${entry.id} ${entry.type}, ${entry.status}\n\n${entry.summary}\n\nRefs: ${refs}${body === "" ? "" : `\n\n${body}`}`;
}

function categoryList(categories: readonly VerifierCategory[]): string {
  return categories.map((category) => `- \`${category.id}\`: ${category.description}`).join("\n");
}

/** sha256 over the normalised texts in order (T23-D33). */
function hashOf(texts: readonly string[]): string {
  const hash = createHash("sha256");
  for (const text of texts) hash.update(`${normalise(text)}\n\0`);
  return `sha256:${hash.digest("hex")}`;
}
