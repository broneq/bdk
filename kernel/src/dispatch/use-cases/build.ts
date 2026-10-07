// `bdk dispatch build <target> <role> <ticket>` (`kernel-cli/dispatch`;
// T23-D31 to D33, D37, D42): the package of an open ticket from the one
// template, stamped whole, at most 163 840 bytes. A ticket keeps one package per
// role, and the last one built is its active package. A review round's
// `--group` builds one package per group under the same ticket and leaves the
// active package alone (T42-A1). Nothing is written before every check has
// passed.
import { createHash } from "node:crypto";
import { join, posix } from "node:path";

import { demoteHeadings, installedCraft } from "../../ctx/index.ts";
import { ROLE_ADAPTERS } from "../../export/index.ts";
import { artifactPaths, targetSteps } from "../../graph/index.ts";
import { verifierPolicy, withChangeIndex } from "../../log/index.ts";
import type { VerifierCategory } from "../../log/index.ts";
import { ruleContext, selectFor } from "../../rules/index.ts";
import {
  moduleValue,
  promptContent,
  readKernelVersion,
  resolveOrRefuse,
  toolGroup,
  toolsModule,
} from "../../shared/config/index.ts";
import type { Resolved } from "../../shared/config/index.ts";
import { workTreeFiles } from "../../shared/git/index.ts";
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
  reviewerGroups,
  splitFrontmatter,
  stampPackage,
  STATE_KINDS,
  TASK_ID,
  targetFiles,
  taskHolders,
  taskProgress,
  workRootOf,
  writeDocument,
} from "../../shared/store/index.ts";
import type { EntryRow, IndexDb, PlanPartFile } from "../../shared/store/index.ts";
import { isBlocking, ROLE_STAGE, ROLES } from "../../shared/vocabulary/index.ts";
import { rangeBinary, risksModule } from "../../review/index.ts";
import type { Role } from "../../shared/vocabulary/index.ts";
import { mergeConflictsPrompt } from "../config.ts";
import { checksText, fullChecksText } from "../domain/checks.ts";
import type { ToolLists } from "../domain/checks.ts";
import { fileRefs, selectEntries, taskText } from "../domain/entries.ts";
import type { BuildReport } from "../domain/report.ts";
import {
  groupFlagProblem,
  integrationText,
  judgeText,
  reviewText,
  risksText,
} from "../domain/review.ts";
import type { GroupFlags, JudgedEntry } from "../domain/review.ts";
import {
  bytes,
  largestSection,
  normalise,
  packageBody,
  renderSections,
  templateSkeleton,
} from "../domain/template.ts";
import type { SectionKind } from "../domain/template.ts";
import type { DispatchDeps } from "./deps.ts";

/**
 * `kernel-state`, Dispatch package: 160 KiB is about 40-50k tokens, a fraction of the context
 * of the agent that reads the package whole. A review group package grows with the files of its
 * group, the integration group's with all of the range.
 */
const PACKAGE_LIMIT = 163_840;

const PART_ID = /^\d{2}$/;

export interface BuildInput extends GroupFlags {
  readonly target: string;
  readonly role: string;
  readonly ticket: string;
}

/** The intent and plan documents a review group reads, when the Change holds them. */
const INTENT_FILES = ["change.md", "design.md", "architecture.md", "plan/index.md"];

/** The verifiers: their P8 lists come with the sentence that any other blocker is an observation. */
const VERIFIER_ROLES: readonly string[] = ["verifier", "design-verifier"];
/** The reviewing roles that get the P8 lists with the triage sentence (#158). */
const P8_REVIEWING_ROLES: readonly string[] = ["reviewer", "integration-reviewer", "judge"];
/** The entry types the judge triages, and the statuses of a live entry (#158). */
const JUDGED_TYPES: readonly string[] = ["finding", "blocker", "observation"];
const LIVE: readonly string[] = ["proposed", "accepted"];

/** What the target section says, which names select its entries, and its file set. */
interface TargetFacts {
  readonly body: string;
  readonly names: readonly string[];
  /** The files rules are selected by; undefined for an artifact or the Change. */
  readonly files: readonly string[] | undefined;
}

