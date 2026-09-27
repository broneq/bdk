// The kinds of single documents: `intent`, `design`, `architecture` and
// `spec-delta` (`kernel-pipeline`, Artifact kinds).
import { BaseKind, fileChecks, partFiles } from "./kind.ts";
import type { ChangeView, Check, DoneBy, Inputs } from "./kind.ts";

/** T20 design D-11: a design over this size is split into `design/parts/`. */
export const DESIGN_LIMIT_BYTES = 12 * 1024;

export class IntentKind extends BaseKind {
  readonly name = "intent";
  override readonly doneBy: DoneBy = { through: "construction" };
  writes(): readonly string[] {
    return ["change.md"];
  }
  inputs(): Inputs {
    return { files: ["change.md"] };
  }
  validate(view: ChangeView): Check[] {
    return fileChecks(view, "change.md");
  }
}

export class DesignKind extends BaseKind {
  readonly name = "design";
  writes(): readonly string[] {
    return ["design.md"];
  }
  inputs(): Inputs {
    return { files: ["design.md"] };
  }
  validate(view: ChangeView): Check[] {
    const checks = fileChecks(view, "design.md");
    const file = view.file("design.md");
    if (file === undefined) return checks;
    return [
      ...checks,
      file.bytes > DESIGN_LIMIT_BYTES
        ? {
            id: "size",
            ok: false,
            why: `design.md is ${file.bytes} bytes, over ${DESIGN_LIMIT_BYTES}`,
            instead: "split the design into design/parts/<nn>-<slug>.md and remove design.md",
          }
        : { id: "size", ok: true },
    ];
  }
}

export class ArchitectureKind extends BaseKind {
  readonly name = "architecture";
  skip(view: ChangeView): string | undefined {
    if (view.profile === "tiny") return "profile tiny has no architecture";
    if (view.file("design.md")?.data?.architecture === false) {
      return "design.md declares architecture: false (product-only Change)";
    }
    return undefined;
  }
  writes(): readonly string[] {
    return ["architecture.md"];
  }
  inputs(): Inputs {
    return { files: ["architecture.md"] };
  }
  validate(view: ChangeView): Check[] {
    return fileChecks(view, "architecture.md");
  }
}

export class SpecDeltaKind extends BaseKind {
  readonly name = "spec-delta";
  skip(view: ChangeView): string | undefined {
    const impact = [...partFiles(view, "plan/parts").values()].some((path) =>
      Array.isArray(view.file(path)?.data?.["spec-impact"]),
    );
    return impact ? undefined : "no plan part declares spec-impact";
  }
  writes(view: ChangeView): readonly string[] {
    const files = this.files(view);
    return files.length === 0 ? ["spec-delta/<capability>.md"] : files;
  }
  inputs(view: ChangeView): Inputs {
    return { files: this.files(view) };
  }
  validate(view: ChangeView): Check[] {
    const files = this.files(view);
    if (files.length === 0) {
      return [{ id: "exists", ok: false, why: "spec-delta/ holds no delta" }];
    }
    return files.flatMap((path) =>
      fileChecks(view, path).map((check) => ({ ...check, id: `${check.id}:${path}` })),
    );
  }
  private files(view: ChangeView): string[] {
    return view
      .list("spec-delta")
      .filter((name) => name.endsWith(".md"))
      .map((name) => `spec-delta/${name}`);
  }
}
