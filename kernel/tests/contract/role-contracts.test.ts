// `role-contracts`: the ten role skills under skills/roles/, their adapter
// binding (the same table `dispatch build` stamps), and the wording every role
// contract must and must not carry.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { ADAPTERS, ROLE_ADAPTERS } from "../../src/export/domain/adapters.ts";
import { SPAWNS } from "../../src/hooks/domain/guards.ts";
import { settingsRegistry } from "../../src/registrations.ts";
import { REPO_ROOT } from "../support/run.ts";

const ROLES_DIR = join(REPO_ROOT, "skills", "roles");
const ROLES = [
  "design-verifier",
  "implementer",
  "integration-reviewer",
  "lead",
  "pr-reviewer",
  "reviewer",
  "runner",
  "scout",
  "simplifier",
  "verifier",
];
const REVIEWING = [
  "verifier",
  "design-verifier",
  "reviewer",
  "integration-reviewer",
  "pr-reviewer",
];
/** Started by `/bdk:pr-review` with a PR brief: no package, no ticket, no ledger (T42). */
const STATELESS = "pr-reviewer";
const PACKAGED = ROLES.filter((name) => name !== STATELESS);
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

describe("role skills: refusals of the execute probes (T46)", () => {
  it("runner: cites with the file:line=text form and says a console line is not a citation", () => {
    const { body } = readRole("runner");
    expect(body).toMatch(/--cite "[^"\s]+:\d+=[^"]+"/);
    expect(body).toMatch(/not a (console|summary) line|never the console/i);
  });

  it("lead: closes a task ticket only after every step, and uses the task's own ticket", () => {
    const { body } = readRole("lead");
    expect(body).toMatch(/only after the last step/);
    expect(body).toMatch(/never your own/);
    expect(body).toMatch(/close the task's earlier ticket before `bdk attempt open/);
  });
});

describe("role skills", () => {
  it("are exactly the ten roles", () => {
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
    expect(manifest.skills).toContain("./skills/roles/");
  });

  describe.each(ROLES)("%s", (name) => {
    const role = (): Role => readRole(name);

    it(`keeps its body within ${BODY_BUDGET} bytes`, () => {
      expect(Buffer.byteLength(role().body, "utf8")).toBeLessThanOrEqual(BODY_BUDGET);
    });

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
  });

  describe.each(PACKAGED)("%s", (name) => {
    const role = (): Role => readRole(name);

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
      expect(body).toContain("report path as the package names it");
    });

    it("sends a ledger id and one sentence, and reads a message's entry first", () => {
      const { body } = role();
      expect(body).toMatch(/ledger id and one sentence, never the content/);
      expect(body).toContain("bdk agents list --affected-by <entry>");
      expect(body).toContain("bdk log show <id>");
      expect(body).toMatch(/return `blocked` with the entry id/);
    });

    // T46: the call forms the execute probes of T41 showed refused (`role-contracts`,
    // Contracts steer the kernel calls that repeat as refusals).
    it("shows the envelope as a complete frontmatter with reason left as a comment", () => {
      const fence = /```\n(---\n[\s\S]*?\n---)\n```/.exec(role().body)?.[1];
      expect(fence, "an envelope example between two --- lines").toBeDefined();
      const lines = (fence ?? "").split("\n");
      expect(lines.filter((line) => line.startsWith("reason:"))).toEqual([]);
      expect(lines).toContain("# reason: blocked and needs-context only");
      const frontmatter = parse((fence ?? "").replace(/^---\n|\n---$/g, "")) as Record<
        string,
        unknown
      >;
      expect(Object.keys(frontmatter)).toEqual(["status", "files", "entries", "evidence"]);
    });

    it("gives every log add its ticket", () => {
      const adds = role().body.match(/`bdk log add [^`]*`/g) ?? [];
      expect(adds.filter((add) => !add.includes("--ticket"))).toEqual([]);
    });
  });
});

describe("T42: the PR reviewer works from its brief alone", () => {
  const body = (): string => readRole(STATELESS).body;

  it("relies on nothing but the brief and reads its rules by file set", () => {
    expect(body()).toMatch(/Rely on nothing but the brief/);
    expect(body()).toContain("bdk rules show --role pr-reviewer --file <path>");
  });

  it("names neither a package, a ledger write nor a stored report", () => {
    for (const command of ["dispatch show", "log add", "log ingest", "SendMessage"]) {
      expect(body()).not.toContain(command);
    }
  });

  it("reviews the range against the intent and the contract the brief names", () => {
    expect(body()).toMatch(/range of the brief/);
    expect(body()).toMatch(/intent/);
    expect(body()).toMatch(/contract/);
  });

  it("returns one result block with every finding field and the blocking mark", () => {
    const block = /```yaml\n(pr-review-result:[\s\S]*?)```/.exec(body())?.[1];
    expect(block).toBeDefined();
    for (const field of [
      "file:",
      "line:",
      "category:",
      "severity:",
      "rule:",
      "problem:",
      "fix:",
      "blocking:",
    ]) {
      expect(block).toContain(field);
    }
    expect(body()).toMatch(/verdict/);
  });
});

describe("T42: the implementer fixes the blockers of a review-fix package", () => {
  it("fixes the embedded blocking entries, names their ids and resolves none", () => {
    const fix = sentences(readRole("implementer").body).filter((sentence) =>
      sentence.includes("`review-fix`"),
    );
    expect(fix.join(" ")).toMatch(/blocking entr/);
    expect(fix.join(" ")).toMatch(/by id in your report/);
    expect(fix.join(" ")).toMatch(/resolve none/);
  });
});

describe("P3: reviewing roles authorise nothing", () => {
  it.each(REVIEWING)("%s has no approval wording", (name) => {
    expect(readRole(name).body).not.toMatch(AUTHORISING);
  });
});

describe("T3: the working-tree git sentence of the worker roles", () => {
  it.each(["implementer", "simplifier"])(
    "%s forbids discarding or history-writing git once and says to return blocked",
    (name) => {
      const matches = sentences(readRole(name).body).filter((sentence) => /\bgit\b/.test(sentence));
      expect(matches).toHaveLength(1);
      expect(matches[0]).toMatch(/blocked/);
    },
  );
});

describe("T23-D43: the simplifier keeps behaviour", () => {
  it("keeps behaviour unchanged within the task's Files:", () => {
    const { body } = readRole("simplifier");
    expect(body).toMatch(/keep behaviour unchanged/i);
    expect(body).toMatch(/only the task's `Files:`/);
    expect(body).toMatch(/uncommitted/);
  });
});

describe("T4: the runner records its checks as evidence", () => {
  it("records each check, cites the output for pass and gives the reason for not-run", () => {
    const { body } = readRole("runner");
    expect(body).toMatch(/`Checks` section/);
    expect(body).toContain("bdk evidence record <kind> <file> --ticket <ticket>");
    const pass = sentences(body).filter((sentence) => sentence.includes("`pass`"));
    expect(pass.some((sentence) => sentence.includes("cit"))).toBe(true);
    const notRun = sentences(body).filter((sentence) => sentence.includes("`not-run`"));
    expect(notRun.some((sentence) => sentence.includes("reason"))).toBe(true);
    expect(body).toContain("never write or edit that output yourself");
    expect(body).toContain("under `.bdk/.machine/checks/`");
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

describe("verifiers record their verdict after storing the report", () => {
  it.each(["verifier", "design-verifier"])("%s names log add report after log ingest", (name) => {
    const { body } = readRole(name);
    const ingest = body.indexOf("bdk log ingest --ticket");
    const record = body.indexOf("bdk log add report");
    expect(ingest).toBeGreaterThan(-1);
    expect(record).toBeGreaterThan(ingest);
    expect(body.slice(record)).toMatch(
      /^bdk log add report "[^"]+" --ref <target> --ticket <ticket>/,
    );
  });
});

describe("the verifier checks a whole plan", () => {
  it("verifies every plan part with the design and names the plan-wide checks", () => {
    const { body } = readRole("verifier");
    expect(body).toContain("You verify the plan parts the package names, together");
    expect(body).toContain("design documents");
    expect(body).toMatch(/\*\*Test cases\.\*\*/);
    expect(body).toMatch(/\*\*Design coverage\.\*\*/);
    expect(body).toMatch(/\*\*Between parts\.\*\*/);
    expect(body).toMatch(/If users would see the change and no task or `decision` covers it/);
    expect(body).toContain("`unresolved-decision`");
  });
});

describe("S4: rule ids are cited", () => {
  const CITING = [
    "implementer",
    "simplifier",
    "reviewer",
    "integration-reviewer",
    "pr-reviewer",
    "verifier",
    "design-verifier",
  ];
  const citation = (body: string): string[] =>
    sentences(body).filter((sentence) => /rule id/i.test(sentence));

  it.each(CITING.filter((name) => name !== STATELESS))(
    "%s cites the rule id with --ref on the entry and in the report",
    (name) => {
      const cited = citation(readRole(name).body);
      expect(cited, name).toHaveLength(1);
      expect(cited[0]).toContain("--ref <id>");
      expect(cited[0]).toMatch(/report/);
    },
  );

  it("pr-reviewer cites the rule id in each finding of its result block", () => {
    const cited = citation(readRole(STATELESS).body);
    expect(cited).toHaveLength(1);
    expect(cited[0]).toMatch(/`rule`/);
    expect(cited[0]).toMatch(/finding/);
  });

  it.each(["runner", "scout", "lead"])("%s carries no citation line", (name) => {
    expect(citation(readRole(name).body)).toStrictEqual([]);
  });
});

describe("T41-D11: the lead runs its part and waits instead of ending its turn", () => {
  it("dispatches in the background, waits, closes and commits, and edits nothing", () => {
    const { body } = readRole("lead");
    for (const needle of [
      "bdk agents wait",
      "run_in_background: true",
      "bdk attempt close",
      "bdk commit",
      "bdk log ingest --ticket",
      "elapsed",
    ]) {
      expect(body).toContain(needle);
    }
    expect(body).not.toMatch(/\b(Edit|Write)\b/);
  });

  it("escalates its own task on the model dispatch build returns (T41-D14)", () => {
    const { body } = readRole("lead");
    expect(body).toContain("bdk attempt open task-redispatch <task> --escalate");
    expect(body).toMatch(/`model` that `bdk dispatch build` returns/);
  });
});

describe("T41-D4: a scout started by a worker has no package", () => {
  it("answers the question in at most 15 lines and keeps a finding", () => {
    const { body } = readRole("scout");
    expect(body).toMatch(/question instead of a package path/);
    expect(body).toMatch(/at most 15 lines naming files and lines/);
  });
});

describe("T42-A1: reviewers of a round work under their group reference", () => {
  it("runs the integration reviewer on reader and keeps the reviewer on reviewer", () => {
    expect(readRole("integration-reviewer").meta.agent).toBe("bdk:reader");
    expect(readRole("reviewer").meta.agent).toBe("bdk:reviewer");
  });

  it.each(["reviewer", "integration-reviewer"])(
    "%s uses <ticket>@<group> in every --ticket and never sets a triage level",
    (name) => {
      const { body } = readRole(name);
      expect(body).toContain("<ticket>@<group>");
      expect(body).toMatch(/in every `--ticket`/);
      expect(body).toMatch(/Never set a triage level/);
      expect(body).toMatch(/`--category` from the P8 list/);
    },
  );

  it("has the integration reviewer check the range against intent, design, plan and risks", () => {
    const { body } = readRole("integration-reviewer");
    expect(body).toContain("`Risks` section");
    expect(body).toMatch(/intent, the design and the plan/);
    expect(body).toMatch(/no task's `Files:` declares/);
    expect(body).toMatch(/Duplication across parts/);
  });

  it("has the reviewer check its group against the plan part and leave style to simplify and lint", () => {
    const { body } = readRole("reviewer");
    expect(body).toMatch(/against the plan part/);
    expect(body).toMatch(/unit and end-to-end cases that are missing/);
    expect(body).toMatch(/to `simplify` and `lint`/);
  });
});

describe("T42-H: findings explain why they matter, and areas are summarised", () => {
  it.each(["reviewer", "integration-reviewer"])("%s labels the body of every entry", (name) => {
    const { body } = readRole(name);
    for (const label of ["`Problem:`", "`Why it matters:`", "`Suggested fix:`"]) {
      expect(body, label).toContain(label);
    }
  });

  it("gives every pr-reviewer finding the fields problem, why and fix", () => {
    const block = /```yaml\n(pr-review-result:[\s\S]*?)```/.exec(readRole(STATELESS).body)?.[1];
    for (const field of ["problem:", "why:", "fix:"]) expect(block, field).toContain(field);
  });

  it("ends the integration report with one line per touched risk under ## Areas", () => {
    const { body } = readRole("integration-reviewer");
    expect(body).toContain("## Areas");
    expect(body).toContain("- <risk-id>: <sentence>");
    expect(body).toContain("- unplanned: <sentence>");
    expect(body).toMatch(/300 characters/);
  });
});

describe("adapters named by the roles", () => {
  it("are all produced by bdk export agents", () => {
    const produced = new Set(ADAPTERS.map((adapter) => `bdk:${adapter.name}`));
    for (const name of ROLES) expect(produced).toContain(readRole(name).meta.agent);
  });
});

describe("T41-D4: the adapters' Agent lists and guard/agent-spawn agree", () => {
  it("lists the same starters and types", () => {
    const fromAdapters = Object.fromEntries(
      ADAPTERS.filter((adapter) => adapter.starts !== undefined).map((adapter) => [
        `bdk:${adapter.name}`,
        (adapter.starts ?? []).map((type) => `bdk:${type}`),
      ]),
    );
    const fromGuard = Object.fromEntries(
      Object.entries(SPAWNS).map(([caller, types]) => [caller, [...types]]),
    );
    expect(fromGuard).toEqual(fromAdapters);
  });
});
