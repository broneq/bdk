// `kernel-pipeline`, Pipeline file: the strict schema and the cross-checks on
// the shipped file and on negative variants of it.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse, stringify } from "yaml";

import { settingsRegistry } from "../../registrations.ts";
import { memoryStore } from "../../shared/store/index.ts";
import { KIND_NAMES } from "../config.ts";
import { kindRegistry } from "../domain/kinds/index.ts";
import { declaredBy, loadPipeline, pipelineErrors } from "../use-cases/pipeline.ts";

const SHIPPED = readFileSync(
  join(import.meta.dirname, "../../../../pipeline/pipeline.yaml"),
  "utf8",
);
const kinds = kindRegistry();
const declared = declaredBy(settingsRegistry(), kinds);

interface Data {
  nodes: Record<string, unknown>[];
  stages: Record<string, unknown>[];
}

/** The shipped file with `change` applied to its parsed data. */
function variant(change: (data: Data) => void): string[] {
  const data = parse(SHIPPED) as Data;
  change(data);
  return pipelineErrors(stringify(data), declared).errors;
}

function node(data: Data, id: string): Record<string, unknown> {
  const found = data.nodes.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`no node ${id}`);
  return found;
}

describe("the shipped pipeline", () => {
  it("validates against the schema and the cross-checks", () => {
    expect(pipelineErrors(SHIPPED, declared).errors).toStrictEqual([]);
  });

  it("names only registered kinds, and the kind names of config.ts are the registry", () => {
    expect([...kinds.keys()]).toStrictEqual([...KIND_NAMES]);
  });

  it("has the node list of design D-6 in pipeline order", () => {
    const data = parse(SHIPPED) as Data;
    expect(data.nodes.map((entry) => entry.id)).toStrictEqual([
      "intent",
      "design",
      "design-parts",
      "design-index",
      "architecture",
      "design-verify",
      "gate:design",
      "plan",
      "plan-verify",
      "execute",
      "simplify",
      "tests-scoped",
      "lint",
      "spec-delta",
      "review",
      "gate:review",
      "close",
    ]);
  });
});

describe("a pipeline file is rejected", () => {
  it.each([
    [
      "an unknown key when:",
      (data: Data) => (node(data, "review").when = 'files.touched("src/billing/**")'),
      "nodes[14].when: unknown key",
    ],
    [
      "an expression in if",
      (data: Data) => (node(data, "design").if = "features.lavish && profile == large"),
      "nodes[1].if: only features.<name> is accepted",
    ],
    [
      "an unknown feature",
      (data: Data) => (node(data, "design").if = "features.unknown-switch"),
      "nodes[1] (design).if: features.unknown-switch is not a declared features key",
    ],
    [
      "an unknown kind",
      (data: Data) => (node(data, "design").kind = "blueprint"),
      "nodes[1] (design).kind: blueprint is not a kind",
    ],
    [
      "an unknown stage",
      (data: Data) => (node(data, "design").stage = "drafting"),
      "nodes[1] (design).stage: drafting is not a stage",
    ],
    [
      "a dangling requires",
      (data: Data) => (node(data, "design").requires = ["sketch"]),
      "nodes[1] (design).requires: sketch is not a node",
    ],
    [
      "a cycle",
      (data: Data) => (node(data, "intent").requires = ["design"]),
      "requires: intent -> design -> intent form a cycle",
    ],
    [
      "a duplicate id",
      (data: Data) => (node(data, "design-parts").id = "design"),
      "nodes[2] (design).id: design appears twice",
    ],
    [
      "a gate without policy",
      (data: Data) => delete node(data, "gate:design").policy,
      "nodes[6] (gate:design).policy: a gate needs policy",
    ],
    [
      "a gate without opens",
      (data: Data) => delete node(data, "gate:design").opens,
      "nodes[6] (gate:design).opens: a gate needs opens",
    ],
    [
      "a policy that is not a policy.gates key",
      (data: Data) => (node(data, "gate:design").policy = "plan"),
      "nodes[6] (gate:design).policy: policy.gates.plan is not declared",
    ],
    [
      "a budget outside the loop list",
      (data: Data) => (node(data, "review").budget = "forever"),
      "nodes[14].budget",
    ],
    [
      "a rules category the pack does not hold",
      (data: Data) => (node(data, "plan").rules = ["style"]),
      "nodes[7] (plan).rules: style is no rule category of the pack",
    ],
    [
      "a language pack as a rules category",
      (data: Data) => (node(data, "plan").rules = ["languages/react"]),
      "nodes[7].rules[0]: must be kebab-case",
    ],
    [
      "policy on a node that is no gate",
      (data: Data) => (node(data, "design").policy = "design"),
      "nodes[1] (design): policy and opens belong to gate nodes only",
    ],
    [
      "a stage listed twice",
      (data: Data) => data.stages.push({ id: "plan", command: "/bdk:plan" }),
      "stages: plan appears twice",
    ],
  ])("%s", (_name, change, message) => {
    expect(variant(change).some((error) => error.startsWith(message))).toBe(true);
  });

  it("with a YAML syntax error", () => {
    expect(pipelineErrors("nodes: [", declared).errors).toHaveLength(1);
  });

  it("at the root when schema is not 1", () => {
    expect(variant((data) => Object.assign(data, { schema: 2 }))[0]).toMatch(/^schema: /);
  });
});

describe("loadPipeline", () => {
  const settings = settingsRegistry();

  it("parses the file once per text", () => {
    const store = memoryStore({ "/plugin/pipeline/pipeline.yaml": SHIPPED });
    const first = loadPipeline(store, "/plugin", settings, kinds);
    expect(loadPipeline(store, "/plugin", settings, kinds)).toBe(first);
  });

  it("throws on a missing or invalid shipped file, naming the key", () => {
    expect(() => loadPipeline(memoryStore(), "/plugin", settings, kinds)).toThrow(
      "the plugin file pipeline/pipeline.yaml is missing",
    );
    const store = memoryStore({
      "/plugin/pipeline/pipeline.yaml": SHIPPED.replace(
        "  - id: close\n",
        "  - id: close\n    when: x\n",
      ),
    });
    expect(() => loadPipeline(store, "/plugin", settings, kinds)).toThrow(
      /nodes\[16\]\.when: unknown key/,
    );
  });
});
