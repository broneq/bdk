// `pnpm eval`: argument parsing, the credentials check and dispatch to the
// suites (design D-1). The suites own their runs; this module owns only the
// command line contract of the `skill-evals` spec.
import { DEFAULT_BUDGET_USD, DEFAULT_RUN_CAP_USD } from "./budget.ts";

export const SUITES = ["execute-ab", "rules-noop", "stages", "with-without"] as const;
export type SuiteName = (typeof SUITES)[number];

const USAGE = [
  "usage: pnpm eval <suite> [--probe] [--runs N] [--budget USD] [--run-cap USD]",
  "       pnpm eval rules-noop --patches <name,...> [...]   (M2 of those patches only)",
  "       pnpm eval with-without --skill <plugin:name> --tasks <file> [--fixture default|none] [...]",
  "       pnpm eval stages --skill <name> [...]",
  "       pnpm eval check",
  "       pnpm eval report <suite>",
  `suites: ${SUITES.join(", ")}`,
].join("\n");

export interface RunOptions {
  readonly command: "run";
  readonly suite: SuiteName;
  readonly probe: boolean;
  readonly runs: number;
  readonly budget: number;
  readonly runCap: number;
  readonly skill?: string;
  readonly tasks?: string;
  readonly fixture?: "default" | "none";
  /** rules-noop only: measure M2 of these patches and skip M1. */
  readonly patches?: readonly string[];
}

export type Options =
  | RunOptions
  | { readonly command: "check" }
  | { readonly command: "report"; readonly suite: SuiteName };

export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UsageError";
  }
}

function suiteName(value: string | undefined): SuiteName {
  const found = SUITES.find((suite) => suite === value);
  if (found === undefined) {
    throw new UsageError(`unknown suite ${value ?? "(none)"}; known suites: ${SUITES.join(", ")}`);
  }
  return found;
}

function number(flag: string, value: string | undefined): number {
  const parsed = Number(value);
  if (value === undefined || !Number.isFinite(parsed) || parsed <= 0) {
    throw new UsageError(`${flag} needs a positive number, got ${value ?? "nothing"}`);
  }
  return parsed;
}

export function parseArgs(argv: readonly string[]): Options {
  const [first, ...rest] = argv;
  if (first === "check") return { command: "check" };
  if (first === "report") return { command: "report", suite: suiteName(rest[0]) };
  const suite = suiteName(first);
  let options: RunOptions = {
    command: "run",
    suite,
    probe: false,
    runs: 5,
    budget: DEFAULT_BUDGET_USD,
    runCap: DEFAULT_RUN_CAP_USD,
  };
  const queue = [...rest];
  const value = (): string | undefined => queue.shift();
  for (let flag = queue.shift(); flag !== undefined; flag = queue.shift()) {
    switch (flag) {
      case "--probe":
        options = { ...options, probe: true };
        break;
      case "--runs": {
        const runs = number(flag, value());
        if (!Number.isInteger(runs) || runs < 2) {
          throw new UsageError(
            "--runs needs an integer of at least 2 (the difference rule needs a range)",
          );
        }
        options = { ...options, runs };
        break;
      }
      case "--budget":
        options = { ...options, budget: number(flag, value()) };
        break;
      case "--run-cap":
        options = { ...options, runCap: number(flag, value()) };
        break;
      case "--skill":
      case "--tasks": {
        const text = value();
        if (text === undefined) throw new UsageError(`${flag} needs a value`);
        options = { ...options, [flag.slice(2)]: text };
        break;
      }
      case "--fixture": {
        const text = value();
        if (text !== "default" && text !== "none")
          throw new UsageError("--fixture is default or none");
        options = { ...options, fixture: text };
        break;
      }
      case "--patches": {
        const names = (value() ?? "").split(",").filter((name) => name !== "");
        if (names.length === 0) throw new UsageError("--patches needs a comma-separated list");
        if (suite !== "rules-noop") throw new UsageError("--patches applies to rules-noop only");
        options = { ...options, patches: names };
        break;
      }
      default:
        throw new UsageError(`unknown flag ${flag}`);
    }
  }
  if (suite === "with-without" && (options.skill === undefined || options.tasks === undefined)) {
    throw new UsageError("with-without needs --skill <plugin:name> and --tasks <file>");
  }
  if (suite === "stages" && options.skill === undefined) {
    throw new UsageError("stages needs --skill <name>");
  }
  return options;
}

export interface AuthStatus {
  readonly loggedIn: boolean;
}

/** Null when the SDK can authenticate: an API key, or a Claude Code login (evals/README.md, Provider facts). */
export function credentialsProblem(
  env: Readonly<Record<string, string | undefined>>,
  authStatus: () => AuthStatus | undefined,
): string | null {
  if ((env.ANTHROPIC_API_KEY ?? "") !== "") return null;
  if (authStatus()?.loggedIn === true) return null;
  return "no credentials: set ANTHROPIC_API_KEY, or log in to Claude Code with `claude auth login`";
}

export interface SuiteRunner {
  /** Runs the series or the probe; resolves to the exit code. */
  run(options: RunOptions): Promise<number>;
  /** Renders and validates the suite's configs without a model call. */
  check(): Promise<void>;
  /** Writes the suite's report tables from its result rows. */
  report(): Promise<void>;
}

export interface CliDeps {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly authStatus: () => AuthStatus | undefined;
  readonly suites: Readonly<Record<SuiteName, SuiteRunner>>;
  readonly print: (line: string) => void;
  readonly printError: (line: string) => void;
}

export async function run(argv: readonly string[], deps: CliDeps): Promise<number> {
  try {
    return await dispatch(parseArgs(argv), deps);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    deps.printError(`${error.message}\n${USAGE}`);
    return 2;
  }
}

async function dispatch(options: Options, deps: CliDeps): Promise<number> {
  switch (options.command) {
    case "check":
      for (const suite of SUITES) await deps.suites[suite].check();
      deps.print(`checked ${SUITES.join(", ")}`);
      return 0;
    case "report":
      await deps.suites[options.suite].report();
      return 0;
    case "run": {
      const problem = credentialsProblem(deps.env, deps.authStatus);
      if (problem !== null) {
        deps.printError(problem);
        return 1;
      }
      return deps.suites[options.suite].run(options);
    }
  }
}
