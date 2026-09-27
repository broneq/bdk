// A repository in memory for the graph tests: the log slice's Change bound to
// `feat/login`, the shipped plugin files (pipeline, templates, rules) copied
// under PLUGIN, and a harness running the graph, change and log commands
// through the real registry at a chosen time.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { changeRegistrations } from "../../change/index.ts";
import { logRegistrations } from "../../log/index.ts";
import {
  CHANGE,
  DIR,
  fakeGit,
  repository,
  ROOT,
  runBdk,
  sequentialRandom,
} from "../../log/tests/support.ts";
import type { FakeGit, RunResult } from "../../log/tests/support.ts";
import { settingsRegistry } from "../../registrations.ts";
import { fixedClock } from "../../shared/clock/index.ts";
import type { ConfigRegistry } from "../../shared/config/index.ts";
import { memoryIndex, writeDocument } from "../../shared/store/index.ts";
import type { Store } from "../../shared/store/index.ts";
import type { KindRegistry } from "../domain/kinds/index.ts";
import { graphRegistrations } from "../index.ts";
import type { GraphDeps } from "../index.ts";

export { DIR, ROOT };

export const PLUGIN = "/plugins/bdk";
const REPO = join(import.meta.dirname, "../../../..");

/** Copies the shipped plugin files a graph command reads into `store` under PLUGIN. */
export function withPluginFiles(store: Store): Store {
  for (const dir of ["pipeline", "rules", "fragments/decision"]) {
    for (const name of readdirSync(join(REPO, dir))) {
      if (!/\.(md|yaml)$/.test(name)) continue;
      store.write(`${PLUGIN}/${dir}/${name}`, readFileSync(join(REPO, dir, name), "utf8"));
    }
  }
  return store;
}

export interface Harness {
  readonly store: Store;
  readonly git: FakeGit;
  /** Runs `bdk <argv>` with the clock at `at`. */
  run(argv: readonly string[], at?: string): Promise<RunResult>;
}

export interface HarnessOptions {
  readonly kinds?: KindRegistry;
  readonly settings?: ConfigRegistry;
  readonly store?: Store;
}

export function harness(options: HarnessOptions = {}): Harness {
  const store = options.store ?? withPluginFiles(repository());
  const git = fakeGit();
  const random = sequentialRandom();
  return {
    store,
    git,
    run: (argv, at = "2026-09-25T10:00:00Z") => {
      const deps: GraphDeps = {
        store,
        git,
        openIndex: memoryIndex,
        clock: fixedClock(at),
        random,
        pluginRoot: PLUGIN,
        settings: options.settings ?? settingsRegistry(),
        ...(options.kinds === undefined ? {} : { kinds: options.kinds }),
      };
      return runBdk(
        [...graphRegistrations(deps), ...changeRegistrations(deps), ...logRegistrations(deps)],
        store,
        git,
        argv,
      );
    },
  };
}

/** Sets the base profile and kind of the test Change in its `change.md`. */
export function setChange(store: Store, fields: { profile?: string; kind?: string }): void {
  writeDocument(store, `${DIR}/change.md`, {
    data: {
      schema: 1,
      id: CHANGE,
      kind: fields.kind ?? "feature",
      profile: fields.profile ?? "small",
      intent: "Users log in with a one-time link.",
      source: "user",
      at: "2026-09-25T09:00:00Z",
      author: "Ada Lovelace <ada@example.com>",
      overridden: [],
    },
    body: "",
  });
}

export function writeDesign(
  store: Store,
  name: "design" | "architecture",
  body = "Text.\n",
  extra = "",
): void {
  store.write(`${DIR}/${name}.md`, `---\nschema: 1\ntitle: ${name}\n${extra}---\n${body}`);
}

export function writePlanPart(
  store: Store,
  nn: string,
  fields: { dependsOn?: readonly string[]; specImpact?: string } = {},
): void {
  const dependsOn = `[${(fields.dependsOn ?? []).map((id) => `"${id}"`).join(", ")}]`;
  store.write(
    `${DIR}/plan/parts/${nn}-part.md`,
    `---\nschema: 1\nid: "${nn}"\ntitle: Part ${nn}\ngoal: g\nsuccess-measure: m\ndo-not-touch: []\ndepends-on: ${dependsOn}\nspec-impact: ${fields.specImpact ?? "none"}\n---\nTasks.\n`,
  );
}

export function writeDesignPart(store: Store, nn: string): void {
  store.write(
    `${DIR}/design/parts/${nn}-part.md`,
    `---\nschema: 1\nid: "${nn}"\ntitle: Part ${nn}\ndepends-on: []\n---\nText.\n`,
  );
}

let counter = 0;

/** Writes a ledger entry file the way a fixture or a hook would. */
export function writeEntry(
  store: Store,
  fields: Readonly<Record<string, unknown>> & { type: string; at: string },
): string {
  counter += 1;
  const id = `L-f${String(counter).padStart(7, "0")}`;
  const stamp = fields.at.replaceAll("-", "").replaceAll(":", "");
  writeDocument(store, `${DIR}/log/${stamp}-${fields.type}-${id}.md`, {
    data: {
      schema: 1,
      id,
      summary: `${fields.type} fixture`,
      status: "accepted",
      source: "user",
      author: "Ada Lovelace <ada@example.com>",
      refs: ["change.md"],
      ...fields,
    },
    body: "",
  });
  return id;
}

/** A user transition passing `gate` at `at`. */
export function passGate(
  store: Store,
  gate: string,
  to: string,
  at: string,
  source = "user",
): string {
  return writeEntry(store, { type: "transition", at, gate, to, source, refs: [gate] });
}
