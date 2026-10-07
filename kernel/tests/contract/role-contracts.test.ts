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
  "conformer",
  "design-verifier",
  "implementer",
  "integration-reviewer",
  "judge",
  "pr-reviewer",
  "reviewer",
  "runner",
  "scout",
  "verifier",
];
const REVIEWING = [
  "verifier",
  "design-verifier",
  "reviewer",
  "integration-reviewer",
  "judge",
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

  it("implementer: commits each task only after its check run passed, on the part's ticket (#166)", () => {
    const { body } = readRole("implementer");
    expect(body).toContain("`Tasks` section");
    expect(body).toMatch(/every command takes its ticket/);
    const check = body.indexOf("bdk check run <task> --ticket <ticket>");
    expect(check).toBeGreaterThan(-1);
    expect(body.indexOf("run the commit command it printed")).toBeGreaterThan(check);
    expect(body).toMatch(/Never compose, run or record a check yourself/);
    expect(body).not.toContain("bdk evidence record");
    expect(body).toMatch(/spends money, needs credentials[^.]*accepted `decision`/);
  });
});

describe("role skills", () => {
  it("are exactly the ten roles, without lead and simplifier", () => {
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
      expect(body).toMatch(/bdk log ingest --ticket \S+ --file <draft>/);
      expect(body).toContain("`draft` path");
      expect(body).toMatch(/never through a pipe or a heredoc/);
      expect(body).not.toMatch(/\bpipe the\b/i);
      expect(body).toMatch(/fix the field it names and call it again/);
      expect(body).toMatch(/return only the envelope/i);
      expect(body).toContain("report path as the package names it");
    });

    it("sends a ledger id and one sentence, and reads a message's entry first", () => {
      const { body } = role();
      expect(body).toMatch(/ledger id and one sentence, never the content/);
      expect(body).toContain("bdk agents list --affected-by <entry>");
      expect(body).toContain("BDK-AGENT-ID");
      expect(body).toContain("bdk log show <id>");
      expect(body).toMatch(/return `blocked` with the entry id/);
    });

    // T46: the call forms the execute probes of T41 showed refused (`role-contracts`,
    // Contracts steer the kernel calls that repeat as refusals).
    it("shows the envelope as a complete frontmatter with reason left as a comment", () => {
      const fence = /```\n(---\n[\s\S]*?\n---)\n/.exec(role().body)?.[1];
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
    expect(fix.join(" ")).toMatch(/ids in your report/);
    expect(fix.join(" ")).toMatch(/resolve none/);
  });
});

describe("P3: reviewing roles authorise nothing", () => {
  it.each(REVIEWING)("%s has no approval wording", (name) => {
    expect(readRole(name).body).not.toMatch(AUTHORISING);
  });
});

describe("T3: the working-tree git sentence of the worker roles", () => {
  it.each(["implementer", "conformer"])(
    "%s forbids discarding or history-writing git once, but the check run commit, and says to return blocked",
    (name) => {
      const matches = sentences(readRole(name).body).filter((sentence) => /\bgit\b/.test(sentence));
      expect(matches).toHaveLength(1);
      expect(matches[0]).toMatch(/blocked/);
      expect(matches[0]).toContain("`bdk check run` prints");
    },
  );
});

describe("#166: the conformer answers each rule and keeps behaviour", () => {
  it("checks the range against rules, instructions and tasks within the part's Files:", () => {
    const { body } = readRole("conformer");
    expect(body).toContain("## Conformance");
    expect(body).toContain("`Range`");
    expect(body).toContain("`Project instructions`");
    expect(body).toContain("bdk check run <part> --ticket <ticket>");
    expect(body).toMatch(/keeping behaviour unchanged/i);
    expect(body).toMatch(/within the part's `Files:`/);
  });
});

describe("#166: no role waits on children", () => {
  it.each(ROLES)("%s names no bdk agents wait", (name) => {
    expect(readRole(name).body).not.toContain("bdk agents wait");
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
    expect(body).toContain("under `.bdk/.machine/checks/<ticket>/`");
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

describe("rule ids are cited [S4]", () => {
  const CITING = [
    "implementer",
    "conformer",
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

  it.each(["runner", "scout", "judge"])("%s carries no citation line", (name) => {
    expect(citation(readRole(name).body)).toStrictEqual([]);
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
  it("runs the integration reviewer on integrator and keeps the others on their adapters (#158)", () => {
    expect(readRole("integration-reviewer").meta.agent).toBe("bdk:integrator");
    expect(readRole("reviewer").meta.agent).toBe("bdk:reviewer");
    expect(readRole("verifier").meta.agent).toBe("bdk:reader");
    expect(readRole("design-verifier").meta.agent).toBe("bdk:reader");
    expect(readRole("judge").meta.agent).toBe("bdk:judge");
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
    expect(body).not.toMatch(/duplication across parts/i);
    expect(body).not.toMatch(/`git diff <range>`(?! -- <file>)/);
  });

  it("has the reviewer check its group against the plan part and leave conformance to conform and lint", () => {
    const { body } = readRole("reviewer");
    expect(body).toMatch(/against the plan part/);
    expect(body).toMatch(/unit and end-to-end cases that are missing/);
    expect(body).toMatch(/to `conform` and `lint`/);
  });
});

describe("T42-H: findings explain why they matter, and areas are summarised", () => {
  it.each(["reviewer", "integration-reviewer"])("%s labels the body of every entry", (name) => {
    const { body } = readRole(name);
    for (const label of [
      "`Problem:`",
      "`Failure scenario:`",
      "`Why it matters:`",
      "`Suggested fix:`",
    ]) {
      expect(body, label).toContain(label);
    }
    expect(body).toContain("`--severity`");
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
    expect(body.indexOf("`## Intent`")).toBeGreaterThan(-1);
    expect(body.indexOf("`## Intent`")).toBeLessThan(body.indexOf("## Areas"));
  });
});

