// The entry point of `pnpm eval` (design D-1): real dependencies for the CLI.
import { execFileSync } from "node:child_process";

import { executeAbRunner } from "../suites/execute-ab/suite.ts";
import { reviewModelsRunner } from "../suites/review-models/suite.ts";
import { rulesNoopRunner } from "../suites/rules-noop/suite.ts";
import { stagesRunner } from "../suites/stages/suite.ts";
import { withWithoutRunner } from "../suites/with-without/suite.ts";
import { run } from "./cli.ts";
import type { AuthStatus, SuiteName, SuiteRunner } from "./cli.ts";

function authStatus(): AuthStatus | undefined {
  try {
    const output = execFileSync("claude", ["auth", "status", "--json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return JSON.parse(output) as AuthStatus;
  } catch {
    return undefined;
  }
}

const print = (line: string): void => {
  console.log(line);
};
const printError = (line: string): void => {
  console.error(line);
};

const suites: Record<SuiteName, SuiteRunner> = {
  "execute-ab": executeAbRunner({ print, printError }),
  "review-models": reviewModelsRunner({ print, printError }),
  "rules-noop": rulesNoopRunner({ print, printError }),
  stages: stagesRunner({ print, printError }),
  "with-without": withWithoutRunner({ print, printError }),
};

process.exitCode = await run(process.argv.slice(2), {
  env: process.env,
  authStatus,
  suites,
  print,
  printError,
});
