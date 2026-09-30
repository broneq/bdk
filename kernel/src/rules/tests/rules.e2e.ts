// `bdk rules show` through the committed bundle (`kernel-cli/rules`; T23-D27,
// D28, T31): a real repository, a ticket opened by `attempt open` and built
// by `dispatch build`, and the project's rule files.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { answered, bdk, refused } from "../../../tests/support/repo.ts";
import { dispatched, opened, started } from "../../attempt/tests/e2e-support.ts";
import { fileStore } from "../../shared/store/index.ts";

interface Shown {
  readonly role: string;
  readonly target: string;
  readonly rules: readonly { id: string; matchedBy: string | null; text: string }[];
  readonly truncated: number;
  readonly rulesRead: string;
}

function projectRule(id: string, extra = ""): string {
  return `---\nschema: 1\nid: ${id}\nkind: house\nseverity: medium\norigin: user\nsince: 2026-09-30\n${extra}---\n\nText of ${id}.\n`;
}

function attemptText(dir: string, ticket: string): string {
  const name = fileStore()
    .list(join(dir, "attempts"))
    .find((file) => file.includes(ticket));
  if (name === undefined) throw new Error(`no attempt record for ${ticket}`);
  return readFileSync(join(dir, "attempts", name), "utf8");
}

describe("bdk rules show --ticket", () => {
  it("exit 0: the rules the package stamped, in its order, stamped read once", () => {
    const change = started("languages: [typescript]\n");
    fileStore().write(join(change.root, ".bdk/rules/NAMING-1.md"), projectRule("NAMING-1"));
    fileStore().write(
      join(change.root, ".bdk/rules/UI-1.md"),
      projectRule("UI-1", "applies: [web/**]\n"),
    );
    const ticket = opened(change, "task-redispatch", "01-1");
    dispatched(change, ticket, "01-1");

    const first = answered(
      bdk(["rules", "show", "--ticket", ticket, "--json"], change.root),
      "output/rules-show.json",
    ) as unknown as Shown;
    expect(first.role).toBe("implementer");
    expect(first.target).toBe("01-1");
    const ids = first.rules.map((rule) => rule.id);
    expect(ids).toContain("NAMING-1");
    expect(ids).not.toContain("UI-1");
    expect(first.rules.find((rule) => rule.id === "NAMING-1")).toMatchObject({
      matchedBy: null,
      text: "Text of NAMING-1.",
    });
    expect(first.truncated).toBe(0);
    expect(attemptText(change.dir, ticket)).toContain(`rules-read: ${first.rulesRead}`);

    const second = bdk(["rules", "show", "--ticket", ticket], change.root);
    expect(second.code).toBe(0);
    expect(second.stdout).toContain(`## BDK rules: ${ticket} (implementer, 01-1)`);
    expect(second.stdout).toContain("- [NAMING-1] Text of NAMING-1.");
    expect(attemptText(change.dir, ticket)).toContain(`rules-read: ${first.rulesRead}`);
  });

  it("exit 3 input/not-found: a ticket the Change does not hold", () => {
    const change = started();
    refused(
      bdk(["rules", "show", "--ticket", "A-00000000", "--json"], change.root),
      3,
      "input/not-found",
    );
  });

  it("exit 2 policy/no-open-ticket: an open ticket without a package", () => {
    const change = started();
    const ticket = opened(change, "task-redispatch", "01-1");
    refused(
      bdk(["rules", "show", "--ticket", ticket, "--json"], change.root),
      2,
      "policy/no-open-ticket",
    );
    expect(attemptText(change.dir, ticket)).not.toContain("rules-read");
  });

  it("exit 0: the id form prints one rule, a tombstone included", () => {
    const change = started();
    fileStore().write(
      join(change.root, ".bdk/rules/API-2.md"),
      projectRule("API-2", "removed: superseded by API-5\n"),
    );
    const shown = answered(
      bdk(["rules", "show", "API-2", "--json"], change.root),
      "output/rules-show.json",
    );
    expect(shown).toMatchObject({ id: "API-2", removed: "superseded by API-5", disabled: false });
    refused(bdk(["rules", "show", "API-9", "--json"], change.root), 3, "input/not-found");
  });
});
