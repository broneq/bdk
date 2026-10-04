// The review stage of T42 through the committed bundle (`kernel-pipeline`;
// D2, D4, D5, D6): the gate runner's `tests-full`, `lint-full` and coverage
// on the round's `gate` group, a fix staling the gate, and `bdk done review`
// refused until the merged report holds every triaged entry of the round.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

import { answered, bdk, refused } from "../../../tests/support/repo.ts";
import { executed, opened, recorded, started } from "../../attempt/tests/e2e-support.ts";
import type { Started } from "../../attempt/tests/e2e-support.ts";

const TOOLS =
  "tools:\n  test:\n    - id: unit\n      tier: fast\n      command: vitest run\n" +
  "      coverage:\n        command: vitest run --coverage\n        report: coverage/lcov.info\n        format: lcov\n        min: 50\n";

function put(change: Started, path: string, content: string): void {
  mkdirSync(dirname(join(change.root, path)), { recursive: true });
  writeFileSync(join(change.root, path), content);
}

function run(change: Started, argv: string[], stdin?: string) {
  return bdk([...argv, "--json"], change.root, stdin === undefined ? {} : { stdin });
}

function explained(change: Started, id: string) {
  return answered(run(change, ["explain", id]), "output/explain.json") as {
    state: string;
    chain: { id: string; state: string; why?: string }[];
  };
}

/** An executed Change with a `review-fix` round and its gate runner's package. */
function round(settings = ""): { change: Started; round: string } {
  const change = executed(started(settings));
  const ticket = opened(change, "review-fix", change.id);
  answered(
    run(change, ["dispatch", "build", change.id, "runner", ticket, "--group", "gate"]),
    "output/dispatch-build.json",
  );
  return { change, round: ticket };
}

function covered(change: Started, ticket: string): void {
  put(
    change,
    "coverage/lcov.info",
    "SF:src/01-1.ts\nDA:1,3\nend_of_record\nSF:src/01-2.ts\nDA:1,2\nend_of_record\nSF:src/02-1.ts\nDA:1,1\nend_of_record\n",
  );
  answered(
    run(change, [
      "evidence",
      "coverage",
      "unit",
      "coverage/lcov.info",
      "--ticket",
      `${ticket}@gate`,
    ]),
    "output/evidence-coverage.json",
  );
}

const REPORT = (entries: string[]) =>
  `---\nstatus: done\nfiles: []\nentries: [${entries.join(", ")}]\nevidence: []\n---\n# Review\n`;

describe("the full gate of the review round", () => {
  it("opens the round while only the gate keeps review blocked, and refuses bdk done lint-full", () => {
    const { change } = round();
    expect(explained(change, "review").state).toBe("blocked");
    const why = refused(run(change, ["done", "lint-full"]), 2, "policy/invalid-transition");
    expect(why.instead[0]).toContain("bdk evidence record lint-full");
  });

  it("is done from the gate runner's records, and a fix to a part file stales both", () => {
    const { change, round: ticket } = round();
    recorded(change, `${ticket}@gate`, "tests-full");
    recorded(change, `${ticket}@gate`, "lint-full");
    expect(explained(change, "tests-full").state).toBe("done");
    expect(explained(change, "lint-full").state).toBe("done");
    put(change, "src/01-1.ts", 'export const value = "fixed";\n');
    expect(explained(change, "tests-full").state).toBe("stale");
    expect(explained(change, "lint-full").state).toBe("stale");
  });

  it("keeps tests-full open until the coverage of an entry with min passes, naming it", () => {
    const { change, round: ticket } = round(TOOLS);
    recorded(change, `${ticket}@gate`, "tests-full");
    const open = explained(change, "tests-full");
    expect(open.state).toBe("ready");
    expect(open.chain.find((node) => node.id === "tests-full")?.why).toBe(
      "no coverage manifest of unit for the Change",
    );
    covered(change, ticket);
    expect(explained(change, "tests-full").state).toBe("done");
  });
});

describe("the review verdict", () => {
  it("passes only on the merged report with every entry of the round triaged and no blocker", () => {
    const { change, round: ticket } = round();
    recorded(change, `${ticket}@gate`, "tests-full");
    recorded(change, `${ticket}@gate`, "lint-full");
    answered(
      run(change, [
        "dispatch",
        "build",
        change.id,
        "reviewer",
        ticket,
        "--group",
        "p01",
        "--range",
        "HEAD~3..HEAD",
        "--file",
        "src/01-1.ts",
      ]),
      "output/dispatch-build.json",
    );
    const finding = (
      answered(
        run(change, [
          "log",
          "add",
          "finding",
          "value is never validated",
          "--ref",
          "src/01-1.ts",
          "--ticket",
          `${ticket}@p01`,
        ]),
        "output/log-add.json",
      ).entry as { id: string }
    ).id;
    answered(
      run(change, ["log", "ingest", "--ticket", `${ticket}@p01`], REPORT([finding])),
      "output/log-ingest.json",
    );
    answered(
      run(change, [
        "log",
        "add",
        "report",
        "group p01 done",
        "--ref",
        "review",
        "--ticket",
        `${ticket}@p01`,
      ]),
      "output/log-add.json",
    );
    expect(refused(run(change, ["done", "review"]), 2, "policy/validation-failed").why).toContain(
      "merge-report",
    );

    answered(
      run(change, ["log", "ingest", "--ticket", `${ticket}@merge`], REPORT([finding])),
      "output/log-ingest.json",
    );
    answered(
      run(change, ["log", "add", "report", "1 finding", "--ticket", `${ticket}@merge`]),
      "output/log-add.json",
    );
    const untriaged = refused(run(change, ["done", "review"]), 2, "policy/validation-failed");
    expect(untriaged.why).toContain(`triaged: ${finding}`);

    answered(run(change, ["log", "triage", finding, "blocker"]), "output/log-triage.json");
    expect(refused(run(change, ["done", "review"]), 2, "policy/validation-failed").why).toContain(
      `blockers: live blocker ${finding}`,
    );

    answered(run(change, ["log", "triage", finding, "nice-to-have"]), "output/log-triage.json");
    expect(refused(run(change, ["done", "review"]), 2, "policy/validation-failed").why).toContain(
      `round-ok: the round ${ticket}`,
    );

    answered(run(change, ["attempt", "close", ticket, "ok"]), "output/attempt-close.json");
    expect(answered(run(change, ["done", "review"]), "output/done.json")).toMatchObject({
      artifact: "review",
      state: "done",
    });
  });
});
