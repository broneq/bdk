// The run journal of an execute run (`kernel-state`, Run journal; `kernel-cli`,
// Run journal) through the built bundle: every line the run leaves validates
// against `schema/state/journal-line.json`, and the refusals and the ticket
// show up on the lines of the calls that made them.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { bdk } from "../../../tests/support/repo.ts";
import { stateValidatorFor } from "../../../tests/support/schemas.ts";
import { close, closed, dispatched, opened, started } from "./e2e-support.ts";

function journal(root: string): Record<string, unknown>[] {
  return readFileSync(join(root, ".bdk/.machine/telemetry/journal.jsonl"), "utf8")
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe("run journal of an execute run", () => {
  it("validates every line and records the refusals with their ticket and Change", () => {
    const change = started();
    const ticket = opened(change, "task-redispatch", "01-1");
    dispatched(change, ticket, "01-1");
    const refusal = close(change, ticket, "ok");
    expect(refusal.code).toBe(2);
    closed(change, ticket, "not-run", "--reason", "probe");
    expect(bdk(["part", "list", "--json"], change.root).code).toBe(0);
    expect(bdk(["atempt", "list"], change.root).code).toBe(3);

    const lines = journal(change.root);
    const validate = stateValidatorFor("journal-line");
    for (const line of lines) expect(validate(line), JSON.stringify(validate.errors)).toBe(true);

    const commands = lines.map((line) => line.command);
    expect(commands).toEqual(
      expect.arrayContaining([
        "change-new",
        "done",
        "part-start",
        "attempt-open",
        "dispatch-build",
      ]),
    );
    const rule = (refusal.json as { rule: string }).rule;
    expect(lines).toContainEqual(
      expect.objectContaining({
        kind: "command",
        command: "attempt-close",
        exit: 2,
        rule,
        ticket,
        change: change.id,
      }),
    );
    expect(lines.at(-1)).toMatchObject({
      command: "unknown",
      args: ["atempt", "list"],
      rule: "input/unknown-command",
      exit: 3,
      change: null,
    });
    for (const line of lines) expect(line.ms).toBeGreaterThanOrEqual(0);
  });
});
