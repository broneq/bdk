// `kernel-cli/log` (T20 records) through the built bundle in real
// repositories: one case per exit code and per declared rule of `log add`,
// `list`, `show` and `resolve`, every output validated against its schema,
// and the T20 acceptance cases on the ledger; `log add --category` (P8) and
// `log ingest` (T23) with a hand-written attempt record and dispatch package.
import { execFileSync } from "node:child_process";
import { readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  answered,
  bdk,
  bdkAsync,
  outsideRepository,
  read,
  refused,
  repository,
} from "../../../tests/support/repo.ts";
import { executed, opened as openedTicket, started } from "../../attempt/tests/e2e-support.ts";
import { fileStore, stampPackage, writeDocument } from "../../shared/store/index.ts";

/** A repository with an open Change; answers the root and the Change directory. */
function opened(): { root: string; dir: string } {
  const root = repository();
  const result = bdk(["change", "new", "Users log in with a one-time link", "--json"], root);
  expect(result.code, result.stdout).toBe(0);
  const id = (result.json as { change: string }).change;
  return { root, dir: join(root, ".bdk/changes", id) };
}

/** Distinct words: digits normalise to one `#` in the dedupe key, so numbered summaries collide. */
function word(n: number): string {
  return String.fromCharCode(97 + n).repeat(3);
}

/** Backdates `dir` and its files past the index's 2 s racy-time guard. */
function settle(dir: string): void {
  const past = new Date(Date.now() - 60_000);
  for (const name of readdirSync(dir)) utimesSync(join(dir, name), past, past);
  utimesSync(dir, past, past);
}

function logFiles(dir: string): string[] {
  return readdirSync(join(dir, "log"));
}

function add(root: string, ...args: string[]): { entry: { id: string } } {
  return answered(bdk(["log", "add", ...args, "--json"], root), "output/log-add.json") as {
    entry: { id: string };
  };
}

describe("bdk log add", () => {
  it("exit 0: appends a stamped entry file", () => {
    const { root, dir } = opened();
    const result = answered(
      bdk(
        [
          "log",
          "add",
          "finding",
          "expired link accepted",
          "--ref",
          "src/a.ts",
          "--ref",
          "02-3",
          "--json",
        ],
        root,
      ),
      "output/log-add.json",
    ) as {
      entry: { id: string; source: string; author: string };
      path: string;
    };
    expect(result.entry).toMatchObject({ source: "kernel", author: "BDK Test <test@example.com>" });
    expect(logFiles(dir)).toContain(result.path.split("/").at(-1));
  });

  it("exit 0: --body - reads the body from stdin", () => {
    const { root, dir } = opened();
    const result = bdk(
      ["log", "add", "decision", "Keep magic links", "--ref", "design.md", "--body", "-", "--json"],
      root,
      {
        stdin: "Chosen for the MVP.\n",
      },
    );
    const path = (result.json as { path: string }).path;
    expect(read(dir, `log/${path.split("/").at(-1) ?? ""}`)).toContain("Chosen for the MVP.");
  });

  it("acceptance: --source user is exit 3 input/forbidden-field and writes no file [TSH-2]", () => {
    const { root, dir } = opened();
    const before = logFiles(dir);
    refused(
      bdk(
        ["log", "add", "decision", "Mine", "--ref", "design.md", "--source", "user", "--json"],
        root,
      ),
      3,
      "input/forbidden-field",
    );
    expect(logFiles(dir)).toEqual(before);
  });

  it("exit 3 input/not-found: --supersedes names no entry", () => {
    const { root } = opened();
    refused(
      bdk(
        [
          "log",
          "add",
          "decision",
          "New",
          "--ref",
          "design.md",
          "--supersedes",
          "L-zzzzzzzz",
          "--json",
        ],
        root,
      ),
      3,
      "input/not-found",
    );
  });

  it("exit 2 policy/no-open-ticket: --ticket without an open attempt", () => {
    const { root } = opened();
    refused(
      bdk(
        ["log", "add", "finding", "x", "--ref", "a.ts", "--ticket", "A-00000000", "--json"],
        root,
      ),
      2,
      "policy/no-open-ticket",
    );
  });

  it("exit 2 policy/no-active-change", () => {
    refused(
      bdk(["log", "add", "finding", "x", "--ref", "a.ts", "--json"], repository()),
      2,
      "policy/no-active-change",
    );
  });

  it("exit 4 state/ledger-invalid: a log file fails its schema", () => {
    const { root, dir } = opened();
    fileStore().write(
      join(dir, "log/20260101T000000Z-finding-L-broken00.md"),
      "---\nschema: 1\n---\n",
    );
    refused(
      bdk(["log", "add", "finding", "x", "--ref", "a.ts", "--json"], root),
      4,
      "state/ledger-invalid",
    );
  });

  it("exit 5 runtime/git-missing: the author needs git", () => {
    const { root } = opened();
    refused(
      bdk(["log", "add", "finding", "x", "--ref", "a.ts", "--json"], root, { git: false }),
      5,
      "runtime/git-missing",
    );
  });

  it("acceptance: 15 parallel adds get 15 distinct ids without a lock [NFR-TEAM]", async () => {
    const { root, dir } = opened();
    const before = logFiles(dir).length;
    const results = await Promise.all(
      Array.from({ length: 15 }, (_, n) =>
        bdkAsync(
          ["log", "add", "observation", `parallel ${word(n)}`, "--ref", "a.ts", "--json"],
          root,
        ),
      ),
    );
    for (const result of results) expect(result.code, result.stdout + result.stderr).toBe(0);
    const ids = results.map((result) => (result.json as { entry: { id: string } }).entry.id);
    expect(new Set(ids).size).toBe(15);
    expect(logFiles(dir)).toHaveLength(before + 15);
    expect(readdirSync(join(dir, "log")).some((name) => name.endsWith(".lock"))).toBe(false);
  });
});

