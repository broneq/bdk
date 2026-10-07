// The tool group states through the committed bundle in real repositories
// (`kernel-pipeline`, Tool group nodes; T49): an unset group refused at
// `change new` with its fix, and a declared-none lint that a part closes
// without, named as not used by `change status`.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { answered, bdk, refused, repository } from "../../../tests/support/repo.ts";
import {
  checkedIn,
  closed,
  conformed,
  dispatched,
  opened,
  started,
  tasksCommitted,
} from "../../attempt/tests/e2e-support.ts";

const LINT_NONE =
  'tools:\n  test:\n    - { id: unit, tier: fast, command: "true" }\n  lint: none\n';

describe("tool group states", () => {
  it("exit 2 policy/tools-unset: change new names the unset group and its fixes", () => {
    const root = repository({
      ".bdk/settings.yaml":
        "tools:\n  test:\n    - { id: unit, tier: fast, command: vitest run }\n",
    });
    writeFileSync(join(root, ".xdg", "bdk", "settings.yaml"), "");

    const result = refused(
      bdk(["change", "new", "Add dark mode", "--json"], root),
      2,
      "policy/tools-unset",
    );
    expect(result.why).toMatch(/^tools\.lint is unset: the Change runs lint and lint-full; /);
    expect(result.instead).toStrictEqual([
      "bdk config set tools.lint.<id> '{tier: lint, command: <command>}'",
      "bdk config set tools.lint none",
      "/bdk:setup",
    ]);
    // Only the run journal under the never-committed `.machine/` records the refusal.
    expect(readdirSync(join(root, ".bdk"))).toStrictEqual([".machine", "settings.yaml"]);
    expect(readdirSync(join(root, ".bdk", ".machine"))).toStrictEqual(["telemetry"]);
  });

  it("exit 0: with lint declared none a part closes without a lint manifest", () => {
    const change = started(LINT_NONE);
    const ticket = opened(change, "part", "01");
    const implementer = dispatched(change, ticket, "01");
    const checks = readFileSync(join(change.root, implementer), "utf8");
    expect(checks).toMatch(/^### tests-scoped/m);
    expect(checks).not.toMatch(/^### lint/m);
    tasksCommitted(change, ticket, "01");
    conformed(change, ticket);
    checkedIn(change, ticket, "01");
    closed(change, ticket, "ok");

    const kinds = readdirSync(join(change.dir, "evidence"))
      .filter((name) => name.endsWith(".md"))
      .map(
        (name) =>
          /^kind: (.+)$/m.exec(readFileSync(join(change.dir, "evidence", name), "utf8"))?.[1],
      )
      .filter((kind) => kind !== undefined);
    expect([...new Set(kinds)].sort()).toStrictEqual(["conform", "tests-scoped"]);

    const status = answered(
      bdk(["change", "status", "--json"], change.root),
      "output/change-status.json",
    );
    expect(status.tools).toStrictEqual({ test: "configured", lint: "none" });
    const nodes = status.nodes as { id: string; state: string; why?: string }[];
    expect(nodes.find((node) => node.id === "lint-full")).toMatchObject({
      state: "skipped",
      why: expect.stringContaining("tools.lint is none") as unknown,
    });
    expect(bdk(["change", "status"], change.root).stdout).toContain(
      "tools: lint not used (tools.lint is none)\n",
    );
  });
});
