import type { Finding, Profile, Rule, TargetKind } from "./index.js";
export interface RuleTest<O extends object = Record<string, unknown>> {
    /** File contents by path, POSIX, relative to the one target directory. */
    files: Record<string, string>;
    /** Defaults to `skills`. */
    kind?: TargetKind;
    /** Defaults to `claude-code`. */
    profile?: Profile;
    /** Merged over the rule's default options, as a config setting is. */
    options?: Partial<O>;
}
/**
 * Runs one rule, `check` and `checkProject`, over `files` and resolves to its
 * findings in report order, with paths relative to the target directory. A
 * rule that is off by default runs at `error`. The files live in a temporary
 * directory that is removed before the promise settles.
 */
export declare function checkRule<O extends object>(rule: Rule<O>, test: RuleTest<O>): Promise<Finding[]>;