describe("#158: readers edit no project file and the integration reviewer traces the intent", () => {
  const READERS = ["reviewer", "integration-reviewer", "judge"];

  it.each(READERS)("%s writes only its report draft and edits no project file (#166)", (name) => {
    const { body } = readRole(name);
    expect(body).toMatch(/bdk log ingest --ticket \S+ --file <draft>/);
    expect(body).toMatch(/edit no project file/i);
  });

  it.each(["reviewer", "integration-reviewer"])("%s reads a diff one file at a time", (name) => {
    expect(readRole(name).body).toContain("`git diff <range> -- <file>`");
  });

  it.each(READERS)("%s runs no test: the gate runner runs the checks once per round", (name) => {
    const { meta, body } = readRole(name);
    expect(String(meta.description)).not.toMatch(/\bruns?\b[^.]*\btests?\b/i);
    expect(body).toMatch(/the gate runner runs the checks once per round/);
    expect(body).not.toContain("bdk evidence record");
  });

  it("the reviewer ends its report with its seams", () => {
    const { body } = readRole("reviewer");
    expect(body).toContain("`## Seams`");
    expect(body).toContain("`- <file>: <contract>`");
    expect(body).toContain("`- none`");
  });

  it("the integration reviewer traces the spec deltas from the group reports", () => {
    const { body } = readRole("integration-reviewer");
    expect(body).toContain("`## Intent`");
    expect(body).toMatch(/format the package's `Review` section gives/);
    expect(body).toMatch(/group reports/);
    expect(body).toContain("`## Seams`");
    expect(body).toMatch(/no spec delta[^.]*`observation`/);
  });

  it.each(ROLES)("%s links no references/ file", (name) => {
    expect(readRole(name).body).not.toMatch(/\]\([^)]*references\//);
  });
});

describe("#158: the judge triages the round and finds nothing new", () => {
  it("reads each body, sets the four levels with a reason and ends with its verdicts", () => {
    const { body } = readRole("judge");
    expect(body).toContain("bdk log show <id>");
    expect(body).toMatch(/`bdk log triage <id> <level> --reason "[^"]+"`/);
    for (const level of ["blocker", "should-fix", "nice-to-have", "not-a-problem"]) {
      expect(body).toContain(`\`${level}\``);
    }
    expect(body).toContain("`Failure scenario:`");
    expect(body).toContain("`not-a-fail`");
    expect(body).toContain("`## Verdicts`");
    expect(body).toContain("`- <id>: <level>: <reason>`");
    expect(body).toMatch(/look for no new problem/);
    expect(body).not.toMatch(/bdk log add (finding|blocker|observation)/);
    expect(body).toContain("bdk rules show <id>");
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

describe("roles in a part worktree (T45)", () => {
  it.each(["implementer", "conformer", "runner", "scout"])(
    "%s works inside the package's Work root",
    (name) => {
      const { body } = readRole(name);
      expect(body).toMatch(/`Work root` section, (every|keep every) (file|command)/);
      expect(body).toMatch(/`bdk` commands stay as written/);
    },
  );

  it("the implementer edits only the Conflict paths and leaves the merge to the kernel", () => {
    const { body } = readRole("implementer");
    expect(body).toMatch(/`Conflict` section, edit only its paths as its instruction says/);
    expect(body).toMatch(/commit nothing/);
    expect(body).toMatch(/return `blocked` naming the paths it does not settle/);
  });

  it("the verifier checks isolation as an integration-failure", () => {
    const { body } = readRole("verifier");
    expect(body).toMatch(/\*\*Isolation\.\*\*/);
    expect(body).toContain("`integration-failure`");
    expect(body).toContain("`isolation-reason`");
  });
});

describe("contracts leave BDK's own files to setup (T51)", () => {
  /** The one sentence of a body that names `.bdk/` files and `/bdk:setup`. */
  function bdkLine(name: string): string {
    const found = sentences(readRole(name).body).filter(
      (sentence) => sentence.includes("`.bdk/`") && sentence.includes("`/bdk:setup`"),
    );
    expect(found, name).toHaveLength(1);
    return found[0] ?? "";
  }

  it.each(["implementer", "conformer", "runner", "reviewer", "integration-reviewer"])(
    "%s turns a problem caused only by .bdk/ files into a question",
    (name) => {
      expect(bdkLine(name)).toContain("`question`");
    },
  );

  it.each(["implementer", "conformer"])(
    "%s never changes the tool configuration nor formats .bdk/",
    (name) => {
      const line = bdkLine(name);
      expect(line).toMatch(/never change the project's tool configuration/i);
      expect(line).toMatch(/rewrite them with a formatter/);
    },
  );

  it("runner records a check that fails only on .bdk/ files as not-run", () => {
    expect(bdkLine("runner")).toMatch(/`not-run`/);
  });
});
