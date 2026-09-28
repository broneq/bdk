// The spec tests' repository in memory: the active Change `ID`, its deltas,
// the living specs, archived Changes with their `close` transitions and the
// decisions that resolve a conflict. The review gate is a switch.
import { join } from "node:path";

import { createConfigRegistry } from "../../shared/config/index.ts";
import { refuse } from "../../shared/refusal/index.ts";
import type { ActiveChange } from "../../shared/registry/index.ts";
import { memoryStore, writeDocument, writeEntry } from "../../shared/store/index.ts";
import type { Store } from "../../shared/store/index.ts";
import { specModule } from "../config.ts";
import { parseDelta } from "../domain/grammar.ts";
import { renderLiving } from "../use-cases/living.ts";
import type { SpecDeps } from "../use-cases/deps.ts";

const ROOT = "/work/repo";
export const ID = "2026-09-25-passwordless-login";
export const OTHER = "2026-09-24-link-lifetime";
export const GLOBAL = "/home/user/.config/bdk";
export const PURPOSE = "Signing in without a password, through a link sent by e-mail.";
const AUTHOR = "Ada <ada@example.com>";

function changeDir(id = ID, archived = false): string {
  return join(ROOT, ".bdk/changes", archived ? "archive" : "", id);
}

export const CHANGE: ActiveChange = {
  id: ID,
  dir: changeDir(),
  projectRoot: ROOT,
  branch: "feat/login",
};

export interface World {
  readonly store: Store;
  readonly deps: SpecDeps;
  /** Whether `gate:review` is done; false refuses `spec merge` without `--dry-run`. */
  review: boolean;
}

export function world(created = "2026-09-25T09:00:00.000Z"): World {
  const store = memoryStore();
  writeChange(store, ID, CHANGE.dir, created);
  const state: World = {
    store,
    review: true,
    deps: {
      store,
      settings: createConfigRegistry({ modules: [specModule], prompts: [] }),
      pluginRoot: "/plugin",
      reviewGate: () =>
        Promise.resolve(
          state.review
            ? undefined
            : refuse("policy/gate-not-ready", "gate:review is not done", ["/bdk:cr"]),
        ),
    },
  };
  return state;
}

function writeChange(store: Store, id: string, dir: string, at: string): void {
  writeDocument(store, `${dir}/change.md`, {
    data: {
      schema: 1,
      id,
      kind: "feature",
      profile: "small",
      intent: "Users log in with a one-time link.",
      source: "user",
      at,
      author: AUTHOR,
      overridden: [],
    },
    body: "",
  });
}

export function writeDelta(store: Store, capability: string, text: string, dir = CHANGE.dir): void {
  store.write(join(dir, "spec-delta", `${capability}.md`), text);
}

export function specPath(capability: string): string {
  return join(ROOT, ".bdk/specs", capability, "spec.md");
}

/** A living spec as the merge by `change` would have written it from an ADDED-only delta. */
export function writeSpec(
  store: Store,
  capability: string,
  added: string,
  change = "2026-09-01-first",
): void {
  const requirements = parseDelta(`## ADDED Requirements\n\n${added}`).added;
  store.write(
    specPath(capability),
    renderLiving(capability, { purpose: PURPOSE, requirements }, change).text,
  );
}

/** A requirement block with a statement and one scenario per name. */
export function block(
  name: string,
  scenarios: readonly string[],
  statement = "SHALL work",
): string {
  return [
    `### Requirement: ${name}`,
    "",
    `The system ${statement} for ${name.toLowerCase()}.`,
    "",
    ...scenarios.flatMap((scenario) => [
      `#### Scenario: ${scenario}`,
      "",
      `- **WHEN** ${scenario} happens`,
      "- **THEN** it is handled",
      "",
    ]),
  ].join("\n");
}

function entry(store: Store, dir: string, data: Record<string, unknown>): string {
  return writeEntry(
    store,
    dir,
    (id) => ({ schema: 1, id, status: "accepted", source: "user", author: AUTHOR, ...data }),
    "",
  ).id;
}

/** An archived Change created at `created`, closed at `closed`, with its deltas. */
export function archive(
  store: Store,
  id: string,
  times: { readonly created: string; readonly closed?: string },
  deltas: Readonly<Record<string, string>>,
): void {
  const dir = changeDir(id, true);
  writeChange(store, id, dir, times.created);
  for (const [capability, text] of Object.entries(deltas)) writeDelta(store, capability, text, dir);
  if (times.closed !== undefined) {
    entry(store, dir, {
      type: "transition",
      summary: "close done",
      at: times.closed,
      refs: ["close"],
      to: "close",
    });
  }
}

export function decide(store: Store, refs: readonly string[], supersedes?: string): string {
  return entry(store, CHANGE.dir, {
    type: "decision",
    summary: "keep our text of the requirement",
    at: "2026-09-26T10:00:00.000Z",
    refs,
    ...(supersedes === undefined ? {} : { supersedes }),
  });
}
