// The kinds with no file of their own: `gate` (T1: provenance and timing
// only), `post-task-step` (T23) and `close` (T30). Their owner tasks extend
// these classes; until then nothing here pretends to be done.
import { BaseKind } from "./kind.ts";
import type { Check, DoneBy, Inputs } from "./kind.ts";

abstract class FilelessKind extends BaseKind {
  writes(): readonly string[] {
    return [];
  }
  inputs(): Inputs {
    return { none: true };
  }
  validate(): Check[] {
    return [];
  }
}

export class GateKind extends FilelessKind {
  readonly name = "gate";
  override readonly doneBy: DoneBy = { through: "gate" };
}

export class PostTaskStepKind extends FilelessKind {
  readonly name = "post-task-step";
  override readonly doneBy: DoneBy = {
    through: "command",
    command: "the post-task step runner (T23)",
  };
}

export class CloseKind extends FilelessKind {
  readonly name = "close";
  override readonly doneBy: DoneBy = { through: "command", command: "bdk change close" };
}
