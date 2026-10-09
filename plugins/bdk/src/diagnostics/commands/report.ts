// `bdk diagnostics report [<change>] [--session <id>]... [--transcripts <dir>]`.

import type { Command } from "../../shared/cli/index.ts";
import { renderReport } from "../render/report.ts";
import { report } from "../use-cases/report.ts";
import type { DiagnosticsDeps } from "../use-cases/report.ts";

export function reportCommand(deps: DiagnosticsDeps): Command {
  return {
    verb: "report",
    summary:
      "Count the sessions of a Change from the host transcripts: stages, agents, tokens, cost share, waste findings",
    arguments: [
      {
        name: "change",
        description:
          "The Change whose sessions to count: every session naming .bdk/runs/<change>/ or openspec/changes/<change>",
      },
    ],
    flags: {
      session: {
        type: "string",
        multiple: true,
        description: "Count this session id too",
      },
      transcripts: {
        type: "string",
        description:
          "The transcripts directory; default $CLAUDE_CONFIG_DIR/projects/<project key> (~/.claude when unset)",
      },
    },
    run(input) {
      const sessions = input.flags.session;
      const transcripts = input.flags.transcripts;
      const result = report(deps, {
        change: input.args.change,
        sessions: Array.isArray(sessions) ? sessions : [],
        transcripts: typeof transcripts === "string" ? transcripts : undefined,
      });
      return { data: result, text: renderReport(result) };
    },
  };
}
