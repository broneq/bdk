// `role-contracts`: the seven role skills under skills/roles/, their adapter
// binding (the same table `dispatch build` stamps), and the wording every role
// contract must and must not carry.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { ADAPTERS, ROLE_ADAPTERS } from "../../src/export/domain/adapters.ts";
import { settingsRegistry } from "../../src/registrations.ts";
import { REPO_ROOT } from "../support/run.ts";

const ROLES_DIR = join(REPO_ROOT, "skills", "roles");
const ROLES = [
  "design-verifier",
  "implementer",
  "pr-reviewer",
  "reviewer",
  "runner",
  "scout",
  "verifier",
];
const REVIEWING = ["verifier", "design-verifier", "reviewer", "pr-reviewer"];
const AUTHORISING = /\b(approve[ds]?|approval|lgtm|sign[- ]off|ready to merge|go ahead|proceed)\b/i;
const BODY_BUDGET = 4096;

interface Role {
  readonly name: string;
  readonly meta: Record<string, unknown>;
  readonly body: string;
}

function readRole(name: string): Role {
  const text = readFileSync(join(ROLES_DIR, name, "SKILL.md"), "utf8");
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (match?.[1] === undefined) throw new Error(`${name}: no frontmatter`);
  return {
    name,
    meta: parse(match[1]) as Record<string, unknown>,
    body: text.slice(match[0].length),
  };
}

function sentences(body: string): string[] {
  return body
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s/)
    .map((sentence) => sentence.trim());
}

describe("role skills", () => {
  it("are exactly the seven roles", () => {
    const dirs = existsSync(ROLES_DIR)
      ? readdirSync(ROLES_DIR, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name)
          .sort()
      : [];
    expect(dirs).toEqual(ROLES);
  });

  it("have no prompt key: a project cannot override a role body", () => {
    expect(settingsRegistry().prompts.filter((prompt) => prompt.key.startsWith("roles/"))).toEqual(
      [],
    );
  });

  it("are discovered through the plugin manifest", () => {
    const manifest = JSON.parse(
      readFileSync(join(REPO_ROOT, ".claude-plugin", "plugin.json"), "utf8"),
    ) as { skills?: unknown };
    expect(manifest.skills).toEqual(["./skills/roles/"]);
  });

  describe.each(ROLES)("%s", (name) => {
    const role = (): Role => readRole(name);

    it("has the role frontmatter", () => {
      const { meta } = role();
      expect(meta).toMatchObject({
        name,
        "user-invocable": false,
        context: "fork",
        agent: `bdk:${ROLE_ADAPTERS[name as keyof typeof ROLE_ADAPTERS]}`,
      });
      expect(typeof meta.description).toBe("string");
      expect(meta).not.toHaveProperty("model");
      expect(meta).not.toHaveProperty("disable-model-invocation");
    });

    it("has no ! block", () => {
      expect(
        role()
          .body.split("\n")
          .filter((line) => line.startsWith("!`")),
      ).toEqual([]);
    });

    it("reads its package and rules through commands and relies on nothing else", () => {
      const { body } = role();
      expect(body).toContain("dispatch show");
      expect(body).toContain("rules show --ticket");
      expect(body).toMatch(/nothing else|nothing from the conversation/i);
    });

    it("writes its entries with log add and never names bdk-entries", () => {
      const { body } = role();
      expect(body).toContain("log add");
      expect(body).not.toContain("bdk-entries");
      expect(body).toContain("SendMessage");
    });

    it("stores its report through ingest, calls again on a refusal, and returns the envelope", () => {
      const { body } = role();
      expect(body).toContain("bdk log ingest --ticket");
      expect(body).toMatch(/fix the field it names and call it again/);
      expect(body).toMatch(/never write the report file yourself/);
      expect(body).not.toMatch(/write the (full )?report to/i);
      expect(body).toMatch(/return only the envelope/i);
    });

    it(`keeps its body within ${BODY_BUDGET} bytes`, () => {
      expect(Buffer.byteLength(role().body, "utf8")).toBeLessThanOrEqual(BODY_BUDGET);
    });
  });
});

describe("P3: reviewing roles authorise nothing", () => {
  it.each(REVIEWING)("%s has no approval wording", (name) => {
    expect(readRole(name).body).not.toMatch(AUTHORISING);
  });
});

describe("T3: the implementer's git sentence", () => {
  it("forbids discarding or history-writing git once and says to return blocked", () => {
    const matches = sentences(readRole("implementer").body).filter((sentence) =>
      /\bgit\b/.test(sentence),
    );
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatch(/blocked/);
  });
});

describe("P8: verifiers block only on the package's categories", () => {
  it.each(["verifier", "design-verifier"])(
    "%s names the category list and the not-a-FAIL list",
    (name) => {
      const { body } = readRole(name);
      expect(body).toMatch(/blocking categories/i);
      expect(body).toMatch(/not a FAIL/);
    },
  );
});

describe("adapters named by the roles", () => {
  it("are all produced by bdk export agents", () => {
    const produced = new Set(ADAPTERS.map((adapter) => `bdk:${adapter.name}`));
    for (const name of ROLES) expect(produced).toContain(readRole(name).meta.agent);
  });
});
