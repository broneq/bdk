// One session as diagnostics reports it: its agents with time, turns, tokens and cost share, the
// stages of its main thread, and the host's cost (design D3, D9). Pure: the store hands in the
// parsed transcripts and the subagents' meta files.

import type { HostCost, Tokens, Transcript, ToolUse } from "./transcript.ts";

/** A subagent file pair as the store found it under `<session>/subagents/`. */
export interface SubagentFiles {
  /** `agent-<id>`'s id. */
  readonly id: string;
  /** Path of the `.jsonl`, relative to the transcripts directory. */
  readonly file: string;
  /** Null when the `.jsonl` is missing or unreadable. */
  readonly transcript: Transcript | null;
  readonly meta: {
    readonly agentType: string | null;
    readonly description: string | null;
    readonly toolUseId: string | null;
  } | null;
}

export interface SessionFiles {
  readonly id: string;
  /** Path of the main `.jsonl`, relative to the transcripts directory. */
  readonly file: string;
  readonly main: Transcript;
  readonly subagents: readonly SubagentFiles[];
}

export interface ModelTokens extends Tokens {
  readonly model: string;
  readonly turns: number;
}

export interface Agent {
  /** `main` for the main thread, else the host's agent id. */
  readonly id: string;
  readonly type: string;
  readonly description: string | null;
  /** The agent whose `Agent` call started it; null for the main thread or when unknown. */
  readonly parent: string | null;
  /** The main-thread stage it started in, by its start time; null before the first stage. */
  readonly stage: number | null;
  readonly file: string | null;
  /** `<file>:<line>` of the `Agent` call that started it, when found. */
  readonly startedBy: string | null;
  readonly state: "ok" | "missing";
  readonly start: string | null;
  readonly end: string | null;
  readonly wallMs: number | null;
  readonly turns: number;
  readonly toolCalls: number;
  readonly errors: number;
  readonly models: readonly ModelTokens[];
  /** Share of the host's cost; null when the host wrote none or a model has no host cost. */
  readonly costUSD: number | null;
  readonly unknownLines: number;
}

export interface Stage {
  readonly n: number;
  readonly skill: string;
  readonly cite: string;
  readonly start: string;
  readonly end: string;
  readonly wallMs: number;
  readonly agents: readonly string[];
  readonly tokens: Tokens;
  readonly costUSD: number | null;
}

export interface Session {
  readonly id: string;
  readonly file: string;
  readonly start: string | null;
  readonly end: string | null;
  readonly wallMs: number | null;
  readonly cost: HostCost | null;
  readonly agents: readonly Agent[];
  readonly stages: readonly Stage[];
  readonly models: readonly (ModelTokens & { readonly costUSD: number | null })[];
}

/**
 * Weights of a token kind relative to an input token: the ratios of Anthropic's list prices,
 * which hold across models. Only the share of the host's cost is computed from them (design D3).
 */
export const WEIGHTS: Readonly<Record<keyof Tokens, number>> = {
  input: 1,
  output: 5,
  cacheRead: 0.1,
  cacheWrite5m: 1.25,
  cacheWrite1h: 2,
};

const AGENT_TOOLS: ReadonlySet<string> = new Set(["Agent", "Task"]);

export const ZERO: Tokens = { input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 };

export function addTokens(a: Tokens, b: Tokens): Tokens {
  return {
    input: a.input + b.input,
    output: a.output + b.output,
    cacheRead: a.cacheRead + b.cacheRead,
    cacheWrite5m: a.cacheWrite5m + b.cacheWrite5m,
    cacheWrite1h: a.cacheWrite1h + b.cacheWrite1h,
  };
}

export function units(tokens: Tokens): number {
  return (Object.keys(WEIGHTS) as (keyof Tokens)[]).reduce(
    (sum, key) => sum + tokens[key] * WEIGHTS[key],
    0,
  );
}

function ms(at: string): number {
  return Date.parse(at);
}

function between(start: string | null, end: string | null): number | null {
  if (start === null || end === null) return null;
  const span = ms(end) - ms(start);
  return Number.isFinite(span) ? Math.max(0, span) : null;
}

/** The host names a 1M-context model `<model>[1m]` in `cost-state` and `<model>` in a transcript. */
function hostModel(name: string): string {
  return name.replace(/\[[^\]]*\]$/, "");
}