describe("bdk log list", () => {
  it("exit 0: entries written within one second list in write order with distinct times", () => {
    const { root } = opened();
    // Several kernel calls fit in one second; with second-precision times
    // their order fell to the random ids.
    const written = Array.from({ length: 8 }, (_, n) =>
      add(root, "finding", word(n), "--ref", "src/a.ts"),
    ).map((report) => report.entry.id);
    const page = answered(
      bdk(["log", "list", "--type", "finding", "--json"], root),
      "output/log-list.json",
    ) as { items: { id: string; at: string }[] };
    expect(page.items.map((item) => item.id)).toStrictEqual(written);
    expect(new Set(page.items.map((item) => item.at)).size).toBe(written.length);
  });

  it("exit 0: a hand-written entry with a second-form at reads as .000 and lists before a later one of its second", () => {
    const { root, dir } = opened();
    const later = add(root, "finding", "aaa", "--ref", "src/a.ts") as {
      entry: { id: string; at: string };
    };
    const second = later.entry.at.slice(0, 19);
    writeFileSync(
      join(dir, "log", `${second.replaceAll("-", "").replaceAll(":", "")}Z-finding-L-00000000.md`),
      [
        "---",
        "schema: 1",
        "id: L-00000000",
        "type: finding",
        "summary: written by hand",
        "status: proposed",
        "source: kernel",
        "author: BDK Test <test@example.com>",
        `at: ${second}Z`,
        "refs:",
        "  - src/a.ts",
        "---",
        "",
      ].join("\n"),
    );
    const page = answered(
      bdk(["log", "list", "--type", "finding", "--json"], root),
      "output/log-list.json",
    ) as { items: { id: string; at: string }[] };
    expect(page.items).toStrictEqual([
      expect.objectContaining({ id: "L-00000000", at: `${second}.000Z` }),
      expect.objectContaining({ id: later.entry.id, at: later.entry.at }),
    ]);
  });

  it("exit 0: entries with derived status, filtered by type", () => {
    const { root } = opened();
    add(root, "finding", "one", "--ref", "src/a.ts");
    const page = answered(
      bdk(["log", "list", "--type", "finding", "--json"], root),
      "output/log-list.json",
    ) as { items: { type: string; status: string }[] };
    expect(page.items).toEqual([expect.objectContaining({ type: "finding", status: "proposed" })]);
  });

  it("exit 0: --since-ticket-start keeps what was written after the ticket opened; exit 3 for an unknown ticket", () => {
    const { root, dir } = opened();
    writeDocument(fileStore(), join(dir, "log/20260925T090000Z-risk-L-00000001.md"), {
      data: {
        schema: 1,
        id: "L-00000001",
        type: "risk",
        summary: "written before the ticket",
        status: "proposed",
        source: "kernel",
        author: "BDK Test <test@example.com>",
        at: "2026-09-25T09:00:00Z",
        refs: ["a"],
      },
      body: "",
    });
    ticketed(dir);
    const later = add(root, "finding", "written during the ticket", "--ref", "src/a.ts").entry.id;
    const page = answered(
      bdk(["log", "list", "--since-ticket-start", TICKET, "--json"], root),
      "output/log-list.json",
    ) as { items: { id: string }[] };
    const ids = page.items.map((item) => item.id);
    expect(ids).toContain(later);
    expect(ids).not.toContain("L-00000001");
    refused(
      bdk(["log", "list", "--since-ticket-start", "A-00000000", "--json"], root),
      3,
      "input/not-found",
    );
  });

  it("acceptance: under 200 ms at 1 000 entries on the second run, with its telemetry line [NFR-LAT-1] [R-1]", () => {
    const { root, dir } = opened();
    const store = fileStore();
    for (let n = 0; n < 1000; n++) {
      const id = `L-${n.toString(36).padStart(8, "0")}`;
      writeDocument(store, join(dir, `log/20260925T100000Z-observation-${id}.md`), {
        data: {
          schema: 1,
          id,
          type: "observation",
          summary: `observation ${n.toString(36).replace(/\d/g, (digit) => word(Number(digit)))}`,
          status: "proposed",
          source: "kernel",
          author: "BDK Test <test@example.com>",
          at: "2026-09-25T10:00:00.000Z",
          refs: ["src/a.ts"],
        },
        body: "",
      });
    }
    settle(join(dir, "log"));
    settle(dir);
    expect(bdk(["log", "list", "--all", "--json"], root).code).toBe(0);
    const second = bdk(["log", "list", "--all", "--json"], root);
    expect(second.code).toBe(0);
    expect((second.json as { total: number }).total).toBe(1001);

    const lines = read(root, ".bdk/.machine/telemetry/log-list.jsonl").trim().split("\n");
    expect(lines).toHaveLength(2);
    const last = JSON.parse(lines[1] ?? "") as { ms: number; entries: number; refreshed: boolean };
    expect(last).toMatchObject({ entries: 1001, refreshed: false });
    expect(last.ms).toBeLessThan(200);
  });

  it("acceptance: the index deleted and rebuilt gives identical output [EC-2]", () => {
    const { root } = opened();
    add(root, "finding", "one", "--ref", "src/a.ts");
    add(root, "risk", "two", "--ref", "design.md");
    const before = bdk(["log", "list", "--json"], root).stdout;
    for (const suffix of ["", "-wal", "-shm"]) {
      rmSync(join(root, `.bdk/.machine/index.sqlite${suffix}`), { force: true });
    }
    expect(bdk(["log", "list", "--json"], root).stdout).toBe(before);
  });

  it("exit 2 policy/no-active-change", () => {
    refused(bdk(["log", "list", "--json"], repository()), 2, "policy/no-active-change");
  });

  it("exit 3 input/invalid-argument: an unknown --type", () => {
    const { root } = opened();
    refused(bdk(["log", "list", "--type", "note", "--json"], root), 3, "input/invalid-argument");
  });

  it("exit 4 state/change-dir-missing", () => {
    const { root, dir } = opened();
    rmSync(dir, { recursive: true });
    refused(bdk(["log", "list", "--json"], root), 4, "state/change-dir-missing");
  });

  it("exit 5 runtime/not-a-repo", () => {
    refused(bdk(["log", "list", "--json"], outsideRepository()), 5, "runtime/not-a-repo");
  });
});

