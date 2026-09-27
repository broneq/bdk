// `bdk change new <intent>`: opens a Change on the current branch. Every
// check runs before the first write; the profile is recorded as the caller
// passed it (design D-11 of T20), `small` by default.
import { join } from "node:path";

import { appendEntry } from "../../log/index.ts";
import { globalDir, overriddenKeys, resolveConfig } from "../../shared/config/index.ts";
import type { Environment } from "../../shared/config/index.ts";
import { authorIdent } from "../../shared/git/index.ts";
import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import {
  ensureIgnored,
  findChange,
  findProjectRoot,
  liveChangeDir,
  readMarker,
  refreshChange,
  withIndex,
  writeDocument,
  writeMarker,
} from "../../shared/store/index.ts";
import { changeIdOf } from "../domain/change.ts";
import type { NewReport } from "../domain/change.ts";
import type { ChangeDeps } from "./deps.ts";

export interface NewInput {
  readonly intent: string;
  readonly kind: "feature" | "bug";
  readonly profile?: string | undefined;
  readonly reason?: string | undefined;
  readonly inferred: boolean;
}

export interface Where {
  readonly cwd: string;
  readonly workTree: string;
  readonly environment: Environment;
}

const DEFAULTED_SUMMARY = "Profile small by default: no size decision taken at change new";
const DEFAULTED_BODY = "Recorded by change new: the caller passed no --profile.\n";

export async function newChange(
  deps: ChangeDeps,
  where: Where,
  input: NewInput,
): Promise<NewReport | Refusal> {
  if (input.profile === "tiny" && (input.reason ?? "").trim() === "") {
    return refuse(
      "input/missing-argument",
      "--profile tiny needs --reason: every skipped design carries its justification",
      [
        `bdk change new "${input.intent}" --profile tiny --reason "<why the change is trivial>"`,
        `bdk change new "${input.intent}"`,
      ],
    );
  }
  if (input.intent.trim() === "") {
    return refuse("input/invalid-argument", "<intent> is empty", [
      'bdk change new "<one sentence>"',
    ]);
  }
  const branch = deps.git.currentBranch(where.workTree);
  if (branch === undefined) {
    return refuse(
      "policy/detached-head",
      `HEAD is detached in ${where.workTree}; a Change binds to a branch`,
      ["git switch -c <branch>"],
    );
  }
  const projectRoot = findProjectRoot(deps.store, where.cwd, where.workTree);
  const bound = readMarker(deps.store, projectRoot, branch);
  const active = bound === undefined ? undefined : findChange(deps.store, projectRoot, bound);
  if (active !== undefined && !active.archived) {
    return refuse(
      "policy/change-exists",
      `branch ${branch} already has the active Change ${active.id}`,
      ["bdk change status", "switch to a new branch and run change new there"],
    );
  }
  const at = deps.clock.now();
  const id = changeIdOf(at, input.intent);
  const existing = findChange(deps.store, projectRoot, id);
  if (existing !== undefined || deps.store.exists(liveChangeDir(projectRoot, id))) {
    return refuse(
      "policy/change-exists",
      `the Change directory .bdk/changes/${existing?.archived === true ? "archive/" : ""}${id}/ exists`,
      ["bdk change new with a more specific intent", `bdk change resume ${id}`],
    );
  }

  const author = await authorIdent(deps.git, projectRoot);
  const resolution = resolveConfig({
    store: deps.store,
    registry: deps.settings,
    globalDir: globalDir(where.environment),
    projectRoot,
    pluginRoot: deps.pluginRoot,
  });
  const overridden = overriddenKeys(resolution);
  await ensureIgnored(deps.store, deps.git, projectRoot);

  const dir = liveChangeDir(projectRoot, id);
  const profile = input.profile ?? "small";
  writeDocument(deps.store, join(dir, "change.md"), {
    data: {
      schema: 1,
      id,
      kind: input.kind,
      profile,
      intent: input.intent,
      source: input.inferred ? "inferred" : "user",
      at,
      author,
      overridden,
    },
    body: "",
  });
  const change = { id, dir, projectRoot, branch };
  const entry = await withIndex(deps.openIndex, deps.store, projectRoot, (index) => {
    refreshChange(index, { id, dir, archived: false });
    return appendEntry(
      deps,
      change,
      index,
      {
        type: "assumption",
        summary:
          input.profile === undefined ? DEFAULTED_SUMMARY : `Profile ${profile} set at change new`,
        refs: ["change.md"],
        body: input.profile === undefined ? DEFAULTED_BODY : reasonBody(input.reason),
      },
      { dedupe: false },
    );
  });
  if ("refused" in entry) return entry;
  writeMarker(deps.store, projectRoot, branch, id);
  return {
    change: id,
    branch,
    kind: input.kind,
    profile: { value: profile, defaulted: input.profile === undefined, entry: entry.entry.id },
    source: input.inferred ? "inferred" : "user",
    overriddenKeys: overridden,
  };
}

function reasonBody(reason: string | undefined): string {
  const text = (reason ?? "").trim();
  return text === "" ? "Set by the caller of change new; no reason given.\n" : `${text}\n`;
}
