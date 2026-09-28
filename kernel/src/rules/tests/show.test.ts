// `bdk rules show --ticket` (`kernel-cli/rules`; T23-D27, D28) through the
// registry on a memory store with the in-memory index: selection by role,
// project overrides, the `rules-read` stamp and the refusals.
import { describe, expect, it } from "vitest";

import { fixedClock } from "../../shared/clock/index.ts";
import { settingsRegistry } from "../../registrations.ts";
import { memoryIndex, readAttempts, writeDocument } from "../../shared/store/index.ts";
import type { Store } from "../../shared/store/index.ts";
import { AUTHOR, CHANGE, DIR, fakeGit, repository, ROOT, runBdk } from "../../log/tests/support.ts";
import { rulesRegistrations } from "../index.ts";
import { rulesShowOutput } from "../schema/show.ts";

const PLUGIN = "/plugin";
const FIRST = "2026-09-25T10:00:41.000Z";
const LATER = "2026-09-25T10:09:00.000Z";

const RULE_FILES = [
  "code-quality",
  "architecture",
  "design-patterns",
  "security",
  "engineering-judgment",
  "test-quality",
  "languages/typescript",
  "languages/react",
];

function withPlugin(store: Store): Store {
  for (const name of RULE_FILES) {
    store.write(`${PLUGIN}/rules/${name}.md`, `# ${name}\n\n- **Default.** Plugin text.\n`);
  }
  store.write(`${ROOT}/.bdk/settings.yaml`, "languages: [typescript, react]\n");
  return store;
}

function ticket(store: Store, id: string, role: string | undefined, closed = false): void {
  writeDocument(store, `${DIR}/attempts/task-redispatch-02-3-${id}.md`, {
    data: {
      schema: 1,
      ticket: id,
      loop: "task-redispatch",
      target: "02-3",
      attempt: 1,
      of: 3,
      scope: "full",
      "opened-at": "2026-09-25T10:00:00.000Z",
      author: AUTHOR,
      ...(closed ? { "closed-at": "2026-09-25T10:30:00.000Z", outcome: "ok" } : {}),
    },
    body: "",
  });
  if (role === undefined) return;
  writeDocument(store, `${DIR}/dispatch/02-3-${role}-${id}.md`, {
    data: {
      schema: 1,
      ticket: id,
      target: "02-3",
      role,
      adapter: role === "implementer" ? "worker" : "reader",
      attempt: 1,
      of: 3,
      scope: "full",
      at: "2026-09-25T10:00:01.000Z",
      "kernel-version": "3.0.0-dev",
      "template-hash": `sha256:${"a".repeat(64)}`,
      report: `.bdk/changes/${CHANGE}/reports/02-3-${role}-${id}.md`,
    },
    body: "",
  });
}

function run(store: Store, argv: readonly string[], at = FIRST) {
  const deps = {
    store,
    git: fakeGit(),
    openIndex: memoryIndex,
    clock: fixedClock(at),
    pluginRoot: PLUGIN,
    settings: settingsRegistry(),
  };
  return runBdk(rulesRegistrations(deps), store, deps.git, argv);
}

const keysOf = (json: unknown) => rulesShowOutput.parse(json).sections.map((s) => s.key);

