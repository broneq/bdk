// `bdk change resume <id>`: binds a Change to the current branch, leaves the
// parked state with a chosen option, or raises the profile (S5, R-profil).
// Every check runs before the first write.
import { changeGraph, stageResolver } from "../../graph/index.ts";
import { appendEntry, withChangeIndex } from "../../log/index.ts";
import { refuse } from "../../shared/refusal/index.ts";
import type { Refusal } from "../../shared/refusal/index.ts";
import {
  findChange,
  findProjectRoot,
  isProfile,
  listMarkers,
  profileRank,
  readMarker,
  refreshChange,
  removeMarker,
  writeMarker,
} from "../../shared/store/index.ts";
import { resumeCommand } from "../domain/change.ts";
import type { ResumeReport } from "../domain/change.ts";
import type { ChangeDeps } from "./deps.ts";
import { changeFacts } from "./facts.ts";

export interface ResumeInput {
  readonly id: string;
  /** 1-based index of the parked question's option, as typed. */
  readonly option?: string | undefined;
  readonly profile?: string | undefined;
}

export function resumeChange(
  deps: ChangeDeps,
  where: { readonly cwd: string; readonly workTree: string; readonly globalDir: string },
  input: ResumeInput,
): Promise<ResumeReport | Refusal> {
  const branch = deps.git.currentBranch(where.workTree);
  if (branch === undefined) {
    return done(
      refuse(
        "policy/detached-head",
        `HEAD is detached in ${where.workTree}; a Change binds to a branch`,
        ["git switch <branch>"],
      ),
    );
  }
  const projectRoot = findProjectRoot(deps.store, where.cwd, where.workTree);
  const location = findChange(deps.store, projectRoot, input.id);
  if (location === undefined) {
    return done(
      refuse("input/not-found", `no Change ${input.id} in ${projectRoot}`, [
        "bdk change list --all",
      ]),
    );
  }
  if (location.archived) {
    return done(
      refuse(
        "policy/invalid-transition",
        `${input.id} is archived; an archived Change is never resumed`,
        ["bdk change new <intent>"],
      ),
    );
  }
  const bound = readMarker(deps.store, projectRoot, branch);
  const other =
    bound === undefined || bound === input.id
      ? undefined
      : findChange(deps.store, projectRoot, bound);
  if (other !== undefined && !other.archived) {
    return done(
      refuse("policy/change-exists", `branch ${branch} is bound to the active Change ${other.id}`, [
        "switch to another branch, then resume there",
        "bdk change park",
      ]),
    );
  }
  const change = { id: input.id, dir: location.dir, projectRoot, branch };

  return withChangeIndex(deps, change, async (index) => {
    const facts = changeFacts(index, change.id, stageResolver(deps));
    const options = facts.parked?.options ?? [];

    let chosen: string | undefined;
    if (facts.parked !== undefined) {
      if (input.option === undefined) {
        return refuse(
          "policy/invalid-transition",
          `${change.id} is parked on ${facts.parked.id}; choose an option`,
          [resumeCommand(change.id), "bdk change status"],
        );
      }
      const n = Number(input.option);
      if (!Number.isInteger(n) || n < 1 || n > options.length) {
        return refuse(
          "input/invalid-argument",
          `--option ${input.option} is outside 1..${options.length}`,
          [resumeCommand(change.id)],
        );
      }
      chosen = options[n - 1];
    } else if (input.option !== undefined) {
      return refuse(
        "policy/invalid-transition",
        `${change.id} is not parked; --option has nothing to choose`,
        [`bdk change resume ${change.id}`],
      );
    }

    let raise: string | undefined;
    if (input.profile !== undefined && isProfile(input.profile)) {
      const requested = profileRank(input.profile);
      const current = profileRank(facts.profile);
      if (requested < current) {
        return refuse(
          "policy/profile-downgrade",
          `${change.id} runs at profile ${facts.profile}; a profile never goes down`,
          [`bdk change resume ${change.id}`],
        );
      }
      if (requested > current) raise = input.profile;
    }

    const others = listMarkers(deps.store, projectRoot).filter(
      (marker) => marker.change === change.id && marker.branch !== branch,
    );
    const rebind = bound !== change.id;
    if (!rebind && chosen === undefined && input.profile === undefined) {
      return refuse(
        "policy/invalid-transition",
        `${change.id} is already bound to ${branch} and not parked`,
        ["bdk change status"],
      );
    }

    let decision: string | undefined;
    if (chosen !== undefined && facts.parked !== undefined) {
      const written = await appendEntry(
        deps,
        change,
        index,
        {
          type: "decision",
          summary: chosen,
          status: "accepted",
          refs: [facts.parked.id],
          body: "",
        },
        { dedupe: false },
      );
      if ("refused" in written) return written;
      decision = written.entry.id;
    }
    if (raise !== undefined) {
      const written = await appendEntry(
        deps,
        change,
        index,
        {
          type: "decision",
          summary: `Profile raised to ${raise} at change resume`,
          status: "accepted",
          refs: ["change.md"],
          body: "",
          profile: raise,
        },
        { dedupe: false },
      );
      if ("refused" in written) return written;
      decision ??= written.entry.id;
    }
    if (rebind) {
      for (const marker of others) removeMarker(deps.store, projectRoot, marker.branch);
      writeMarker(deps.store, projectRoot, branch, change.id);
    }
    const resumedFrom =
      chosen !== undefined
        ? "parked"
        : !rebind
          ? undefined
          : others.length > 0
            ? "other-branch"
            : "other-machine";
    refreshChange(index, { id: change.id, dir: change.dir, archived: false });
    // Settings the graph refuses leave `next` out here and answer on `bdk next`.
    const graph = await changeGraph(deps, change, index, where.globalDir);
    const next = "refused" in graph ? undefined : graph.next;
    return {
      change: change.id,
      branch,
      stage: facts.stage,
      ...(next === undefined ? {} : { next }),
      ...(resumedFrom === undefined ? {} : { resumedFrom }),
      ...(decision === undefined ? {} : { decision }),
    };
  });
}

function done<T>(value: T): Promise<T> {
  return Promise.resolve(value);
}
