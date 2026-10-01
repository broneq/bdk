// Scripted answers to `AskUserQuestion` (design D-8 of v3-t41-setup-change):
// a PreToolUse hook in the run's project settings allows the call with
// `answers` filled in, which the host takes as the user's reply. The model
// words its own questions, so a case keys an answer by a pattern of the header
// or the question and picks the first option whose label matches the answer's
// pattern; an answer no option matches is free text, as "Other" would be. A
// question no key matches gets its first option.

interface Question {
  readonly question: string;
  readonly header?: string;
  readonly options?: readonly { readonly label: string }[];
}

export interface AskInput {
  readonly questions: readonly Question[];
  readonly [key: string]: unknown;
}

export interface AnswerHookOutput {
  readonly hookSpecificOutput: {
    readonly hookEventName: "PreToolUse";
    readonly permissionDecision: "allow";
    readonly updatedInput: AskInput & { readonly answers: Record<string, string> };
  };
}

const matches = (pattern: string, text: string | undefined): boolean =>
  text !== undefined && new RegExp(pattern, "i").test(text);

function chosenLabel(
  question: Question,
  answers: Readonly<Record<string, string>>,
): string | undefined {
  const options = question.options ?? [];
  const key = Object.keys(answers).find(
    (pattern) => matches(pattern, question.header) || matches(pattern, question.question),
  );
  if (key === undefined) return options[0]?.label;
  const wanted = answers[key] ?? "";
  return options.find((option) => matches(wanted, option.label))?.label ?? wanted;
}

export function answerHookOutput(
  input: AskInput,
  answers: Readonly<Record<string, string>>,
): AnswerHookOutput {
  const chosen: Record<string, string> = {};
  for (const question of input.questions) {
    const label = chosenLabel(question, answers);
    if (label !== undefined) chosen[question.question] = label;
  }
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      updatedInput: { ...input, answers: chosen },
    },
  };
}

const quote = (path: string): string => `'${path.replaceAll("'", "'\\''")}'`;

/** The project settings that install the hook for one run. */
export function answerHookSettings(hookFile: string, answersFile: string): unknown {
  return {
    hooks: {
      PreToolUse: [
        {
          matcher: "AskUserQuestion",
          hooks: [{ type: "command", command: `node ${quote(hookFile)} ${quote(answersFile)}` }],
        },
      ],
    },
  };
}
