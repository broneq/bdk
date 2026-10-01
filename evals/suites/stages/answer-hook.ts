// The PreToolUse command the stages suite installs for `AskUserQuestion`:
// reads the hook payload on stdin and the case's answers file named by its
// argument, and prints the hook output of `answerHookOutput`.
import { readFileSync } from "node:fs";

import { answerHookOutput } from "./answer.ts";
import type { AskInput } from "./answer.ts";

const payload = JSON.parse(readFileSync(0, "utf8")) as { tool_input: AskInput };
const answers = JSON.parse(readFileSync(process.argv[2] ?? "", "utf8")) as Record<string, string>;
process.stdout.write(JSON.stringify(answerHookOutput(payload.tool_input, answers)));