describe("bdk log show and resolve", () => {
  it("exit 0: shows an entry with its body", () => {
    const { root } = opened();
    const { entry } = add(
      root,
      "decision",
      "Keep magic links",
      "--ref",
      "design.md",
      "--body",
      "Why.",
    );
    const shown = answered(bdk(["log", "show", entry.id, "--json"], root), "output/log-show.json");
    expect(shown).toMatchObject({ entry: { id: entry.id, body: "Why." } });
  });

  it("show exit 3 input/not-found", () => {
    const { root } = opened();
    refused(bdk(["log", "show", "L-zzzzzzzz", "--json"], root), 3, "input/not-found");
  });

  it("show exit 3 input/invalid-argument: a malformed id", () => {
    const { root } = opened();
    refused(bdk(["log", "show", "nope", "--json"], root), 3, "input/invalid-argument");
  });

  it("exit 0: resolve supersedes with --by, then refuses a second move", () => {
    const { root } = opened();
    const old = add(root, "decision", "Magic links", "--ref", "design.md").entry.id;
    const next = add(root, "decision", "WebAuthn", "--ref", "design.md").entry.id;
    answered(
      bdk(
        ["log", "resolve", old, "superseded", "--by", next, "--reason", "WebAuthn wins", "--json"],
        root,
      ),
      "output/log-resolve.json",
    );
    expect(bdk(["log", "show", old, "--json"], root).json).toMatchObject({ supersededBy: next });
    refused(
      bdk(["log", "resolve", old, "accepted", "--json"], root),
      2,
      "policy/invalid-transition",
    );
  });

  it("resolve exit 3 input/not-found", () => {
    const { root } = opened();
    refused(
      bdk(["log", "resolve", "L-zzzzzzzz", "resolved", "--json"], root),
      3,
      "input/not-found",
    );
  });

  it("resolve exit 4 state/corrupted-index", () => {
    const { root } = opened();
    const index = join(root, ".bdk/.machine/index.sqlite");
    rmSync(index, { force: true });
    fileStore().write(join(index, "x"), "");
    refused(
      bdk(["log", "resolve", "L-zzzzzzzz", "resolved", "--json"], root),
      4,
      "state/corrupted-index",
    );
  });

  it("resolve exit 5 runtime/not-a-repo", () => {
    refused(
      bdk(["log", "resolve", "L-zzzzzzzz", "resolved", "--json"], outsideRepository()),
      5,
      "runtime/not-a-repo",
    );
  });
});

