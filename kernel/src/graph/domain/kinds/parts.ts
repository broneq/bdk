// The kinds of parts: `design-part`, `design-index`, `plan-part` and
// `execute-part` (`kernel-pipeline`, Artifact kinds; design D-7). A
// collection node of an instanced kind has one instance per part file.
import { BaseKind, fileChecks, partFiles } from "./kind.ts";
import type { ChangeView, Check, DoneBy, Inputs, Instance } from "./kind.ts";

/** A kind with one instance per `<dir>/<nn>-<slug>.md`. */
abstract class PartKind extends BaseKind {
  protected abstract readonly dir: string;
  instances(view: ChangeView): readonly Instance[] {
    return [...partFiles(view, this.dir).keys()].map((nn) => ({ nn, requires: [] }));
  }
  writes(view: ChangeView, nn?: string): readonly string[] {
    const path = nn === undefined ? undefined : partFiles(view, this.dir).get(nn);
    return [path ?? `${this.dir}/${nn ?? "<nn>"}-<slug>.md`];
  }
  inputs(view: ChangeView, nn?: string): Inputs {
    const path = nn === undefined ? undefined : partFiles(view, this.dir).get(nn);
    return { files: path === undefined ? [] : [path] };
  }
  validate(view: ChangeView, target: { readonly nn?: string | undefined }): Check[] {
    const path = target.nn === undefined ? undefined : partFiles(view, this.dir).get(target.nn);
    if (path === undefined) {
      return [{ id: "exists", ok: false, why: `${this.dir}/ holds no part ${target.nn ?? ""}` }];
    }
    return fileChecks(view, path);
  }
}

export class DesignPartKind extends PartKind {
  readonly name = "design-part";
  protected readonly dir = "design/parts";
}

export class PlanPartKind extends PartKind {
  readonly name = "plan-part";
  protected readonly dir = "plan/parts";
}

export class DesignIndexKind extends BaseKind {
  readonly name = "design-index";
  writes(): readonly string[] {
    return ["design/index.md"];
  }
  inputs(view: ChangeView): Inputs {
    return { files: [...partFiles(view, "design/parts").values()] };
  }
  validate(view: ChangeView): Check[] {
    const parts = [...partFiles(view, "design/parts").values()];
    if (parts.length === 0) {
      return [{ id: "parts", ok: false, why: "design/parts/ holds no design part" }];
    }
    return [
      { id: "parts", ok: true },
      ...parts.flatMap((path) =>
        fileChecks(view, path).map((check) => ({ ...check, id: `${check.id}:${path}` })),
      ),
    ];
  }
}

/** One instance per plan part, following its `depends-on`; done through `part done` (T22). */
export class ExecutePartKind extends BaseKind {
  readonly name = "execute-part";
  override readonly doneBy: DoneBy = { through: "command", command: "bdk part done {nn}" };
  instances(view: ChangeView): readonly Instance[] {
    return [...partFiles(view, "plan/parts")].map(([nn, path]) => {
      const dependsOn = view.file(path)?.data?.["depends-on"];
      const requires = Array.isArray(dependsOn)
        ? dependsOn.map((dependency) => `execute-part:${String(dependency)}`)
        : [];
      return { nn, requires };
    });
  }
  writes(): readonly string[] {
    return [];
  }
  /** Defined by T22. */
  inputs(): Inputs {
    return { none: true };
  }
  /** T22 adds the trailer and ticket checks. */
  validate(): Check[] {
    return [];
  }
}
