// `bdk evidence record <kind> <file>...` (`kernel-cli/evidence`; T23-D8, D45,
// D46, D47): the ticket must be open, every file exist and every citation
// resolve before anything is written. Small UTF-8 text is copied into the
// Change; any other file stays under `.bdk/.machine/evidence/`. The manifest
// carries the tree hash of the ticket's target; an equal earlier manifest is
// returned instead of a second one.
import { basename, isAbsolute, join, relative } from "node:path";

import { citationHint, citationProblem, isText } from "../domain/citation.ts";
import type { CitedFile } from "../domain/citation.ts";
import type { RecordReport, RecordedFile } from "../domain/reports.ts";
import { moduleValue } from "../../shared/config/index.ts";
import { authorIdent } from "../../shared/git/index.ts";
import { newId } from "../../shared/ids/index.ts";
import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import {
  activePackage,
  readAttempts,
  readManifests,
  readPlanParts,
  ticketManifests,
  writeDocument,
} from "../../shared/store/index.ts";
import type { EvidenceManifest, ManifestFile } from "../../shared/store/index.ts";
import { evidenceModule } from "../config.ts";
import type { EvidenceDeps } from "./deps.ts";
import { evidenceSettings, filePolicy, scopeOf, scopeTree } from "./scope.ts";
import { sha256 } from "./tree.ts";

const KIND = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERDICTS: readonly string[] = ["pass", "fail", "not-run"];
const MACHINE_EVIDENCE = ".bdk/.machine/evidence/";

type Verdict = "pass" | "fail" | "not-run";

export interface RecordInput {
  readonly kind: string;
  /** As typed: relative to `cwd` unless absolute. */
  readonly files: readonly string[];
  readonly ticket: string | undefined;
  readonly verdict: string | undefined;
  readonly citations: readonly string[];
  /** Kernel evidence (`attempt close` records `simplify`, T23-D43): `source: kernel`, no citation needed. */
  readonly kernel?: boolean;
}

export interface RecordWhere {
  readonly cwd: string;
  readonly globalDir: string;
}

interface Source {
  readonly given: string;
  /** Relative to the project root. */
  readonly path: string;
  readonly name: string;
  readonly bytes: Uint8Array;
  readonly hash: string;
  readonly text: boolean;
}

export async function recordEvidence(
  deps: EvidenceDeps,
  change: ActiveChange,
  where: RecordWhere,
  input: RecordInput,
): Promise<RecordReport | Refusal> {
  const usage = `bdk evidence record ${input.kind} <file> --ticket <ticket> --verdict pass --cite <pointer>`;
  if (!KIND.test(input.kind)) {
    return refuse("input/invalid-argument", `kind ${input.kind} is not kebab-case`, [usage]);
  }
  if (input.ticket === undefined) {
    return refuse("input/missing-argument", "evidence record needs --ticket", [usage]);
  }
  if (input.verdict !== undefined && !VERDICTS.includes(input.verdict)) {
    return refuse(
      "input/invalid-argument",
      `verdict ${input.verdict} is not pass, fail or not-run`,
      [usage],
    );
  }
  const verdict = input.verdict as Verdict | undefined;
  const ticket = input.ticket;
  const record = readAttempts(deps.store, change.dir).find((file) => file.data.ticket === ticket);
  if (record === undefined || record.data.outcome !== undefined) {
    return refuse(
      "policy/no-open-ticket",
      record === undefined
        ? `${change.id} has no ticket ${ticket}`
        : `ticket ${ticket} is already closed ${record.data.outcome ?? ""}`,
      ["bdk attempt list", "bdk attempt open <loop> <target>"],
    );
  }

  const sources = readSources(deps, change.projectRoot, where.cwd, input.files);
  if ("refused" in sources) return sources;
  const citations = checkCitations(sources, verdict, input.citations, input.kernel === true);
  if (citations !== undefined) return citations;

  const resolved = evidenceSettings(deps, change.projectRoot, where.globalDir);
  if ("refused" in resolved) return resolved;
  const target = record.data.target;
  const parts = readPlanParts(deps.store, change.dir);
  // An artifact target (a verifier ticket) covers the whole Change.
  const scope = scopeOf(parts, change.id, target) ?? parts;
  const { treeHash, tree } = await scopeTree(
    deps,
    change.projectRoot,
    filePolicy(resolved.value),
    scope,
  );

  const hashes = sources.map((source) => source.hash);
  const earlier = ticketManifests(readManifests(deps.store, change.dir), ticket).find(
    (manifest) =>
      manifest.data.kind === input.kind &&
      manifest.data["tree-hash"] === treeHash &&
      manifest.data.verdict === verdict &&
      same(manifest.data.citations ?? [], input.citations) &&
      same(
        manifest.data.files.map((file) => file.hash),
        hashes,
      ),
  );
  if (earlier !== undefined) return reportOf(change.projectRoot, earlier, true);

  const id = newId("E-", deps.random);
  const limit = moduleValue(evidenceModule, resolved.value)["max-committed-bytes"];
  const files = sources.map((source): RecordedFile => {
    const name = `${target}-${id}-${source.name}`;
    const hash = source.hash;
    if (source.text && source.bytes.length <= limit) {
      const path = join(relative(change.projectRoot, change.dir), "evidence", name);
      deps.store.writeBytes(join(change.projectRoot, path), source.bytes);
      return { path, hash, stored: "committed" };
    }
    if (source.path.startsWith(MACHINE_EVIDENCE))
      return { path: source.path, hash, stored: "machine" };
    const path = `${MACHINE_EVIDENCE}${name}`;
    deps.store.writeBytes(join(change.projectRoot, path), source.bytes);
    return { path, hash, stored: "machine" };
  });
  const active = activePackage(deps.store, change.projectRoot, change.dir, ticket);
  const path = join(change.dir, "evidence", `${target}-${id}.md`);
  const data: EvidenceManifest = {
    schema: 1,
    id,
    kind: input.kind,
    ticket,
    target,
    at: deps.clock.now(),
    author: await authorIdent(deps.git, change.projectRoot),
    source: active === undefined || input.kernel === true ? "kernel" : `agent:${active.role}`,
    "tree-hash": treeHash,
    tree: [...tree],
    files,
    ...(verdict === undefined ? {} : { verdict }),
    ...(input.citations.length === 0 ? {} : { citations: [...input.citations] }),
  };
  writeDocument(deps.store, path, { data, body: "" });
  return reportOf(change.projectRoot, { path, data }, false);
}