function byModel(transcript: Transcript, filter?: (at: string) => boolean): ModelTokens[] {
  const models = new Map<string, ModelTokens>();
  for (const event of transcript.events) {
    if (event.kind !== "usage" || (filter !== undefined && !filter(event.at))) continue;
    const earlier = models.get(event.model) ?? { model: event.model, turns: 0, ...ZERO };
    models.set(event.model, {
      ...addTokens(earlier, event.tokens),
      model: event.model,
      turns: earlier.turns + 1,
    });
  }
  return [...models.values()].sort((a, b) => a.model.localeCompare(b.model));
}

function toolStats(transcript: Transcript): { calls: number; errors: number } {
  let calls = 0;
  let errors = 0;
  for (const event of transcript.events) {
    if (event.kind === "tool-use") calls += 1;
    else if (event.kind === "tool-result" && event.error) errors += 1;
  }
  return { calls, errors };
}

interface AgentCall {
  readonly use: ToolUse;
  readonly parent: string;
  readonly file: string;
}

function agentCalls(owner: string, file: string, transcript: Transcript): AgentCall[] {
  return transcript.events.flatMap((event) =>
    event.kind === "tool-use" && AGENT_TOOLS.has(event.name)
      ? [{ use: event, parent: owner, file }]
      : [],
  );
}