export function buildPackage(
  deps: DispatchDeps,
  change: ActiveChange,
  where: { readonly globalDir: string; readonly home: string },
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
  const flagProblem = groupFlagProblem(role, input);
  if (flagProblem !== undefined) {
    return Promise.resolve(
      refuse("input/invalid-argument", flagProblem, [
        `bdk dispatch build ${input.target} ${role} ${input.ticket} --group <group> --range <base>..<head>`,
        "bdk review plan",
      ]),
    );
  }
  const group = input.group;
  const { globalDir } = where;
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
    if (group !== undefined && record.data.loop !== "review-fix") {
      return refuse(
        "input/invalid-argument",
        `${input.ticket} is a ${record.data.loop} ticket; only a review-fix ticket has review groups`,
        [`bdk dispatch build ${input.target} ${role} ${input.ticket}`],
      );
    }
    const parts = readPlanParts(deps.store, change.dir);
    const part =
      input.part === undefined ? undefined : parts.find((found) => found.id === input.part);
    if (input.part !== undefined && part === undefined) {
      return refuse(
        "input/invalid-argument",
        `--part ${input.part}: ${change.id} has no such plan part`,
        ["bdk part list"],
      );
    }
    if ((role === "lead") !== (record.data.loop === "part-lead")) {
      return refuse(
        "input/invalid-argument",
        role === "lead"
          ? `lead runs a part-lead ticket; ${input.ticket} is a ${record.data.loop} ticket`
          : `a part-lead ticket takes the lead role, not ${role}`,
        [
          role === "lead"
            ? `bdk attempt open part-lead <part>`
            : `bdk dispatch build ${input.target} lead ${input.ticket}`,
        ],
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
    const verifier = VERIFIER_ROLES.includes(role);
    const p8 = verifier || P8_REVIEWING_ROLES.includes(role);
    const policy = p8 ? verifierPolicy(deps, change, globalDir) : undefined;
    if (policy !== undefined && isRefusal(policy)) return policy;
    const ref = group === undefined ? input.ticket : `${input.ticket}@${group}`;
    const checks =
      role !== "runner"
        ? ""
        : group === undefined
          ? await runnerChecks(deps, change, index, globalDir, input, resolved)
          : await gateChecks(deps, change, index, globalDir, input, resolved, ref);
    if (typeof checks !== "string") return checks;
    const tasks = role === "lead" ? await leadTasks(deps, change, input.target) : "";

    const name = `${input.target}-${role}-${input.ticket}${group === undefined ? "" : `-${group}`}.md`;
    const changeRel = posix.relative(change.projectRoot, change.dir);
    const report = `${changeRel}/reports/${name}`;
    const intent = INTENT_FILES.filter((file) => deps.store.exists(join(change.dir, file))).map(
      (file) => `${changeRel}/${file}`,
    );
    let review = "";
    let reviewLead = "";
    const judged =
      role === "judge" ? judgedEntries(listEntries(index, change.id), input.ticket) : [];
    if (group !== undefined && role === "judge") {
      reviewLead = `You are the judge of ticket ${input.ticket}, group \`${group}\`.`;
      review = judgeText({
        range: input.range ?? "",
        entries: judged,
        reports: roundReports(deps, change.dir, input.ticket, name).map(
          (file) => `${changeRel}/reports/${file}`,
        ),
        specDeltas: specDeltaPaths(deps, change.dir).map((path) => `${changeRel}/${path}`),
        intent,
        focus: input.focus,
      });
    } else if (group !== undefined && role === "integration-reviewer") {
      const [base = "", head = ""] = (input.range ?? "").split("..");
      const binary = await rangeBinary(deps.git, change.projectRoot, base, head);
      if (isRefusal(binary)) return binary;
      reviewLead = `You are the integration reviewer of ticket ${input.ticket}, group \`${group}\`.`;
      review = integrationText({
        range: input.range ?? "",
        binary,
        groups: reviewerGroups(deps.store, change.projectRoot, change.dir, input.ticket),
        specDeltas: specDeltaPaths(deps, change.dir).map((path) => `${changeRel}/${path}`),
        intent,
        focus: input.focus,
      });
    } else if (group !== undefined) {
      reviewLead = `You review group \`${group}\` of ticket ${input.ticket}. Review only this group; another agent reviews each other group in parallel.`;
      review = reviewText({
        files: input.files,
        range: input.range,
        partFile: part === undefined ? undefined : `${changeRel}/${part.file}`,
        intent,
        focus: input.focus,
      });
    }
    const risks =
      role === "integration-reviewer" ? risksText(moduleValue(risksModule, resolved.value)) : "";
    const kinds: SectionKind[] = [
      // The judge reads each entry's body with `bdk log show`, so its package holds none (#158).
      ...(role === "judge" ? [] : (["ledger"] as const)),
      ...(p8 ? (["categories"] as const) : []),
      ...(role === "runner" || role === "lead" ? [role] : []),
      ...(group === undefined ? [] : (["review"] as const)),
      ...(role === "integration-reviewer" ? (["risks"] as const) : []),
    ];
    const workdir = await workRootOf(deps.git, deps.store, change, parts, input.target);
    const isolated = workdir !== change.projectRoot;
    const conflicts = record.data.conflicts;
    // Only the implementer resolves a merge; the steps of the ticket check the merged state.
    const resolving = conflicts !== undefined && role === "implementer";
    const instruction = resolving ? promptText(deps, resolved, mergeConflictsPrompt.key) : "";
    const craft =
      role === "implementer"
        ? installedCraft(
            { store: deps.store, pluginRoot: deps.pluginRoot, home: where.home },
            changeKindOf(deps, change) === "bug" ? ["debugging", "tdd"] : ["tdd"],
          )
        : [];
    if (craft.length > 0) kinds.push("craft");
    if (isolated) kinds.push("work-root");
    if (resolving) kinds.push("conflict");
    else if (conflicts !== undefined) kinds.push("merge");
    const roleBody = readRoleBody(deps, role);
    // A review fix carries the round's blockers whatever their refs (T42-D3).
    const reviewFix =
      role === "implementer" && record.data.loop === "review-fix" && group === undefined;
    const selection = selectEntries(
      listEntries(index, change.id),
      target.names,
      reviewFix ? (entry) => isBlocking(entry, "review", { triaged: true }) : undefined,
    );
    const fixFiles = reviewFix ? fileRefs(selection.full) : [];
    const sections = renderSections(
      {
        ticket: input.ticket,
        ref,
        "review-lead": reviewLead,
        review,
        risks,
        role,
        attempt: String(record.data.attempt),
        of: String(record.data.of),
        scope: record.data.scope,
        intent: intentOf(deps, change),
        target: input.target,
        "target-body": target.body,
        entries: entriesText(deps, change, selection.full, selection.counted, input.target),
        "role-body": demoteHeadings(withPluginRoot(roleBody, deps.pluginRoot)),
        report,
        "categories-rule": verifier
          ? `A blocker names one of these with \`bdk log add blocker <summary> --ref <ref> --ticket ${ref} --category <id>\`; any other blocker is stored as an observation for review.`
          : "Only an entry in one of these categories can be triaged `blocker`.",
        blocking: categoryList(policy?.blocking ?? []),
        "not-a-fail": categoryList(policy?.notAFail ?? []),
        checks,
        tasks,
        workdir,
        part: holderOf(parts, input.target) ?? input.target,
        merged: change.branch,
        conflicts: (conflicts ?? []).map((path) => `- \`${path}\``).join("\n"),
        "merge-instruction": demoteHeadings(instruction.trim()),
        craft: craft.map((name) => `- \`${name}\`: \`bdk ctx craft ${name}\``).join("\n"),
      },
      kinds,
    );
    // A target without files of its own (an artifact, the Change) selects over the work tree.
    const ownFiles =
      group !== undefined
        ? groupFiles(input.files, parts, input.part)
        : fixFiles.length > 0
          ? fixFiles
          : withConflicts(target.files, conflicts);
    const rules = selectFor(
      ruleContext(
        { store: deps.store, pluginRoot: deps.pluginRoot, projectRoot: change.projectRoot },
        resolved,
      ),
      ROLE_STAGE[role],
      ownFiles ?? (await workTreeFiles(deps.git, change.projectRoot)),
    );
    const templateHash = hashOf([
      templateSkeleton(),
      roleBody,
      ...rules.selected.map(({ rule }) => `${rule.id}\n${rule.text}`),
      ...(instruction === "" ? [] : [instruction]),
    ]);
    const kernelVersion = readKernelVersion(deps.store, deps.pluginRoot);
    const model = escalationModel(record.data.model, role);
    const data = {
      schema: STATE_KINDS.dispatch.version,
      ticket: input.ticket,
      target: input.target,
      role,
      adapter: ROLE_ADAPTERS[role],
      attempt: record.data.attempt,
      of: record.data.of,
      scope: record.data.scope,
      ...(model === undefined ? {} : { model }),
      at: deps.clock.now(),
      "kernel-version": kernelVersion,
      "template-hash": templateHash,
      report,
      rules: rules.selected.map(({ rule }) => rule.id),
      ...(group === undefined ? {} : { group, files: [...input.files] }),
      ...(role === "judge" ? { entries: judged.map((entry) => entry.id) } : {}),
      ...(isolated ? { workdir } : {}),
    };
    const text = renderDocument(data, packageBody(sections));
    const size = bytes(text);
    if (size > PACKAGE_LIMIT) {
      const largest = largestSection(sections);
      return refuse(
        "policy/package-too-large",
        `the package is ${String(size)} bytes, above ${String(PACKAGE_LIMIT)}; the largest section is ${largest.name} with ${String(bytes(largest.text))} bytes`,
        group === undefined
          ? ["split the task or the part so its text and entries fit", "bdk part split <nn>"]
          : [
              "lower review.group.max-files so the group holds fewer files",
              "pass fewer --file paths to the group",
            ],
      );
    }
    const dir = join(change.dir, "dispatch");
    const path = join(dir, name);
    if (group !== undefined) {
      // One package per group, whatever its role: a rebuild under another role replaces it.
      for (const earlier of deps.store.list(dir)) {
        if (earlier !== name && earlier.endsWith(`-${input.ticket}-${group}.md`)) {
          deps.store.remove(join(dir, earlier));
        }
      }
    }
    writeDocument(deps.store, path, { data, body: packageBody(sections) });
    if (group === undefined) {
      stampPackage(deps.store, change.dir, input.ticket, posix.relative(change.projectRoot, path));
    }
    return {
      path: posix.relative(change.projectRoot, path),
      bytes: size,
      ticket: input.ticket,
      target: input.target,
      role,
      adapter: ROLE_ADAPTERS[role],
      scope: record.data.scope,
      ...(model === undefined ? {} : { model }),
      kernelVersion,
      templateHash,
      report,
      ...(group === undefined ? {} : { group, files: input.files }),
      entries:
        role === "judge"
          ? { full: [], counted: {} }
          : { full: selection.full.map((entry) => entry.id), counted: selection.counted },
    };
  });
}

