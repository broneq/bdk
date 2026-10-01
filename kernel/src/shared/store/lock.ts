// An exclusive lock file between kernel processes (`kernel-cli/commit`,
// Serialised commits; T41-D12): the file names its holder's process, so a
// waiter takes over the lock of a process that no longer exists instead of
// waiting for it.
import type { Store } from "./store.ts";

export interface LockHolder {
  readonly pid: number;
  /** What the holder works on, for the refusal: a task id. */
  readonly owner: string;
  readonly at: string;
}

export interface LockWait {
  /** How long a waiter waits for a live holder before it gives up. */
  readonly waitMs: number;
  readonly pollMs: number;
  readonly pid: number;
  now(): number;
  sleep(ms: number): Promise<void>;
  /** Whether a process with this id exists. */
  alive(pid: number): boolean;
}

/** An unreadable lock file this old is a holder that died while writing it. */
const TORN_MS = 5_000;

export function processLockWait(): LockWait {
  return {
    waitMs: 60_000,
    pollMs: 100,
    pid: process.pid,
    now: () => Date.now(),
    sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
    alive: processAlive,
  };
}

function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM: the process exists under another user.
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/**
 * Runs `body` holding the lock at `path`, or returns the live holder that
 * kept it for `wait.waitMs`. The lock is removed when `body` settles.
 */
export async function withLock<T>(
  store: Store,
  path: string,
  owner: string,
  wait: LockWait,
  body: () => Promise<T>,
): Promise<T | { readonly busy: LockHolder }> {
  const mine: LockHolder = { pid: wait.pid, owner, at: new Date(wait.now()).toISOString() };
  const text = `${JSON.stringify(mine)}\n`;
  const start = wait.now();
  for (;;) {
    if (store.create(path, text)) break;
    const holder = holderOf(store.read(path));
    const torn = holder === undefined && wait.now() - (store.stat(path)?.mtimeMs ?? 0) > TORN_MS;
    if (torn || (holder !== undefined && !wait.alive(holder.pid))) {
      // Two waiters may both remove a dead holder's file; `create` lets one of them in.
      store.remove(path);
      continue;
    }
    if (wait.now() - start >= wait.waitMs) {
      return { busy: holder ?? { pid: 0, owner: "unknown", at: "unknown" } };
    }
    await wait.sleep(wait.pollMs);
  }
  try {
    return await body();
  } finally {
    if (store.read(path) === text) store.remove(path);
  }
}

function holderOf(text: string | undefined): LockHolder | undefined {
  if (text === undefined) return undefined;
  try {
    const value = JSON.parse(text) as Partial<LockHolder>;
    return typeof value.pid === "number" &&
      typeof value.owner === "string" &&
      typeof value.at === "string"
      ? { pid: value.pid, owner: value.owner, at: value.at }
      : undefined;
  } catch {
    return undefined;
  }
}