function readSources(
  deps: EvidenceDeps,
  projectRoot: string,
  cwd: string,
  given: readonly string[],
): Source[] | Refusal {
  const sources: Source[] = [];
  for (const file of given) {
    const absolute = isAbsolute(file) ? file : join(cwd, file);
    const bytes = deps.store.readBytes(absolute);
    if (bytes === undefined) {
      return refuse("input/not-found", `evidence file ${file} does not exist`, [
        "bdk evidence record <kind> <file> --ticket <ticket>",
      ]);
    }
    const name = basename(absolute);
    if (sources.some((source) => source.name === name)) {
      return refuse(
        "input/invalid-argument",
        `two evidence files are named ${name}; the Change stores them by file name`,
        ["copy one of them under another name and record both"],
      );
    }
    sources.push({
      given: file,
      path: relative(projectRoot, absolute),
      name,
      bytes,
      hash: sha256(bytes),
      text: isText(bytes),
    });
  }
  return sources;
}

/** A `pass` needs a citation unless the kernel records it; every citation must resolve (T4). */
function checkCitations(
  sources: readonly Source[],
  verdict: Verdict | undefined,
  citations: readonly string[],
  kernel: boolean,
): Refusal | undefined {
  const files = sources.map((source): CitedFile => ({
    given: source.given,
    text: source.text ? new TextDecoder().decode(source.bytes) : undefined,
  }));
  if (verdict === "pass" && citations.length === 0 && !kernel) {
    return refuse(
      "policy/missing-citation",
      `a pass verdict needs --cite naming a value in ${sources.map((source) => source.given).join(", ")}`,
      ["--cite <file>#<json-pointer>", "--cite <file>:<line>", "--cite <file>:<line>=<text>"],
    );
  }
  for (const citation of citations) {
    const problem = citationProblem(citation, files);
    if (problem !== undefined) {
      const hint = citationHint(citation, files);
      return refuse("policy/missing-citation", problem, [
        ...(hint === undefined ? [] : [`--cite ${hint}`]),
        "cite a value the recorded files hold",
        "record the verdict fail when the evidence does not show a pass",
      ]);
    }
  }
  return undefined;
}

function same(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, at) => value === b[at]);
}

function reportOf(
  projectRoot: string,
  manifest: ManifestFile,
  deduplicated: boolean,
): RecordReport {
  const data = manifest.data;
  return {
    evidence: data.id,
    path: relative(projectRoot, manifest.path),
    treeHash: data["tree-hash"],
    files: data.files,
    ...(data.verdict === undefined ? {} : { verdict: data.verdict }),
    ...(data.citations === undefined ? {} : { citations: data.citations }),
    deduplicated,
  };
}
