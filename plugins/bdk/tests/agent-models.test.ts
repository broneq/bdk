import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";

import { describeSettings } from "../src/config/domain/describe.ts";
import { MODEL_ROLES, SettingsSchema } from "../src/config/domain/settings.ts";

// Spec `bdk-cli/config`, "Every agent is a models role": every agent of the plugin is a role of
// `models`, the `models` description names it, and every skill that starts the agent passes
// `models.<agent>`. Skills read the role from their `bdk config show` block, so a call whose text
// does not name it silently runs the agent on its default model.

const PLUGIN = join(import.meta.dirname, "..");
// `subagent_type: "bdk:verifier"` as a skill text writes an Agent call.
const AGENT_CALL = /subagent_type: "bdk:([a-z0-9-]+)"/g;

const agents = readdirSync(join(PLUGIN, "agents"))
  .filter((name) => name.endsWith(".md"))
  .map((name) => basename(name, ".md"))
  .sort();

const modelsDescription =
  describeSettings(SettingsSchema).find((doc) => doc.key === "models")?.description ?? "";
const roles = [...modelsDescription.matchAll(/`([a-z0-9-]+)`/g)]
  .map((match) => match[1] ?? "")
  .sort();

/** `<skill>: <agent>` for every paragraph that starts an agent without naming its role. */
function callsWithoutRole(): string[] {
  const skills = join(PLUGIN, "skills");
  return readdirSync(skills).flatMap((skill) => {
    const text = readFileSync(join(skills, skill, "SKILL.md"), "utf8");
    return text.split(/\n\s*\n/).flatMap((paragraph) =>
      [...paragraph.matchAll(AGENT_CALL)]
        .map((match) => match[1] ?? "")
        .filter((agent) => !paragraph.includes(`models.${agent}`))
        .map((agent) => `${skill}: ${agent}`),
    );
  });
}

describe("models roles", () => {
  it("names every agent of the plugin as a role of the models description", () => {
    expect(agents.filter((agent) => !roles.includes(agent))).toEqual([]);
  });

  it("accepts exactly the agents of the plugin as roles of the schema", () => {
    expect([...MODEL_ROLES].sort()).toEqual(agents);
  });

  it("names no role in the models description that is not an agent", () => {
    expect(roles.filter((role) => !agents.includes(role))).toEqual([]);
  });

  it("passes models.<agent> on every Agent call of a skill", () => {
    expect([...new Set(callsWithoutRole())]).toEqual([]);
  });
});