const TICKET = "A-9c2d4f6h";

/** An open ticket of `role` with its dispatch package; answers the package's report path. */
function ticketed(dir: string, closed = false, role = "verifier"): string {
  const id = dir.split("/").at(-1) ?? "";
  const report = `.bdk/changes/${id}/reports/02-${role}-${TICKET}.md`;
  writeDocument(fileStore(), join(dir, `attempts/verifier-02-${TICKET}.md`), {
    data: {
      schema: 1,
      ticket: TICKET,
      loop: "verifier",
      target: "02",
      attempt: 1,
      of: 2,
      scope: "full",
      "opened-at": "2026-09-25T10:00:00.000Z",
      author: "BDK Test <test@example.com>",
      ...(closed ? { "closed-at": "2026-09-25T10:30:00.000Z", outcome: "ok" } : {}),
    },
    body: "",
  });
  writeDocument(fileStore(), join(dir, `dispatch/02-${role}-${TICKET}.md`), {
    data: {
      schema: 1,
      ticket: TICKET,
      target: "02",
      role,
      adapter: role === "implementer" ? "worker" : "reader",
      attempt: 1,
      of: 2,
      scope: "full",
      at: "2026-09-25T10:00:01.000Z",
      "kernel-version": "3.0.0",
      "template-hash": `sha256:${"0".repeat(64)}`,
      report,
      rules: [],
    },
    body: "",
  });
  stampPackage(fileStore(), dir, TICKET, `.bdk/changes/${id}/dispatch/02-${role}-${TICKET}.md`);
  return report;
}

describe("bdk log add --category (P8)", () => {
  const blocker = (root: string, ...extra: string[]) =>
    answered(
      bdk(
        [
          "log",
          "add",
          "blocker",
          "naming is inconsistent",
          "--ref",
          "02",
          "--ticket",
          TICKET,
          ...extra,
          "--json",
        ],
        root,
      ),
      "output/log-add.json",
    ) as { entry: { id: string; type: string; review: boolean }; downgraded?: unknown };

  it("exit 0: a verifier blocker without a category is an observation for review [TSH-12]", () => {
    const { root, dir } = opened();
    ticketed(dir);
    const result = blocker(root);
    expect(result.entry).toMatchObject({ type: "observation", review: true });
    expect(result.downgraded).toStrictEqual({ type: "blocker", category: null });
    const shown = bdk(["log", "show", result.entry.id, "--json"], root);
    expect((shown.json as { entry: { body: string } }).entry.body).toMatch(
      /^Downgraded from blocker: category none is not a blocking category \(P8\)\./,
    );
  });

  it("exit 0: a verifier blocker in a blocking category stays a blocker", () => {
    const { root, dir } = opened();
    ticketed(dir);
    const result = blocker(root, "--category", "false-code-claim");
    expect(result.entry.type).toBe("blocker");
    expect(result.downgraded).toBeUndefined();
  });

  it("exit 0: an implementer blocker is never downgraded", () => {
    const { root, dir } = opened();
    ticketed(dir, false, "implementer");
    expect(blocker(root).entry.type).toBe("blocker");
  });
});