function inputText(input: unknown, key: string): string | null {
  if (typeof input !== "object" || input === null) return null;
  const value = (input as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

/** The main thread's `Skill` calls, each a stage until the next one or the end of the session. */
function stagesOf(
  files: SessionFiles,
  end: string | null,
): Omit<Stage, "agents" | "tokens" | "costUSD">[] {
  const calls = files.main.events.filter(
    (event): event is ToolUse => event.kind === "tool-use" && event.name === "Skill",
  );
  return calls.map((call, index) => {
    const stop = calls[index + 1]?.at ?? end ?? call.at;
    return {
      n: index + 1,
      skill: inputText(call.input, "skill") ?? "unknown",
      cite: `${files.file}:${String(call.line)}`,
      start: call.at,
      end: stop,
      wallMs: between(call.at, stop) ?? 0,
    };
  });
}

function stageAt(
  stages: readonly { readonly n: number; readonly start: string; readonly end: string }[],
  at: string | null,
): number | null {
  if (at === null) return null;
  const time = ms(at);
  let found: number | null = null;
  for (const stage of stages) if (ms(stage.start) <= time) found = stage.n;
  return found;
}

/** Price per weighted unit of each host model; empty without a host cost. */
function unitPrices(cost: HostCost | null, totals: readonly ModelTokens[]): Map<string, number> {
  const prices = new Map<string, number>();
  if (cost === null) return prices;
  const hostCost = new Map<string, number>();
  for (const [model, usd] of Object.entries(cost.byModel)) {
    const key = hostModel(model);
    hostCost.set(key, (hostCost.get(key) ?? 0) + usd);
  }
  for (const total of totals) {
    const usd = hostCost.get(total.model);
    const weighted = units(total);
    if (usd !== undefined && weighted > 0) prices.set(total.model, usd / weighted);
  }
  return prices;
}

function priced(
  models: readonly ModelTokens[],
  prices: ReadonlyMap<string, number>,
): number | null {
  let sum = 0;
  for (const model of models) {
    const price = prices.get(model.model);
    if (price === undefined) return null;
    sum += units(model) * price;
  }
  return sum;
}

function mergeModels(lists: readonly (readonly ModelTokens[])[]): ModelTokens[] {
  const merged = new Map<string, ModelTokens>();
  for (const list of lists) {
    for (const model of list) {
      const earlier = merged.get(model.model);
      merged.set(
        model.model,
        earlier === undefined
          ? model
          : {
              ...addTokens(earlier, model),
              model: model.model,
              turns: earlier.turns + model.turns,
            },
      );
    }
  }
  return [...merged.values()].sort((a, b) => a.model.localeCompare(b.model));
}

export function buildSession(files: SessionFiles): Session {
  const start = files.main.first;
  const ends = [files.main.last, ...files.subagents.map((sub) => sub.transcript?.last ?? null)]
    .filter((at): at is string => at !== null)
    .sort();
  const end = ends.at(-1) ?? null;
  const stageSpans = stagesOf(files, end);

  const calls = [
    ...agentCalls("main", files.file, files.main),
    ...files.subagents.flatMap((sub) =>
      sub.transcript === null ? [] : agentCalls(sub.id, sub.file, sub.transcript),
    ),
  ];
  const callById = new Map(calls.map((call) => [call.use.id, call]));
  const matched = new Set<string>();

  const subagents = files.subagents.map((sub) => {
    const call =
      sub.meta?.toolUseId === null || sub.meta === null
        ? undefined
        : callById.get(sub.meta.toolUseId);
    if (call !== undefined) matched.add(call.use.id);
    return { sub, call };
  });

  const mainModels = byModel(files.main);
  const mainStats = toolStats(files.main);
  const raw: Omit<Agent, "costUSD">[] = [
    {
      id: "main",
      type: "main",
      description: null,
      parent: null,
      stage: null,
      file: files.file,
      startedBy: null,
      state: "ok",
      start,
      end: files.main.last,
      wallMs: between(start, files.main.last),
      turns: mainModels.reduce((sum, model) => sum + model.turns, 0),
      toolCalls: mainStats.calls,
      errors: mainStats.errors,
      models: mainModels,
      unknownLines: files.main.unknown,
    },
  ];
  for (const { sub, call } of subagents) {
    const transcript = sub.transcript;
    const models = transcript === null ? [] : byModel(transcript);
    const stats = transcript === null ? { calls: 0, errors: 0 } : toolStats(transcript);
    const agentStart = transcript?.first ?? call?.use.at ?? null;
    raw.push({
      id: sub.id,
      type: sub.meta?.agentType ?? inputText(call?.use.input, "subagent_type") ?? "unknown",
      description: sub.meta?.description ?? inputText(call?.use.input, "description"),
      parent: call?.parent ?? null,
      stage: stageAt(stageSpans, agentStart),
      file: transcript === null ? null : sub.file,
      startedBy: call === undefined ? null : `${call.file}:${String(call.use.line)}`,
      state: transcript === null || transcript.lines === 0 ? "missing" : "ok",
      start: agentStart,
      end: transcript?.last ?? null,
      wallMs: between(transcript?.first ?? null, transcript?.last ?? null),
      turns: models.reduce((sum, model) => sum + model.turns, 0),
      toolCalls: stats.calls,
      errors: stats.errors,
      models,
      unknownLines: transcript?.unknown ?? 0,
    });
  }
  for (const call of calls) {
    if (matched.has(call.use.id)) continue;
    raw.push({
      id: `missing-${call.use.id}`,
      type: inputText(call.use.input, "subagent_type") ?? "unknown",
      description: inputText(call.use.input, "description"),
      parent: call.parent,
      stage: stageAt(stageSpans, call.use.at),
      file: null,
      startedBy: `${call.file}:${String(call.use.line)}`,
      state: "missing",
      start: call.use.at,
      end: null,
      wallMs: null,
      turns: 0,
      toolCalls: 0,
      errors: 0,
      models: [],
      unknownLines: 0,
    });
  }

  const totals = mergeModels(raw.map((agent) => agent.models));
  const prices = unitPrices(files.main.cost, totals);
  const agents: Agent[] = raw.map((agent) => ({
    ...agent,
    costUSD: agent.state === "missing" ? null : priced(agent.models, prices),
  }));

  const stages: Stage[] = stageSpans.map((span) => {
    const inStage = (at: string): boolean =>
      (ms(at) >= ms(span.start) && ms(at) < ms(span.end)) ||
      (span.n === stageSpans.length && ms(at) >= ms(span.start));
    const own = byModel(files.main, inStage);
    const members = agents.filter((agent) => agent.id !== "main" && agent.stage === span.n);
    const models = mergeModels([own, ...members.map((agent) => agent.models)]);
    const memberCosts = members.map((agent) => (agent.state === "missing" ? 0 : agent.costUSD));
    const ownCost = priced(own, prices);
    return {
      ...span,
      agents: members.map((agent) => agent.id),
      tokens: models.reduce<Tokens>((sum, model) => addTokens(sum, model), ZERO),
      costUSD:
        ownCost === null || memberCosts.some((cost) => cost === null)
          ? null
          : memberCosts.reduce<number>((sum, cost) => sum + (cost ?? 0), ownCost),
    };
  });

  return {
    id: files.id,
    file: files.file,
    start,
    end,
    wallMs: between(start, end),
    cost: files.main.cost,
    agents,
    stages,
    models: totals.map((total) => {
      const price = prices.get(total.model);
      return { ...total, costUSD: price === undefined ? null : units(total) * price };
    }),
  };
}