describe("rules show --ticket", () => {
  it("prints the implementer's five categories, then the language rules, and stamps rules-read", async () => {
    const store = withPlugin(repository());
    ticket(store, "A-7f3k9m2q", "implementer");
    const result = await run(store, ["rules", "show", "--ticket", "A-7f3k9m2q", "--json"]);
    expect(result.code).toBe(0);
    const output = rulesShowOutput.parse(result.json);
    expect(output).toMatchObject({
      ticket: "A-7f3k9m2q",
      role: "implementer",
      target: "02-3",
      rulesRead: FIRST,
    });
    expect(keysOf(result.json)).toStrictEqual([
      "rules/code-quality",
      "rules/architecture",
      "rules/design-patterns",
      "rules/security",
      "rules/test-quality",
      "rules/languages/typescript",
      "rules/languages/react",
    ]);
    expect(output.sections[0]).toStrictEqual({
      key: "rules/code-quality",
      file: "rules/code-quality.md",
      layers: ["default"],
      text: "# code-quality\n\n- **Default.** Plugin text.\n",
    });
    expect(readAttempts(store, DIR)[0]?.data["rules-read"]).toBe(FIRST);
  });

  it("prints the verifier's three categories without language rules", async () => {
    const store = withPlugin(repository());
    ticket(store, "A-9c2d4f6h", "verifier");
    const result = await run(store, ["rules", "show", "--ticket", "A-9c2d4f6h", "--json"]);
    expect(keysOf(result.json)).toStrictEqual([
      "rules/architecture",
      "rules/test-quality",
      "rules/engineering-judgment",
    ]);
  });

  it("prints the implementer's categories and language rules for a simplifier", async () => {
    const store = withPlugin(repository());
    ticket(store, "A-s1m2p3l4", "simplifier");
    const result = await run(store, ["rules", "show", "--ticket", "A-s1m2p3l4", "--json"]);
    expect(result.code).toBe(0);
    ticket(store, "A-i1m2p3l4", "implementer");
    const implementer = await run(store, ["rules", "show", "--ticket", "A-i1m2p3l4", "--json"]);
    expect(keysOf(result.json)).toStrictEqual(keysOf(implementer.json));
    expect(keysOf(result.json)).toContain("rules/languages/typescript");
  });

  it("prints no section for a runner", async () => {
    const store = withPlugin(repository());
    ticket(store, "A-r2n4t6m8", "runner");
    const result = await run(store, ["rules", "show", "--ticket", "A-r2n4t6m8", "--json"]);
    expect(result.code).toBe(0);
    expect(keysOf(result.json)).toStrictEqual([]);
  });

  it("applies a project override and lists its layer", async () => {
    const store = withPlugin(repository());
    store.write(`${ROOT}/.bdk/prompts/rules/security.md`, "- **Project.** Our rule.\n");
    ticket(store, "A-7f3k9m2q", "implementer");
    const result = await run(store, ["rules", "show", "--ticket", "A-7f3k9m2q", "--json"]);
    const security = rulesShowOutput
      .parse(result.json)
      .sections.find((section) => section.key === "rules/security");
    expect(security).toStrictEqual({
      key: "rules/security",
      file: "rules/security.md",
      layers: ["default", "project"],
      text: "# security\n\n- **Default.** Plugin text.\n\n- **Project.** Our rule.\n",
    });
  });

  it("keeps the first rules-read time on a second call", async () => {
    const store = withPlugin(repository());
    ticket(store, "A-7f3k9m2q", "implementer");
    await run(store, ["rules", "show", "--ticket", "A-7f3k9m2q"], FIRST);
    const second = await run(store, ["rules", "show", "--ticket", "A-7f3k9m2q", "--json"], LATER);
    expect(rulesShowOutput.parse(second.json).rulesRead).toBe(FIRST);
    expect(readAttempts(store, DIR)[0]?.data["rules-read"]).toBe(FIRST);
  });

  it("prints each section under its key in text mode", async () => {
    const store = withPlugin(repository());
    ticket(store, "A-9c2d4f6h", "verifier");
    const result = await run(store, ["rules", "show", "--ticket", "A-9c2d4f6h"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("## BDK rules: A-9c2d4f6h (verifier, 02-3)");
    expect(result.stdout).toContain("### rules/architecture\n\n# architecture\n");
  });

  it("refuses a ticket the Change does not hold with input/not-found", async () => {
    const store = withPlugin(repository());
    const result = await run(store, ["rules", "show", "--ticket", "A-00000000", "--json"]);
    expect(result.code).toBe(3);
    expect(result.json).toMatchObject({ rule: "input/not-found" });
  });

  it.each([
    ["closed", true, "implementer"],
    ["without a package", false, undefined],
  ])("refuses a ticket %s with policy/no-open-ticket", async (_, closed, role) => {
    const store = withPlugin(repository());
    ticket(store, "A-7f3k9m2q", role, closed);
    const result = await run(store, ["rules", "show", "--ticket", "A-7f3k9m2q", "--json"]);
    expect(result.code).toBe(2);
    expect(result.json).toMatchObject({ rule: "policy/no-open-ticket" });
    expect(readAttempts(store, DIR)[0]?.data["rules-read"]).toBeUndefined();
  });

  it("answers kernel/not-implemented for the id form until T31", async () => {
    const store = withPlugin(repository());
    const result = await run(store, ["rules", "show", "CQ-4", "--json"]);
    expect(result.code).toBe(2);
    expect(result.json).toMatchObject({ rule: "kernel/not-implemented" });
  });

  it("refuses neither an id nor --ticket with input/missing-argument", async () => {
    const store = withPlugin(repository());
    const result = await run(store, ["rules", "show", "--json"]);
    expect(result.code).toBe(3);
    expect(result.json).toMatchObject({ rule: "input/missing-argument" });
  });
});
