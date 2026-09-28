// A repository in memory for the dispatch tests: the graph harness's Change
// and plugin files plus the shipped role skills and plugin manifest, a plan
// part `02` whose task `02-3` is the usual target, and an open ticket on it.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { withPluginFiles, writePlanPart } from "../../graph/tests/support.ts";
import { logRegistrations } from "../../log/index.ts";
import { AUTHOR, DIR, fakeGit, repository, runBdk } from "../../log/tests/support.ts";
import type { RunResult } from "../../log/tests/support.ts";
import { settingsRegistry } from "../../registrations.ts";
import { fixedClock } from "../../shared/clock/index.ts";
import { memoryIndex, writeDocument } from "../../shared/store/index.ts";
import type { Store } from "../../shared/store/index.ts";
import { dispatchRegistrations } from "../index.ts";
import type { DispatchDeps } from "../index.ts";

export { DIR };
export const PLUGIN = "/plugins/bdk";
export const TICKET = "A-7f3k9m2q";
const AT = "2026-09-25T10:05:00Z";
const REPO = join(import.meta.dirname, "../../../..");

const TASKS =
  "## 02-1 Store the token\n\n**Files:**\n\n- Create: `src/auth/store.ts`\n\n**Test cases:**\n\n- stores a token\n\n" +
  "## 02-3 Verify the link\n\n**Files:**\n\n- Create: `src/auth/verify.ts`\n- Test: `src/auth/verify.test.ts`\n\n**Test cases:**\n\n- rejects an expired link\n\n**Stop rule:** stop when the token format is unclear\n";

/** The plugin files the dispatch commands read, the role skills and the manifest included. */
function withDispatchPlugin(store: Store): Store {
  withPluginFiles(store);
  for (const role of readdirSync(join(REPO, "skills/roles"))) {
    const path = join("skills/roles", role, "SKILL.md");
    store.write(`${PLUGIN}/${path}`, readFileSync(join(REPO, path), "utf8"));
  }
  store.write(`${PLUGIN}/.claude-plugin/plugin.json`, '{"name":"bdk","version":"3.0.0"}\n');
  return store;
}

export function ticket(
  store: Store,
  fields: { target?: string; loop?: string; closed?: boolean; id?: string } = {},
): void {
  const target = fields.target ?? "02-3";
  const loop = fields.loop ?? "task-redispatch";
  const id = fields.id ?? TICKET;
  writeDocument(store, `${DIR}/attempts/${loop}-${target}-${id}.md`, {
    data: {
      schema: 1,
      ticket: id,
      loop,
      target,
      attempt: 1,
      of: 3,
      scope: "full",
      "opened-at": "2026-09-25T10:00:00Z",
      author: AUTHOR,
      ...(fields.closed === true ? { "closed-at": "2026-09-25T10:30:00Z", outcome: "ok" } : {}),
    },
    body: "",
  });
}

export interface DispatchHarness {
  readonly store: Store;
  run(argv: readonly string[], at?: string): Promise<RunResult>;
}

/** Part 02 with TASKS, `do-not-touch: src/billing/**`, and an open ticket on 02-3. */
export function dispatchHarness(store = withDispatchPlugin(repository())): DispatchHarness {
  writePlanPart(store, "02", { body: TASKS, doNotTouch: ["src/billing/**"] });
  ticket(store);
  const git = fakeGit();
  return {
    store,
    run: (argv, at = AT) => {
      const deps: DispatchDeps = {
        store,
        git,
        openIndex: memoryIndex,
        clock: fixedClock(at),
        pluginRoot: PLUGIN,
        settings: settingsRegistry(),
      };
      return runBdk([...dispatchRegistrations(deps), ...logRegistrations(deps)], store, git, argv);
    },
  };
}

export const build = (h: DispatchHarness, ...argv: string[]) =>
  h.run([
    "dispatch",
    "build",
    ...(argv.length === 0 ? ["02-3", "implementer", TICKET] : argv),
    "--json",
  ]);
