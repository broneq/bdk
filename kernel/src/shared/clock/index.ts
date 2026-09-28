// The one source of `at` (`kernel-architecture`, shared entry (a)): ISO 8601
// UTC with milliseconds at a fixed width, so string order is time order;
// injectable so tests never read the wall clock.

export interface Clock {
  now(): string;
}

function format(date: Date): string {
  return date.toISOString();
}

export const systemClock: Clock = { now: () => format(new Date()) };

export function fixedClock(at: string): Clock {
  const date = new Date(at);
  if (Number.isNaN(date.getTime()))
    throw new Error(`fixed clock needs an ISO 8601 instant, got ${at}`);
  const fixed = format(date);
  return { now: () => fixed };
}
