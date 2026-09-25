import { existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { applyBaseline, entriesOf, readBaseline, writeBaseline } from "./baseline.ts";
import { ConfigError, loadConfig } from "./config.ts";
import { exitCode, formatHuman, formatJson } from "./report.ts";
import { runChecks } from "./runner.ts";

// Read at run time so a release-please version bump needs no rebuild of dist/:
// `../package.json` is the same file from src/ (tests) and from dist/ (bundle).
const VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
    version: string;
  }
).version;

export interface Io {
  cwd: string;
  env: Record<string, string | undefined>;
  stdout(text: string): void;
  stderr(text: string): void;
}

const USAGE = `Usage: skill-check [paths...] [options]

Checks Agent Skills directories and agent files against deterministic rules.
Targets, plugins and rule settings come from skill-check.config.ts (or .mjs,
.js) in the working directory. Path arguments narrow the per-file rules to
those skill directories or agent files; project rules still see every target.

Options:
  --config <file>     Use this config file instead of skill-check.config.*
  --portable          Apply the portable profile (the six Agent Skills
                      standard fields) to every skills target
  --json              Print one JSON object: version, findings, baseline, summary
  --strict            Exit 1 on warnings too
  --baseline <file>   Suppress the known violations listed in this file
  --baseline-init     Write the baseline from the current findings; refuses
                      when the file exists
  --baseline-prune    Remove baseline entries that no longer match; never adds
  --list-rules        Print the rule IDs the config enables
  --version           Print the version
  --help              Print this text

Exit codes:
  0  no error finding remains (warnings allowed unless --strict)
  1  an error finding or a stale baseline entry remains, or a warning under --strict
  2  usage or configuration error; the reason is on stderr
`;

export async function main(argv: string[], io: Io): Promise<number> {
  try {
    return await run(argv, io);
  } catch (error) {
    if (error instanceof ConfigError || isArgError(error)) {
      io.stderr(`skill-check: ${(error as Error).message}\n`);
      return 2;
    }
    throw error;
  }
}

async function run(argv: string[], io: Io): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      config: { type: "string" },
      portable: { type: "boolean", default: false },
      json: { type: "boolean", default: false },
      strict: { type: "boolean", default: false },
      baseline: { type: "string" },
      "baseline-init": { type: "boolean", default: false },
      "baseline-prune": { type: "boolean", default: false },
      "list-rules": { type: "boolean", default: false },
      version: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
  });
  if (values.help) {
    io.stdout(USAGE);
    return 0;
  }
  if (values.version) {
    io.stdout(`${VERSION}\n`);
    return 0;
  }

  const init = values["baseline-init"];
  const prune = values["baseline-prune"];
  if (init && prune)
    throw new ConfigError("--baseline-init and --baseline-prune cannot be combined");
  if ((init || prune) && positionals.length > 0) {
    throw new ConfigError(
      "--baseline-init and --baseline-prune check the whole tree; drop the path arguments",
    );
  }

  const config = await loadConfig(io.cwd, values.config);
  if (values.portable) {
    for (const target of config.targets) if (target.kind === "skills") target.profile = "portable";
  }
  const result = runChecks(config, { cwd: io.cwd, paths: positionals });

  if (values["list-rules"]) {
    io.stdout(
      values.json
        ? `${JSON.stringify(result.enabledRules)}\n`
        : `${result.enabledRules.join("\n")}\n`,
    );
    return 0;
  }

  const baseline =
    values.baseline === undefined ? config.baseline : resolve(io.cwd, values.baseline);
  const shown = baseline === undefined ? "" : relative(config.root, baseline);
  const plural = (n: number) => `${n} ${n === 1 ? "entry" : "entries"}`;

  if (init) {
    if (baseline === undefined) {
      throw new ConfigError(
        "--baseline-init needs a baseline file: set `baseline` in the config or pass --baseline",
      );
    }
    if (existsSync(baseline)) {
      throw new ConfigError(
        `baseline \`${shown}\` already exists; shrink it with --baseline-prune instead`,
      );
    }
    writeBaseline(baseline, entriesOf(result.findings));
    io.stderr(`skill-check: wrote ${plural(result.findings.length)} to ${shown}\n`);
    return 0;
  }

  let entries = baseline === undefined ? [] : readBaseline(baseline, shown);
  let applied = applyBaseline(result.findings, entries, result.inScope);
  if (prune && baseline !== undefined) {
    const stale = new Set(applied.stale);
    entries = entries.filter((e) => !stale.has(e));
    writeBaseline(baseline, entries);
    io.stderr(
      `skill-check: pruned ${stale.size} stale ${stale.size === 1 ? "entry" : "entries"} from ${shown}\n`,
    );
    applied = applyBaseline(result.findings, entries, result.inScope);
  }

  const outcome = {
    version: VERSION,
    findings: applied.findings,
    files: result.files,
    suppressed: applied.suppressed,
    stale: applied.stale.length,
  };
  io.stdout(
    values.json ? formatJson(outcome) : formatHuman(outcome, Boolean(io.env.GITHUB_ACTIONS)),
  );
  return exitCode(outcome.findings, values.strict);
}

function isArgError(error: unknown): boolean {
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && code.startsWith("ERR_PARSE_ARGS_");
}
