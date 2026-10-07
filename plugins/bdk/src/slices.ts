// The slice matrix of the bdk CLI (spec `bdk-cli`, "Import matrix" and "shared/ admission").
// Plain data, no imports: `eslint.architecture.ts` reads it to generate the architecture lint,
// so a new slice or a new edge is one entry here, with the reason in `why`.

export type Admission = "os-boundary" | "frame" | "three-slices";

/** Every slice under `src/`, and the slices whose `index.ts` its use cases may import. */
export const SLICES: Readonly<
  Record<string, { readonly imports: readonly string[]; readonly why: string }>
> = {};

/** Every module under `src/shared/`, and why it is shared rather than owned by a slice. */
export const SHARED: Readonly<
  Record<string, { readonly admitted: Admission; readonly why: string }>
> = {
  cli: {
    admitted: "frame",
    why: "routing, help, flags, output, errors and exit codes of every command",
  },
};
