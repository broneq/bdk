// The hook payload of both `bdk hooks` commands (spec `bdk-cli/hooks`, "Hook payload input").

import { CliError } from "../../shared/cli/index.ts";
import type { ConfigDeps } from "../../config/index.ts";
import { parsePayload } from "../domain/payload.ts";
import type { HookPayload } from "../domain/payload.ts";

/** What the hooks slice needs from the OS; `main.ts` passes it in. */
export interface HooksDeps extends ConfigDeps {
  /** All of stdin, for the `-` argument. */
  readonly stdin: () => Promise<string>;
}

export async function readPayload(deps: HooksDeps): Promise<HookPayload> {
  const payload = parsePayload(await deps.stdin());
  if (payload === undefined) {
    throw new CliError(
      "usage/invalid-payload",
      "the hook payload on stdin is not a JSON object",
      "Pipe the host's hook payload, one JSON object, into the command.",
    );
  }
  return payload;
}

/** The OS dependencies with the working directory of the session the payload names. */
export function sessionDeps(deps: HooksDeps, payload: HookPayload): ConfigDeps {
  return { ...deps, cwd: payload.cwd ?? deps.cwd };
}