const REPORT =
  "---\n" +
  "status: done-with-concerns\n" +
  "files: []\n" +
  "entries: []\n" +
  "evidence: []\n" +
  "---\n" +
  "# Plan verification\n\nPart 02 leans on a helper that does not exist.\n";

function ingest(root: string, stdin: string, ...args: string[]) {
  return bdk(["log", "ingest", "--ticket", TICKET, ...args, "--json"], root, { stdin });
}

describe("bdk log ingest", () => {
  it("exit 0: the report is stored with the stamped fields; no entry is written", () => {
    const { root, dir } = opened();
    const report = ticketed(dir);
    const id = add(root, "observation", "naming drifts", "--ref", "02", "--ticket", TICKET).entry
      .id;
    const result = answered(
      ingest(root, REPORT.replace("entries: []", `entries: [${id}]`)),
      "output/log-ingest.json",
    );
    expect(result).toStrictEqual({
      ticket: TICKET,
      role: "verifier",
      path: report,
      status: "done-with-concerns",
      entries: [id],
      replaced: false,
    });
    const stored = read(root, report);
    expect(stored).toMatch(/^at: .+Z\n/m);
    expect(stored.replace(/^at: .*\n/m, "")).toBe(
      `---\nschema: 1\nticket: ${TICKET}\nrole: verifier\nstatus: done-with-concerns\n` +
        `files: []\nentries: [ ${id} ]\nevidence: []\n---\n` +
        "# Plan verification\n\nPart 02 leans on a helper that does not exist.\n",
    );
    // The Change's opening transition and the observation; ingest adds none.
    expect(logFiles(dir)).toHaveLength(2);
  });

  it("exit 0: a second call under the same ticket replaces the report", () => {
    const { root, dir } = opened();
    const report = ticketed(dir);
    answered(ingest(root, REPORT), "output/log-ingest.json");
    const again = answered(
      ingest(root, REPORT.replace("# Plan", "# Second plan")),
      "output/log-ingest.json",
    );
    expect(again.replaced).toBe(true);
    expect(read(root, report)).toContain("# Second plan verification");
  });

  it("exit 3 input/invalid-envelope: a wrong status names the field and its line; nothing written", () => {
    const { root, dir } = opened();
    const report = ticketed(dir);
    const result = refused(
      ingest(root, REPORT.replace("status: done-with-concerns", "status: finished")),
      3,
      "input/invalid-envelope",
    );
    expect(result.why).toMatch(/^line 2: status is invalid/);
    expect(() => read(root, report)).toThrow();
  });

  it("exit 3 input/forbidden-field: the frontmatter carries role", () => {
    const { root, dir } = opened();
    ticketed(dir);
    const result = refused(
      ingest(root, REPORT.replace("files: []", "role: verifier\nfiles: []")),
      3,
      "input/forbidden-field",
    );
    expect(result.why).toBe("line 3: role is stamped by the kernel");
  });

  it("exit 2 policy/entries-missing: an entry of no ticket; nothing written", () => {
    const { root, dir } = opened();
    const report = ticketed(dir);
    const id = add(root, "observation", "written without a ticket", "--ref", "02").entry.id;
    const result = refused(
      ingest(root, REPORT.replace("entries: []", `entries: [${id}]`)),
      2,
      "policy/entries-missing",
    );
    expect(result.why).toContain(id);
    expect(() => read(root, report)).toThrow();
  });

  it("exit 3 input/missing-argument: no --ticket", () => {
    const { root } = opened();
    refused(bdk(["log", "ingest", "--json"], root, { stdin: REPORT }), 3, "input/missing-argument");
  });

  it("exit 2 policy/no-open-ticket: the ticket is closed", () => {
    const { root, dir } = opened();
    ticketed(dir, true);
    refused(ingest(root, REPORT), 2, "policy/no-open-ticket");
  });

  it("exit 2 policy/no-active-change", () => {
    refused(ingest(repository(), REPORT), 2, "policy/no-active-change");
  });

  it("exit 4 state/ledger-invalid", () => {
    const { root, dir } = opened();
    ticketed(dir);
    fileStore().write(
      join(dir, "log/20260101T000000Z-finding-L-broken00.md"),
      "---\nschema: 1\n---\n",
    );
    refused(ingest(root, REPORT), 4, "state/ledger-invalid");
  });

  it("exit 5 runtime/not-a-repo", () => {
    refused(ingest(outsideRepository(), REPORT), 5, "runtime/not-a-repo");
  });
});

