// The lock file between kernel processes (`kernel-cli/commit`, Serialised
// commits): the process facts, the unreadable holder and the release.
import { describe, expect, it } from "vitest";

import { processLockWait, withLock } from "../lock.ts";
import type { LockWait } from "../lock.ts";
import { memoryStore } from "../store.ts";

describe("processLockWait", () => {
  it("knows its own process alive and an exited one dead", async () => {
    const wait = processLockWait();
    expect(wait.pid).toBe(process.pid);
    expect(wait.alive(process.pid)).toBe(true);
    expect(wait.alive(2 ** 22 + 12_345)).toBe(false);
    const start = wait.now();
    await wait.sleep(5);
    expect(wait.now()).toBeGreaterThanOrEqual(start);
  });
});

describe("withLock", () => {
  const LOCK = "/repo/.bdk/.machine/commit.lock";

  /** A wait whose clock starts at `start` and moves only with its sleeps. */
  function waitFrom(start: number, alive = true): LockWait {
    let now = start;
    return {
      waitMs: 3_000,
      pollMs: 1_000,
      pid: 7,
      now: () => now,
      sleep: (ms) => {
        now += ms;
        return Promise.resolve();
      },
      alive: () => alive,
    };
  }

  it("waits out an unreadable fresh file and reports an unknown holder", async () => {
    const store = memoryStore({ [LOCK]: '{"pid":"x"}' });
    const result = await withLock(store, LOCK, "01-1", waitFrom(0), () => Promise.resolve(1));
    expect(result).toEqual({ busy: { pid: 0, owner: "unknown", at: "unknown" } });
  });

  it("takes over an unreadable file older than a torn write", async () => {
    const store = memoryStore({ [LOCK]: "not json" });
    const result = await withLock(store, LOCK, "01-1", waitFrom(60_000), () => Promise.resolve(1));
    expect(result).toBe(1);
  });

  it("removes its lock when the work throws, and leaves a lock that is not its own", async () => {
    const store = memoryStore();
    await expect(
      withLock(store, LOCK, "01-1", waitFrom(0), () => Promise.reject(new Error("boom"))),
    ).rejects.toThrow("boom");
    expect(store.exists(LOCK)).toBe(false);
    await withLock(store, LOCK, "01-1", waitFrom(0), () => {
      store.write(LOCK, "someone else");
      return Promise.resolve();
    });
    expect(store.read(LOCK)).toBe("someone else");
  });
});
