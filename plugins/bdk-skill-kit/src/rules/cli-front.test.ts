import { describe, expect, it } from "vitest";
import type { Report } from "../index.ts";
import { doc } from "../testing.ts";
import { cliFront } from "./cli-front.ts";

function run(text: string, options = {}): string[] {
  const reports: Report[] = [];
  cliFront.check?.(doc(text), {
    options: { ...cliFront.defaultOptions, ...options } as never,
    root: "/",
    report: (r) => reports.push(r),
  });
  return reports.map((r) => r.message);
}

const front = (body: string, extra = "") =>
  `---\nname: demo\ndescription: Runs bdk. Use when the kernel is needed.\n${extra}metadata:\n  fronts-cli: bdk\n---\n\n${body}`;

const good =
  "Reach for the kernel when a stage needs state.\n\n```sh\nbdk <group> <verb>\n```\n\n`bdk <group> --help` is the source of truth.\n";

describe("cli-front", () => {
  it("ignores a skill that fronts no CLI", () => {
    expect(run("---\nname: demo\ndescription: x\n---\n\nbody\n")).toEqual([]);
  });

  it("passes a thin fronting skill", () => {
    expect(run(front(good))).toEqual([]);
  });

  it("reports a fronting skill hidden from the model", () => {
    expect(run(front(good, "disable-model-invocation: true\n"))).toEqual([
      "a skill fronting `bdk` must stay model-invocable; drop `disable-model-invocation: true`",
    ]);
  });

  it("reports a fronting skill over the line limit", () => {
    expect(run(front(good + "more\n".repeat(20)))).toEqual([
      "a skill fronting `bdk` has 34 lines; the limit is 30",
    ]);
  });

  it("reports a skill that never points at --help", () => {
    expect(run(front("Run `bdk change new`.\n"))).toEqual([
      "a skill fronting `bdk` must point at `bdk --help` (or `bdk <group> --help`) as the usage reference",
    ]);
  });

  it("reports usage documented as flags", () => {
    expect(run(front(`${good}Use --json, --profile, --kind, --inferred and --force.\n`))).toEqual([
      "a skill fronting `bdk` names 4 flags (--profile, --kind, --inferred, --force); usage belongs in `bdk --help`",
    ]);
  });

  it("reports usage documented as a table", () => {
    const table =
      "| Command | Does |\n| --- | --- |\n| `bdk change new` | opens |\n| `bdk log add` | logs |\n| `bdk next` | next |\n";
    expect(run(front(good + table))).toEqual([
      "a skill fronting `bdk` documents usage in 3 table or list rows; usage belongs in `bdk --help`",
    ]);
  });

  it("reports usage documented as a list and honours thresholds", () => {
    const list = "- `--profile` sets the profile\n- `--kind` sets the kind\n";
    expect(run(front(good + list), { maxUsageRows: 1, maxFlags: 5 })).toEqual([
      "a skill fronting `bdk` documents usage in 2 table or list rows; usage belongs in `bdk --help`",
    ]);
  });
});
