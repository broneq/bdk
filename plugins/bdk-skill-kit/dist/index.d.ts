export type Severity = "error" | "warning";
/** How a config sets a rule: off, a severity, or a severity with options. */
export type RuleSetting = "off" | Severity | [Severity, Record<string, unknown>];
export type TargetKind = "skills" | "agents";
/**
 * `claude-code` admits the Claude Code frontmatter fields; `portable` admits
 * only the six Agent Skills standard fields.
 */
export type Profile = "claude-code" | "portable";
export interface Target {
    kind: TargetKind;
    /** Directories relative to the config file. */
    dirs: string[];
    /** Defaults to `claude-code`. */
    profile?: Profile;
    /** A label for messages; defaults to the first directory. */
    name?: string;
    /** Rule settings for this target only, merged over the config's `rules`. */
    rules?: Record<string, RuleSetting>;
}
export interface Config {
    targets: Target[];
    plugins?: Plugin[];
    rules?: Record<string, RuleSetting>;
    /** Baseline file relative to the config file. */
    baseline?: string;
}
export interface ResolvedTarget {
    kind: TargetKind;
    dirs: string[];
    profile: Profile;
    name: string;
}
/** One parsed skill (`SKILL.md`) or agent file. Paths are POSIX, relative to the config root. */
export interface Document {
    kind: TargetKind;
    target: ResolvedTarget;
    /** The file itself. */
    path: string;
    /** Skills: the skill directory. Agents: the directory holding the file. */
    dir: string;
    text: string;
    /** Every line of the file; `lines[0]` is line 1. */
    lines: string[];
    /** The frontmatter map; undefined when it is missing or does not parse as a map. */
    frontmatter: Record<string, unknown> | undefined;
    /** Why the frontmatter is unusable, when it is. */
    frontmatterError: string | undefined;
    /** 1-based line of each top-level frontmatter key. */
    keyLines: Record<string, number>;
    /** 1-based line of the first body line (after the closing `---`). */
    bodyStart: number;
    /** True when the 1-based line lies inside a fenced code block. */
    inFence: (line: number) => boolean;
    /** Skills: every file in the skill directory except the skill file, relative to `dir`. */
    files: string[];
}
export interface Report {
    message: string;
    /** 1-based; defaults to 1. */
    line?: number;
    /** Defaults to the document's file. */
    file?: string;
    /**
     * The text that triggered the finding. The baseline fingerprint is built
     * from it, so it must not contain line numbers; defaults to the message.
     */
    match?: string;
    /** `warning` caps the finding at warning even when the rule is set to error. */
    severity?: Severity;
}
export interface RuleContext<O = Record<string, unknown>> {
    /** The rule's default options merged with the config's. */
    options: O;
    /** Absolute path of the config root. */
    root: string;
    report(report: Report): void;
}
export interface ProjectContext<O = Record<string, unknown>> extends RuleContext<O> {
    /** Skill directories that hold Markdown but no skill file in any letter case. */
    strays: string[];
}
export interface Rule<O = Record<string, unknown>> {
    id: string;
    kinds: TargetKind[];
    defaultSeverity: Severity | "off";
    defaultOptions?: O;
    /**
     * Checks the merged options of an enabled rule, as the config wrote them and
     * so not yet of type `O`, and returns what is wrong with them, or undefined.
     * A problem makes the config invalid (exit 2).
     */
    validateOptions?(options: Record<string, unknown>): string | undefined;
    /** Runs once per document of a matching kind. */
    check?(doc: Document, ctx: RuleContext<O>): void;
    /** Runs once over every document of a matching kind (all targets). */
    checkProject?(docs: Document[], ctx: ProjectContext<O>): void;
}
export interface Plugin {
    /** Prefix of the plugin's rule IDs: rule `x` of plugin `p` is `p/x`. */
    name: string;
    rules: Rule<object>[];
}
export interface Finding {
    rule: string;
    severity: Severity;
    file: string;
    line: number;
    message: string;
    fingerprint: string;
}
export declare function defineConfig(config: Config): Config;
export declare function definePlugin(plugin: Plugin): Plugin;
/** Types a rule's options; returns the rule unchanged. */
export declare function defineRule<O extends object = Record<string, unknown>>(rule: Rule<O>): Rule<O>;
