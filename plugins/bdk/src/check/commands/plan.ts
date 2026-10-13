// `bdk check plan <run-dir> <id> [--at <point>] [--changed <ref>] [--scope <path>]... [--tests <path>]... [--kind <kind>]...`
// (spec `bdk-cli/check`, "Plan the checks").

import type { Command, Input } from "../../shared/cli/index.ts";
import { renderPlan } from "../render/plan.ts";
import type { CheckDeps } from "../use-cases/deps.ts";
import { planCheckRun } from "../use-cases/plan.ts";

function list(value: Input["flags"][string]): readonly string[] | undefined {
  if (typeof value === "string") return [value];
  return Array.isArray(value) ? (value as readonly string[]) : undefined;
}

export function planCommand(deps: CheckDeps): Command {
  return {
    verb: "plan",
    summary:
      "Resolve the configured test, lint and build commands into lines to run; runs none of them",
    arguments: [
      {
        name: "run-dir",
        description: "The Change's run directory, such as .bdk/runs/<change>; must exist",
        required: true,
      },
      {
        name: "id",
        description: "Kebab-case name of the check, such as a part id or round-2",
        required: true,
      },
    ],
    flags: {
      at: {
        type: "string",
        description:
          "Check point: part, wave or review; plans only the items whose when holds it, and items without when",
      },
      changed: {
        type: "string",
        description:
          "A git revision; adds the files changed against it (and untracked files) to the run's files",
      },
      scope: {
        type: "string",
        multiple: true,
        description:
          "A file of the run, relative to the project root; a {files} command gets the files its paths match",
      },
      tests: {
        type: "string",
        multiple: true,
        description:
          "A test file to run, relative to the project root; test items then take only these, lint and build items the run's files",
      },
      kind: {
        type: "string",
        multiple: true,
        description: "Only this kind: test, lint or build; all three when absent",
      },
    },
    run({ args, flags }) {
      const runDir = String(args["run-dir"]);
      const { plan, file } = planCheckRun(deps, {
        runDir,
        id: String(args.id),
        scope: list(flags.scope),
        tests: list(flags.tests),
        at: typeof flags.at === "string" ? flags.at : undefined,
        changed: typeof flags.changed === "string" ? flags.changed : undefined,
        kinds: list(flags.kind),
      });
      return { data: plan, text: renderPlan(plan, runDir, file) };
    },
  };
}