describe("a review round in the ledger (T42-A1, B1, T)", () => {
  it("writes grouped entries and reports, the merged review with head, and triage", () => {
    const change = executed(started());
    const round = openedTicket(change, "review-fix", change.id);
    const run = (args: string[], stdin?: string) =>
      bdk([...args, "--json"], change.root, stdin === undefined ? {} : { stdin });
    answered(
      run([
        "dispatch",
        "build",
        change.id,
        "reviewer",
        round,
        "--group",
        "p01",
        "--range",
        "HEAD~3..HEAD",
        "--file",
        "src/01-1.ts",
      ]),
      "output/dispatch-build.json",
    );
    const added = answered(
      run([
        "log",
        "add",
        "finding",
        "value is never validated",
        "--ref",
        "src/01-1.ts",
        "--ticket",
        `${round}@p01`,
      ]),
      "output/log-add.json",
    ).entry as { id: string; group: string; source: string };
    expect(added).toMatchObject({ group: "p01", source: "agent:reviewer" });
    const report = (entries: string[]) =>
      `---\nstatus: done\nfiles: []\nentries: [${entries.join(", ")}]\nevidence: []\n---\n# Review\n`;
    answered(
      run(["log", "ingest", "--ticket", `${round}@p01`], report([added.id])),
      "output/log-ingest.json",
    );
    const merged = answered(
      run(["log", "ingest", "--ticket", `${round}@merge`], report([added.id])),
      "output/log-ingest.json",
    );
    expect(merged).toMatchObject({ role: "orchestrator" });
    expect(merged.path).toBe(
      `.bdk/changes/${change.id}/reports/${change.id}-orchestrator-${round}-merge.md`,
    );
    const verdict = answered(
      run(["log", "add", "report", "1 should-fix", "--ticket", `${round}@merge`]),
      "output/log-add.json",
    ).entry as { head: string; refs: string[]; source: string };
    const head = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: change.root,
      encoding: "utf8",
    }).trim();
    expect(verdict).toMatchObject({ head, source: "kernel", refs: [change.id, "review"] });
    expect(
      answered(
        run(["log", "triage", added.id, "should-fix", "--reason", "real"]),
        "output/log-triage.json",
      ),
    ).toStrictEqual({ record: added.id, level: "should-fix", status: "proposed" });
    refused(run(["log", "triage", added.id, "not-a-problem"]), 3, "input/missing-argument");
  });

  it("bdk log decide: track with the issue, then refusals", () => {
    const change = started();
    const run = (argv: string[]) => bdk([...argv, "--json"], change.root);
    const added = answered(
      run(["log", "add", "finding", "token compared with ==", "--ref", "src/auth/login.ts"]),
      "output/log-add.json",
    ).entry as { id: string };
    answered(run(["log", "triage", added.id, "should-fix"]), "output/log-triage.json");
    const url = "https://github.com/acme/app/issues/88";
    expect(
      answered(run(["log", "decide", added.id, "track", "--issue", url]), "output/log-decide.json"),
    ).toStrictEqual({
      record: added.id,
      disposition: "track",
      issue: url,
      level: "should-fix",
      status: "accepted",
      review: false,
    });
    refused(run(["log", "decide", "L-00000099", "defer"]), 3, "input/not-found");
    refused(run(["log", "decide", added.id, "reject"]), 3, "input/missing-argument");
    answered(
      run(["log", "decide", added.id, "reject", "--reason", "duplicate of #12"]),
      "output/log-decide.json",
    );
    refused(run(["log", "decide", added.id, "defer"]), 2, "policy/invalid-transition");
  });
});
