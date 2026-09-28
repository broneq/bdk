// The attempt E2E fixtures through the committed bundle: a tiny Change in a
// real repository with part 01 started, the attempt commands, and the dispatch
// package and report envelope T23 will build, written by hand until then.
import { join } from "node:path";
import { expect } from "vitest";

import { answered, bdk, repository } from "../../../tests/support/repo.ts";
import { fileStore, writeDocument } from "../../shared/store/index.ts";

export interface Started {
  readonly root: string;
  readonly dir: string;
  readonly id: string;
}

/** `count` tasks `<nn>-1`.. in the plan task grammar. */
export function tasks(nn: string, count: number): string {
  return Array.from({ length: count }, (_, at) => {
    const k = String(at + 1);
    return `## ${nn}-${k} Task ${k}\n\n**Files:**\n\n- \`src/${nn}-${k}.ts\`\n\n**Test cases:**\n\n- works\n`;
  }).join("\n");
}

/**
 * A tiny Change with part 01 (tasks 01-1, 01-2; do-not-touch `src/billing/**`)
 * started and part 02 after it; `settings` is the project settings file.
 */
export function started(settings = ""): Started {
  const root = repository(settings === "" ? {} : { ".bdk/settings.yaml": settings });
  const result = bdk(
    ["change", "new", "Fix the login typo", "--profile", "tiny", "--reason", "a typo", "--json"],
    root,
  );
  expect(result.code, result.stdout).toBe(0);
  const id = (result.json as { change: string }).change;
  const dir = join(root, ".bdk/changes", id);
  const part = (nn: string, body: string, fields: string) => {
    fileStore().write(
      join(dir, `plan/parts/${nn}-part.md`),
      `---\nschema: 1\nid: "${nn}"\ntitle: Part ${nn}\ngoal: g\nsuccess-measure: m\n${fields}spec-impact: none\n---\n${body}`,
    );
  };
  part("01", tasks("01", 2), 'do-not-touch: ["src/billing/**"]\ndepends-on: []\n');
  part("02", tasks("02", 1), 'do-not-touch: []\ndepends-on: ["01"]\n');
  answered(bdk(["done", "plan", "--json"], root), "output/done.json");
  answered(bdk(["part", "start", "01", "--json"], root), "output/part-start.json");
  return { root, dir, id };
}

export function open(change: Started, loop: string, target: string, ...flags: string[]) {
  return bdk(["attempt", "open", loop, target, ...flags, "--json"], change.root);
}

export function opened(change: Started, loop: string, target: string, ...flags: string[]): string {
  return answered(open(change, loop, target, ...flags), "output/attempt-open.json")
    .ticket as string;
}

export function close(change: Started, ticket: string, outcome: string, ...flags: string[]) {
  return bdk(["attempt", "close", ticket, outcome, ...flags, "--json"], change.root);
}

export function closed(change: Started, ticket: string, outcome: string, ...flags: string[]) {
  return answered(close(change, ticket, outcome, ...flags), "output/attempt-close.json");
}

/** The dispatch package T23 will build, so `log add --ticket` finds the role. */
export function dispatched(change: Started, ticket: string, target: string): void {
  writeDocument(fileStore(), join(change.dir, `dispatch/${target}-implementer-${ticket}.md`), {
    data: {
      schema: 1,
      ticket,
      target,
      role: "implementer",
      attempt: 1,
      of: 3,
      scope: "full",
      at: "2026-09-25T10:00:00Z",
      "kernel-version": "3.0.0",
      "template-hash": `sha256:${"0".repeat(64)}`,
      report: `.bdk/changes/${change.id}/reports/${target}-implementer-${ticket}.md`,
    },
    body: "",
  });
}

export function logUnder(change: Started, ticket: string, summary: string, ref: string): string {
  const result = bdk(
    ["log", "add", "finding", summary, "--ref", ref, "--ticket", ticket, "--json"],
    change.root,
  );
  return (answered(result, "output/log-add.json").entry as { id: string }).id;
}

/** The report envelope declaring `entries`; its path relative to the project root. */
export function envelope(change: Started, ticket: string, entries: string[]): string {
  const file = `reports/01-1-implementer-${ticket}.md`;
  writeDocument(fileStore(), join(change.dir, file), {
    data: {
      schema: 1,
      ticket,
      role: "implementer",
      status: "done",
      files: ["src/01-1.ts"],
      entries,
      evidence: [],
    },
    body: "",
  });
  return `.bdk/changes/${change.id}/${file}`;
}