/**
 * The model of an escalation ticket's package (T41-D14): a stronger model helps
 * the roles that reason, not the runner running commands or the scout searching.
 */
function escalationModel(model: string | undefined, role: Role): string | undefined {
  return role === "runner" || role === "scout" ? undefined : model;
}

/** The runner's `Checks` text: the runner's steps in pipeline order with the project's commands. */
async function runnerChecks(
  deps: DispatchDeps,
  change: ActiveChange,
  index: IndexDb,
  globalDir: string,
  input: BuildInput,
  resolved: Resolved,
): Promise<string | Refusal> {
  const steps = await targetSteps(deps, change, index, globalDir, input.target);
  if (isRefusal(steps)) return steps;
  const kinds = steps.steps.filter((step) => step.role === "runner").map((step) => step.kind);
  return checksText(kinds, toolLists(resolved), steps.files, input.ticket);
}

/** The gate runner's `Checks` text: the change-level checks the Change applies (T42-D9, T49). */
async function gateChecks(
  deps: DispatchDeps,
  change: ActiveChange,
  index: IndexDb,
  globalDir: string,
  input: BuildInput,
  resolved: Resolved,
  ref: string,
): Promise<string | Refusal> {
  const steps = await targetSteps(deps, change, index, globalDir, input.target);
  if (isRefusal(steps)) return steps;
  return fullChecksText(steps.checks, toolLists(resolved), ref);
}

