// The archive prune of `kernel-state`, Pruned index (V1-9, T23-D53): the
// bodies of `dispatch/` and `reports/` replaced by one hash index each.
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { memoryStore, pruneChange, readChange, readDocument, writeDocument } from "../index.ts";
import type { Store } from "../index.ts";
import { change, dispatch, evidence, report } from "../state/tests/examples.ts";

const CHANGE = "2026-09-25-login";
const REL = `.bdk/changes/archive/${CHANGE}`;
const DIR = `/repo/${REL}`;
const TICKET = "A-7f3k9m2q";
const NOW = "2026-09-26T08:00:00Z";

function sha(text: string): string {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}

function seeded(): Store {
  const store = memoryStore();
  writeDocument(store, `${DIR}/change.md`, { data: { ...change, id: CHANGE }, body: "" });
  for (const role of ["runner", "implementer"]) {
    writeDocument(store, `${DIR}/dispatch/02-3-${role}-${TICKET}.md`, {
      data: {
        ...dispatch,
        ticket: TICKET,
        role,
        report: `${REL}/reports/02-3-${role}-${TICKET}.md`,
      },
      body: `# Package for the ${role}\n`,
    });
  }
  store.write(`${DIR}/reports/02-3-runner-${TICKET}.md`, "---\nnot: parsed\n---\nraw report\n");
  return store;
}

function index(store: Store, dir: string) {
  const document = readDocument(store, `${DIR}/${dir}/pruned.md`);
  if (document === undefined || !("data" in document)) throw new Error(`no ${dir}/pruned.md`);
  return document;
}

describe("pruneChange", () => {
  it("replaces the bodies of dispatch/ and reports/ with an index of hashes and sizes", () => {
    const store = seeded();
    const texts = Object.fromEntries(
      store.list(`${DIR}/dispatch`).map((name) => [name, store.read(`${DIR}/dispatch/${name}`)]),
    );
    const reportText = store.read(`${DIR}/reports/02-3-runner-${TICKET}.md`) ?? "";
    expect(pruneChange(store, DIR, NOW)).toStrictEqual(["dispatch", "reports"]);

    expect(store.list(`${DIR}/dispatch`)).toStrictEqual(["pruned.md"]);
    expect(store.list(`${DIR}/reports`)).toStrictEqual(["pruned.md"]);
    const packages = index(store, "dispatch");
    expect(packages.kind).toBe("pruned");
    expect(packages.body).toBe("");
    expect(packages.data).toStrictEqual({
      schema: 1,
      dir: "dispatch",
      at: NOW,
      files: Object.entries(texts).map(([path, text]) => ({
        path,
        hash: sha(text ?? ""),
        bytes: Buffer.byteLength(text ?? ""),
      })),
    });
    expect(index(store, "reports").data.files).toStrictEqual([
      {
        path: `02-3-runner-${TICKET}.md`,
        hash: sha(reportText),
        bytes: Buffer.byteLength(reportText),
      },
    ]);
  });

  it("lists the removed files in name order", () => {
    const store = seeded();
    pruneChange(store, DIR, NOW);
    expect(index(store, "dispatch").data.files).toMatchObject([
      { path: `02-3-implementer-${TICKET}.md` },
      { path: `02-3-runner-${TICKET}.md` },
    ]);
  });

  it("writes nothing on a second run", () => {
    const store = seeded();
    pruneChange(store, DIR, NOW);
    const before = store.read(`${DIR}/dispatch/pruned.md`);
    expect(pruneChange(store, DIR, "2026-09-27T08:00:00Z")).toStrictEqual([]);
    expect(store.read(`${DIR}/dispatch/pruned.md`)).toBe(before);
    expect(store.list(`${DIR}/reports`)).toStrictEqual(["pruned.md"]);
  });

  it("adds files written after a prune to the existing index", () => {
    const store = seeded();
    pruneChange(store, DIR, NOW);
    store.write(`${DIR}/reports/01-1-runner-${TICKET}.md`, "late\n");
    expect(pruneChange(store, DIR, "2026-09-27T08:00:00Z")).toStrictEqual(["reports"]);
    expect(store.list(`${DIR}/reports`)).toStrictEqual(["pruned.md"]);
    expect(index(store, "reports").data.files).toStrictEqual([
      { path: `01-1-runner-${TICKET}.md`, hash: sha("late\n"), bytes: 5 },
      expect.objectContaining({ path: `02-3-runner-${TICKET}.md` }),
    ]);
  });

  it("writes no index for an empty or absent directory", () => {
    const store = memoryStore();
    writeDocument(store, `${DIR}/change.md`, { data: { ...change, id: CHANGE }, body: "" });
    expect(pruneChange(store, DIR, NOW)).toStrictEqual([]);
    expect(store.exists(`${DIR}/dispatch/pruned.md`)).toBe(false);
  });

  it("leaves a pruned Change readable without state/ledger-invalid", () => {
    const store = seeded();
    pruneChange(store, DIR, NOW);
    const kinds = [...readChange(store, DIR).values()].map((document) => document.kind);
    expect(kinds.filter((kind) => kind === "pruned")).toHaveLength(2);
  });

  it("keeps a manifest's file hash findable in the index", () => {
    const store = seeded();
    const reportPath = `${REL}/reports/02-3-runner-${TICKET}.md`;
    const reportHash = sha(store.read(`/repo/${reportPath}`) ?? "");
    writeDocument(store, `${DIR}/evidence/02-3-E-00000001.md`, {
      data: {
        ...evidence,
        id: "E-00000001",
        ticket: TICKET,
        files: [{ path: reportPath, hash: reportHash, stored: "machine" }],
      },
      body: "",
    });
    pruneChange(store, DIR, NOW);
    const manifest = readDocument(store, `${DIR}/evidence/02-3-E-00000001.md`);
    if (manifest === undefined || !("data" in manifest)) throw new Error("no manifest");
    const [file] = manifest.data.files as { hash: string }[];
    expect(index(store, "reports").data.files).toContainEqual(
      expect.objectContaining({ hash: file?.hash }),
    );
  });

  it("keeps a report whose frontmatter is valid in the index like any other file", () => {
    const store = seeded();
    writeDocument(store, `${DIR}/reports/02-3-implementer-${TICKET}.md`, {
      data: { ...report, ticket: TICKET },
      body: "done\n",
    });
    pruneChange(store, DIR, NOW);
    expect(index(store, "reports").data.files).toHaveLength(2);
  });
});
