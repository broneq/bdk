// The one argument of every `bdk hooks` command (spec `bdk-cli/hooks`, "Hook payload input").

import { CliError } from "../../shared/cli/index.ts";
import type { Argument, Input } from "../../shared/cli/index.ts";

export const PAYLOAD_ARGUMENT: Argument = {
  name: "payload",
  description: "- : read the host's hook payload, one JSON object, from stdin",
  required: true,
};

export function requireStdin(input: Input, path: string): void {
  if (input.args.payload !== "-") {
    throw new CliError(
      "usage/invalid-argument",
      `bdk ${path} reads its payload only from stdin`,
      `Pass - and pipe the payload: bdk ${path} -`,
    );
  }
}
