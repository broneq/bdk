// The five host adapters (`role-contracts`, Adapters; design T23-D19, D20 of
// v3-t23a-roles-adapters). An adapter binds a role to a tool set and a model
// tier; the role itself lives in the role skill and the dispatch package, so
// the body is one sentence. Host names for tools and tiers are in `hosts.ts`.

import type { Role } from "../../shared/vocabulary/index.ts";

/** A group of host tools, mapped per host. Only `edit` writes files. */
export type ToolClass = "read" | "search" | "edit" | "shell" | "message";

export type Tier = "fast" | "balanced" | "deep";

export interface AdapterDefinition {
  readonly name: string;
  readonly description: string;
  readonly sentence: string;
  /** In the order the host's `tools:` list shows them. */
  readonly tools: readonly ToolClass[];
  readonly tier: Tier;
}

const CONTRACT =
  "You are a BDK %s: follow the role contract you were given, in the forked role skill or in the dispatch package your prompt names, and ";

function sentence(name: string, rule: string): string {
  return CONTRACT.replace("%s", name) + rule;
}

const READ_ONLY: readonly ToolClass[] = ["read", "search", "shell", "message"];

export const ADAPTERS: readonly AdapterDefinition[] = [
  {
    name: "worker",
    description:
      "BDK adapter for dispatched work that edits files (implementer and simplify packages). Started by BDK role skills and the swarm skill; not for general tasks.",
    sentence: sentence("worker", "change only the files it allows."),
    tools: ["read", "edit", "shell", "search", "message"],
    tier: "balanced",
  },
  {
    name: "reader",
    description:
      "BDK read-only adapter for deep verification (verifier, design-verifier). Started by BDK role skills; not for general tasks.",
    sentence: sentence("reader", "never change a file."),
    tools: READ_ONLY,
    tier: "deep",
  },
  {
    name: "reviewer",
    description:
      "BDK read-only adapter for code review with test runs (reviewer, pr-reviewer). Started by BDK role skills and the swarm skill; not for general tasks.",
    sentence: sentence("reviewer", "never change a file."),
    tools: READ_ONLY,
    tier: "balanced",
  },
  {
    name: "runner",
    description:
      "BDK adapter that runs the project's tests and checks for a dispatch package (runner). Started by BDK role skills and the swarm skill; not for general tasks.",
    sentence: sentence("runner", "never change a project file yourself."),
    tools: ["read", "shell", "message"],
    tier: "fast",
  },
  {
    name: "scout",
    description:
      "BDK read-only adapter for fast searches and log triage (scout). Started by BDK role skills and the swarm skill; not for general tasks.",
    sentence: sentence("scout", "never change a file."),
    tools: READ_ONLY,
    tier: "fast",
  },
];

/** The adapter each role runs on (`role-contracts`, Role-to-adapter map). */
export const ROLE_ADAPTERS: Readonly<Record<Role, string>> = {
  implementer: "worker",
  verifier: "reader",
  "design-verifier": "reader",
  reviewer: "reviewer",
  "pr-reviewer": "reviewer",
  runner: "runner",
  scout: "scout",
};
