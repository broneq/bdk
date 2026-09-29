// The judge (design D-6, D-8): one Sonnet 5 turn with no tools and a JSON
// schema for its answer, called from a suite's `measure` through the Agent
// SDK, so it authenticates like the sessions and reports its exact cost.
// The SDK lives in the tool package (`evals/node_modules`); it is imported at
// call time, so the harness typechecks and unit-tests without it.

const JUDGE_MODEL = "claude-sonnet-5";

export interface JudgeRequest {
  readonly system: string;
  readonly prompt: string;
  /** JSON schema of the answer. */
  readonly schema: Readonly<Record<string, unknown>>;
}

export interface Judgement {
  readonly output: unknown;
  readonly cost: number;
  readonly models: readonly string[];
}

interface SdkMessage {
  readonly type: string;
  readonly subtype?: string;
  readonly structured_output?: unknown;
  readonly total_cost_usd?: number;
  readonly modelUsage?: Record<string, unknown>;
  readonly errors?: readonly string[];
}

interface SdkModule {
  readonly query: (args: {
    prompt: string;
    options: Record<string, unknown>;
  }) => AsyncIterable<SdkMessage>;
}

const SDK = "@anthropic-ai/claude-agent-sdk";

export async function judge(request: JudgeRequest): Promise<Judgement> {
  const { query } = (await import(SDK)) as SdkModule;
  const messages = query({
    prompt: request.prompt,
    options: {
      model: JUDGE_MODEL,
      systemPrompt: request.system,
      tools: [],
      settingSources: [],
      // The structured answer takes a turn of its own, and the model at times
      // needs another to fit the schema: 3 turns failed 19 of 1965 M1 judgements.
      maxTurns: 5,
      thinking: { type: "disabled" },
      outputFormat: { type: "json_schema", schema: request.schema },
      env: { ...process.env, ENABLE_CLAUDEAI_MCP_SERVERS: "false" },
    },
  });
  for await (const message of messages) {
    if (message.type !== "result") continue;
    if (message.subtype !== "success" || message.structured_output === undefined) {
      throw new Error(
        `judge failed: ${message.subtype ?? "no result"} ${(message.errors ?? []).join("; ")}`,
      );
    }
    return {
      output: message.structured_output,
      cost: message.total_cost_usd ?? 0,
      models: Object.keys(message.modelUsage ?? {}).sort(),
    };
  }
  throw new Error("judge failed: the session ended without a result");
}
