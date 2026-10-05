// The per-call budget over a whole Change (T50 design D6, NFR-SCALE-1): one
// scripted `tiny` Change of 8 plan parts driven through about 200 kernel calls
// in the mix a run makes, each timed through the built bundle. Wall-clock
// timing depends on the machine, so this runs in the `perf` project, which CI
// does not run: `pnpm build && pnpm test:perf` in a Linux container (D11).
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { bdk, git, repository } from "../../../tests/support/repo.ts";
import { fileStore } from "../../shared/store/index.ts";

const PARTS = 8;

const SETTINGS =
  "tools:\n" +
  "  test:\n    - { id: unit, tier: fast, command: vitest run }\n" +
  "  lint:\n    - { id: eslint, tier: lint, command: eslint . }\n";

const ENVELOPE = "---\nstatus: done\nfiles: []\nentries: []\nevidence: []\n---\n";

function part(nn: string, previous: string | undefined): string {
  const dependsOn = previous === undefined ? "[]" : `["${previous}"]`;
  return (
    `---\nschema: 1\nid: "${nn}"\ntitle: Part ${nn}\ngoal: g\nsuccess-measure: m\n` +
    `do-not-touch: []\ndepends-on: ${dependsOn}\nspec-impact: none\n---\n` +
    `## ${nn}-1 Task ${nn}\n\n**Files:**\n\n- \`src/${nn}-1.ts\`\n\n**Test cases:**\n\n- works\n`
  );
}

describe("a whole Change within the per-call budget", () => {
  it("about 200 kernel calls on 8 plan parts, p95 per call under 150 ms [NFR-SCALE-1]", () => {
    const root = repository({ ".bdk/settings.yaml": SETTINGS });
    const times: number[] = [];
    const call = (args: string[], stdin?: string): Record<string, unknown> => {
      const start = performance.now();
      const result = bdk([...args, "--json"], root, stdin === undefined ? {} : { stdin });
      times.push(performance.now() - start);
      expect(result.code, `${args.join(" ")}: ${result.stdout}${result.stderr}`).toBe(0);
      return result.json as Record<string, unknown>;
    };
    const evidence = (ticket: string, kind: string) => {
      const file = `.bdk/.machine/${kind}-${ticket.replace("@", "-")}.json`;
      fileStore().write(join(root, file), '{"failed":0}\n');
      call([
        "evidence",
        "record",
        kind,
        file,
        "--ticket",
        ticket,
        "--verdict",
        "pass",
        "--cite",
        "/failed",
      ]);
    };

    const id = call(["change", "new", "Ship the digest", "--profile", "tiny", "--reason", "perf"])
      .change as string;
    const dir = join(root, ".bdk/changes", id);
    call(["next"]);
    for (let n = 1; n <= PARTS; n++) {
      const nn = `0${String(n)}`;
      fileStore().write(
        join(dir, `plan/parts/${nn}-part.md`),
        part(nn, n === 1 ? undefined : `0${String(n - 1)}`),
      );
    }
    call(["done", "plan"]);
    call(["part", "list"]);

    for (let n = 1; n <= PARTS; n++) {
      const nn = `0${String(n)}`;
      const task = `${nn}-1`;
      call(["next"]);
      call(["part", "start", nn]);
      const ticket = call(["attempt", "open", "task-redispatch", task]).ticket as string;
      call(["dispatch", "build", task, "implementer", ticket]);
      call(["rules", "show", "--ticket", ticket]);
      call([
        "log",
        "add",
        "finding",
        `Part ${nn} reads the clock`,
        "--ref",
        task,
        "--ticket",
        ticket,
      ]);
      call(["log", "list", "--since-ticket-start", ticket]);
      fileStore().write(join(root, `src/${task}.ts`), `export const value = "${task}";\n`);
      call(["dispatch", "build", task, "simplifier", ticket]);
      call(["log", "ingest", "--ticket", ticket], `${ENVELOPE}# Simplify\n`);
      call(["dispatch", "build", task, "runner", ticket]);
      evidence(ticket, "tests-scoped");
      evidence(ticket, "lint");
      call(["attempt", "close", ticket, "ok"]);
      call(["commit", task]);
      call(["part", "done", nn]);
      call(["change", "status"]);
      call(["explain", `execute-part:${nn}`]);
      call(["log", "add", "decision", `Part ${nn} keeps UTC`, "--ref", task]);
      call(["attempt", "list"]);
      call(["log", "list", "--type", "decision"]);
      call(["part", "list"]);
      call(["change", "status"]);
      call(["next"]);
    }

    const round = call(["attempt", "open", "review-fix", id]).ticket as string;
    call(["dispatch", "build", id, "runner", round, "--group", "gate"]);
    evidence(`${round}@gate`, "tests-full");
    evidence(`${round}@gate`, "lint-full");
    call(["log", "ingest", "--ticket", `${round}@merge`], `${ENVELOPE}# Review\n\nPASS\n`);
    call(["log", "add", "report", "review passed", "--ref", id, "--ticket", `${round}@merge`]);
    call(["attempt", "close", round, "ok"]);
    call(["done", "review"]);
    call(["change", "status"]);
    expect(git(root, "log", "--format=%s").trim().split("\n")).toHaveLength(PARTS + 1);

    const total = times.reduce((sum, time) => sum + time, 0);
    const sorted = [...times].sort((a, b) => a - b);
    const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1] ?? Infinity;
    console.log(
      `NFR-SCALE-1: ${String(times.length)} calls, total ${(total / 1000).toFixed(1)} s, ` +
        `p50 ${(sorted[Math.floor(sorted.length / 2)] ?? 0).toFixed(0)} ms, p95 ${p95.toFixed(0)} ms`,
    );
    expect(times.length).toBeGreaterThanOrEqual(180);
    expect(p95).toBeLessThan(150);
  });
});