/** The entries of the two tool groups; an unset or declared-none group has none. */
function toolLists(resolved: Resolved): ToolLists {
  const tools = moduleValue(toolsModule, resolved.value);
  return { test: toolGroup(tools, "test").entries, lint: toolGroup(tools, "lint").entries };
}

/**
 * The lead's `Tasks` text (T41-D11): each task of the part in plan order with
 * its files, its dependencies and whether a trailer commit already carries it,
 * so a lead that replaces an earlier one continues with the rest.
 */
async function leadTasks(deps: DispatchDeps, change: ActiveChange, part: string): Promise<string> {
  const parts = readPlanParts(deps.store, change.dir);
  const progress = await taskProgress(
    deps.git,
    change.projectRoot,
    change.id,
    parts,
    readAttempts(deps.store, change.dir),
  );
  const tasks = parts.find((found) => found.id === part)?.tasks ?? [];
  return tasks
    .map((task) => {
      const files = task.files.map((file) => `\`${file.path}\``).join(", ");
      const depends =
        task.dependsOn.length === 0 ? "none" : task.dependsOn.map((id) => `\`${id}\``).join(", ");
      const state = progress.committed.has(task.id) ? "committed" : "open";
      return `- \`${task.id}\` ${task.title} (${state}). Files: ${files}. Depends on: ${depends}.`;
    })
    .join("\n");
}

/** A merge ticket's rule selection adds its conflicted paths, so a lockfile rule applies (T45). */
function withConflicts(
  files: readonly string[] | undefined,
  conflicts: readonly string[] | undefined,
): readonly string[] | undefined {
  if (files === undefined || conflicts === undefined) return files;
  return [...new Set([...files, ...conflicts])];
}

