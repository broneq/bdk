// A `ChangeView` from literals, for the pure tests of the kinds, the engine
// and the gate rule: files by path, entries in order, report statuses by id.
import type { ChangeView, FileFacts, GraphEntry, Inputs } from "../domain/kinds/index.ts";
import type { Profile } from "../../shared/vocabulary/index.ts";

export interface ViewFixture {
  readonly profile?: Profile;
  readonly kind?: string;
  readonly files?: Readonly<Record<string, Partial<FileFacts>>>;
  readonly entries?: readonly (Partial<GraphEntry> & {
    readonly id: string;
    readonly type: string;
  })[];
  /** Entry id -> the status of the report it points at. */
  readonly reports?: Readonly<Record<string, string>>;
}

export function fakeView(fixture: ViewFixture = {}): ChangeView {
  const files = fixture.files ?? {};
  return {
    id: "2026-09-25-login",
    kind: fixture.kind ?? "feature",
    profile: fixture.profile ?? "small",
    entries: (fixture.entries ?? []).map((entry) => ({
      at: "2026-09-25T10:00:00Z",
      source: "kernel",
      refs: ["change.md"],
      summary: "fixture",
      status: "accepted",
      review: false,
      ...entry,
    })),
    file: (path) => {
      const facts = files[path];
      return facts === undefined ? undefined : { bytes: 10, blank: false, ...facts };
    },
    list: (dir) =>
      Object.keys(files)
        .filter((path) => path.startsWith(`${dir}/`) && !path.slice(dir.length + 1).includes("/"))
        .map((path) => path.slice(dir.length + 1))
        .sort(),
    reportStatus: (entry) => fixture.reports?.[entry.id],
  };
}

/** A deterministic stand-in for sha256: the inputs themselves, readable in assertions. */
export function fakeHash(
  versions: Readonly<Record<string, string>> = {},
): (inputs: Inputs) => string {
  return (inputs) => {
    if ("codeTree" in inputs) return `tree@${versions.tree ?? "1"}`;
    if ("none" in inputs) throw new Error("hash asked for none");
    return inputs.files.map((path) => `${path}@${versions[path] ?? "1"}`).join(",");
  };
}
