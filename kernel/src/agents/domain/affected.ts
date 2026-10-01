// Whom a ledger entry affects (`kernel-cli/agents`, bdk agents list
// --affected-by): an entry names a target when a ref, without its `#`
// anchor, is the target, its part, a task of a part target, or one of the
// target's `Files:` - the names `dispatch build` selects entries by.

export interface TargetShape {
  /** The part holding a task target, or the part target itself. */
  readonly part: string | undefined;
  /** The tasks of a part target. */
  readonly tasks: readonly string[];
  readonly files: readonly string[];
}

export function targetNames(target: string, shape: TargetShape): Set<string> {
  return new Set([
    target,
    ...(shape.part === undefined ? [] : [shape.part]),
    ...shape.tasks,
    ...shape.files,
  ]);
}

export function namesTarget(refs: readonly string[], names: ReadonlySet<string>): boolean {
  return refs.some((ref) => names.has(ref.split("#")[0] ?? ref));
}
