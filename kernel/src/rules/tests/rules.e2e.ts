// `bdk rules show` through the committed bundle (`kernel-cli/rules`; T23-D27,
// D28): a real repository, a ticket opened by `attempt open`, the plugin's
// rule files and a project override.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { answered, bdk, refused } from "../../../tests/support/repo.ts";
import { dispatched, opened, started } from "../../attempt/tests/e2e-support.ts";
import { fileStore } from "../../shared/store/index.ts";

interface Shown {
  readonly role: string;
  readonly target: string;
  readonly sections: readonly { key: string; layers: string[]; text: string }[];
  readonly rulesRead: string;
}

function attemptText(dir: string, ticket: string): string {
  const name = fileStore()
    .list(join(dir, "attempts"))
    .find((file) => file.includes(ticket));
  if (name === undefined) throw new Error(`no attempt record for ${ticket}`);
  return readFileSync(join(dir, "attempts", name), "utf8");
}

describe("bdk rules show --ticket", () => {
  it("exit 0: the implementer's rules with the project override, stamped once", () => {
    const change = started("languages: [typescript]\n");
    fileStore().write(join(change.root, ".bdk/prompts/rules/security.md"), "- **Ours.** Rule.\n");
    const ticket = opened(change, "task-redispatch", "01-1");
    dispatched(change, ticket, "01-1");

    const first = answered(
      bdk(["rules", "show", "--ticket", ticket, "--json"], change.root),
      "output/rules-show.json",
    ) as unknown as Shown;
    expect(first.role).toBe("implementer");
    expect(first.target).toBe("01-1");
    expect(first.sections.map((section) => section.key)).toStrictEqual([
      "rules/code-quality",
      "rules/architecture",
      "rules/design-patterns",
      "rules/security",
      "rules/test-quality",
      "rules/languages/typescript",
    ]);
    const security = first.sections.find((section) => section.key === "rules/security");
    expect(security?.layers).toStrictEqual(["default", "project"]);
    expect(security?.text).toMatch(/- \*\*Ours\.\*\* Rule\.\n$/);
    expect(attemptText(change.dir, ticket)).toContain(`rules-read: ${first.rulesRead}`);

    const second = bdk(["rules", "show", "--ticket", ticket], change.root);
    expect(second.code).toBe(0);
    expect(second.stdout).toContain(`## BDK rules: ${ticket} (implementer, 01-1)`);
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

  it("exit 2 kernel/not-implemented: the id form before T31", () => {
    const change = started();
    refused(bdk(["rules", "show", "CQ-4", "--json"], change.root), 2, "kernel/not-implemented");
  });
});