/** The part of a task or part target; undefined for any other target. */
function holderOf(parts: readonly PlanPartFile[], target: string): string | undefined {
  if (PART_ID.test(target)) return target;
  return taskHolders(parts).get(target)?.id;
}

function promptText(deps: DispatchDeps, resolved: Resolved, key: string): string {
  const value = resolved.prompts.values.get(key);
  if (value === undefined) throw new Error(`the prompt value ${key} has no file in any layer`);
  return promptContent(deps.store, value);
}

/**
 * A group's file set for rule selection: its `--file` paths, else the `Files:`
 * of the `--part` tasks, else none, where every rule of the role applies.
 */
function groupFiles(
  files: readonly string[],
  parts: readonly PlanPartFile[],
  part: string | undefined,
): readonly string[] | undefined {
  if (files.length > 0) return files;
  return part === undefined ? undefined : targetFiles(parts, part);
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
    const files = task.files.map((file) => file.path);
    return { body, names: [target, part.id, ...files], files: targetFiles(parts, target) };
  }
  if (PART_ID.test(target)) {
    const part = parts.find((found) => found.id === target);
    if (part === undefined) return notFound(change, `no plan part ${target}`);
    return {
      body: `${readList([`${changeRel}/${part.file}`])}\n\n${doNotTouch(part)}`,
      names: [target],
      files: targetFiles(parts, target),
    };
  }
  if (target === change.id) {
    return {
      body: readList([
        `${changeRel}/change.md`,
        ...parts.map((part) => `${changeRel}/${part.file}`),
      ]),
      names: [target],
      files: undefined,
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
    files: undefined,
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
  const intent = changeField(deps, change, "intent");
  return typeof intent === "string" ? intent : `Change ${change.id}.`;
}

/** The Change kind (`feature`, `bug`, `review`), which picks the implementer's craft skills (D4). */
function changeKindOf(deps: DispatchDeps, change: ActiveChange): unknown {
  return changeField(deps, change, "kind");
}

function changeField(deps: DispatchDeps, change: ActiveChange, field: string): unknown {
  const document = readDocument(deps.store, join(change.dir, "change.md"));
  return document !== undefined && "data" in document ? document.data[field] : undefined;
}

/**
 * The role body as Claude Code would load the skill: `${CLAUDE_PLUGIN_ROOT}`
 * replaced by the plugin's path. A subagent reads the package with Read, which
 * substitutes nothing, and its Bash has no such variable. The template hash is
 * taken before, so it stays the same wherever the plugin is installed.
 */
function withPluginRoot(body: string, pluginRoot: string): string {
  return body.replaceAll("${CLAUDE_PLUGIN_ROOT}", pluginRoot);
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

/** sha256 over the normalised texts in order (T23-D33); a rule's text is hashed with its id. */
function hashOf(texts: readonly string[]): string {
  const hash = createHash("sha256");
  for (const text of texts) hash.update(`${normalise(text)}\n\0`);
  return `sha256:${hash.digest("hex")}`;
}

/**
 * The entries a judge triages (#158): every live finding, blocker and
 * observation written under the round's ticket, then every other live one of
 * the Change without a level, each in ledger order.
 */
function judgedEntries(entries: readonly EntryRow[], ticket: string): JudgedEntry[] {
  const live = entries.filter(
    (entry) => JUDGED_TYPES.includes(entry.type) && LIVE.includes(entry.status),
  );
  return [
    ...live.filter((entry) => entry.ticket === ticket),
    ...live.filter((entry) => entry.ticket !== ticket && entry.level === undefined),
  ].map((entry) => ({
    id: entry.id,
    type: entry.type,
    summary: entry.summary,
    refs: entry.refs,
    writer: entry.source,
    group: entry.group,
  }));
}

/** The stored reports of the round's ticket but the judge's own, by file name, sorted. */
function roundReports(
  deps: DispatchDeps,
  changeDir: string,
  ticket: string,
  own: string,
): string[] {
  return deps.store
    .list(join(changeDir, "reports"))
    .filter((name) => name.endsWith(".md") && name.includes(`-${ticket}-`) && name !== own)
    .sort();
}

/** The Change's `spec-delta/**\/*.md` paths, relative to its directory, sorted. */
function specDeltaPaths(deps: DispatchDeps, changeDir: string): string[] {
  const found: string[] = [];
  const visit = (dir: string): void => {
    for (const name of deps.store.list(join(changeDir, dir))) {
      if (name.endsWith("/")) visit(`${dir}/${name.slice(0, -1)}`);
      else if (name.endsWith(".md")) found.push(`${dir}/${name}`);
    }
  };
  visit("spec-delta");
  return found.sort();
}
