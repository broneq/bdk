// `appendEntry`'s kernel-only transition fields (T24 design D-13): only the
// `hooks` slice passes them; `log add` builds its drafts from argv and cannot.
import { describe, expect, it } from "vitest";

import { readDocument } from "../../shared/store/index.ts";
import { logRegistrations } from "../index.ts";
import { appendEntry } from "../use-cases/append.ts";
import { withChangeIndex } from "../use-cases/deps.ts";
import { BRANCH, CHANGE, DIR, fakeGit, logDeps, repository, ROOT, runBdk } from "./support.ts";

const change = { id: CHANGE, dir: DIR, projectRoot: ROOT, branch: BRANCH };

describe("appendEntry: transition fields", () => {
  it("writes gate, session, command, skip-verify and a kernel-only source", async () => {
    const store = repository();
    const deps = logDeps(store);
    const result = await withChangeIndex(deps, change, (index) =>
      appendEntry(
        deps,
        change,
        index,
        {
          type: "transition",
          summary: "to plan",
          refs: ["design.md"],
          body: "",
          status: "accepted",
          to: "plan",
          gate: "gate:design",
          session: "sess-1",
          command: "/bdk:execute --skip-verify",
          skipVerify: true,
          source: "user",
        },
        { dedupe: false },
      ),
    );
    if ("refused" in result) throw new Error(result.why);
    const document = readDocument(store, `${ROOT}/${result.path}`);
    expect(document !== undefined && "data" in document && document.data).toMatchObject({
      type: "transition",
      source: "user",
      to: "plan",
      gate: "gate:design",
      session: "sess-1",
      command: "/bdk:execute --skip-verify",
      "skip-verify": true,
    });
  });

  it("stamps source policy and leaves unset fields out", async () => {
    const store = repository();
    const deps = logDeps(store);
    const result = await withChangeIndex(deps, change, (index) =>
      appendEntry(
        deps,
        change,
        index,
        {
          type: "transition",
          summary: "to close",
          refs: ["change.md"],
          body: "",
          to: "close",
          source: "policy",
        },
        { dedupe: false },
      ),
    );
    if ("refused" in result) throw new Error(result.why);
    const document = readDocument(store, `${ROOT}/${result.path}`);
    const data = document !== undefined && "data" in document ? document.data : {};
    expect(data).toMatchObject({ source: "policy", to: "close" });
    expect(Object.keys(data)).not.toContain("skip-verify");
    expect(Object.keys(data)).not.toContain("session");
  });

  it("keeps log add away from transitions and their fields", async () => {
    const store = repository();
    const git = fakeGit();
    const run = (argv: readonly string[]) =>
      runBdk(logRegistrations(logDeps(store, git)), store, git, argv);
    expect(
      (await run(["log", "add", "transition", "to plan", "--ref", "a.md", "--json"])).json,
    ).toMatchObject({ refused: true });
    expect(
      (await run(["log", "add", "decision", "x", "--ref", "a.md", "--source", "user", "--json"]))
        .json,
    ).toMatchObject({ rule: "input/forbidden-field" });
  });
});
