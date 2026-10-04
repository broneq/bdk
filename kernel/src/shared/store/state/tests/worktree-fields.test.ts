// The fields T45 adds for part worktrees (`kernel-state`, Attempt record,
// Dispatch package): the merge ticket's conflicts and the package's work root.
import { describe, expect, it } from "vitest";

import { attemptKind } from "../attempt.ts";
import { dispatchKind } from "../dispatch.ts";
import * as example from "./examples.ts";
import { issues } from "./issues.ts";

describe("dispatch package workdir", () => {
  it("takes an absolute path and refuses a relative one", () => {
    const workdir = "/repo/.bdk/.machine/worktrees/2026-09-25-passwordless-login/02";
    expect(issues(dispatchKind.schema, { ...example.dispatch, workdir })).toStrictEqual([]);
    expect(
      issues(dispatchKind.schema, { ...example.dispatch, workdir: ".bdk/.machine/worktrees/x/02" }),
    ).toStrictEqual(["workdir"]);
  });
});

describe("attempt record merge", () => {
  it("keeps merge and conflicts together", () => {
    const merge = { ...example.attempt, merge: true, conflicts: ["pnpm-lock.yaml"] };
    expect(issues(attemptKind.schema, merge)).toStrictEqual([]);
    expect(issues(attemptKind.schema, { ...example.attempt, merge: true })).toStrictEqual([
      "conflicts",
    ]);
    expect(
      issues(attemptKind.schema, { ...example.attempt, conflicts: ["pnpm-lock.yaml"] }),
    ).toStrictEqual(["merge"]);
  });
});
