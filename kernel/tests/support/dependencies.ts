// The dependency policy of design D-10 and the `Runtime dependencies`
// requirement, as pure checks over a parsed package.json.

const RUNTIME_ALLOWLIST = ["yaml", "zod"] as const;

export interface PackageJson {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
  readonly packageManager?: string;
}

// A registry version, or a GitHub dependency pinned to a release tag (the
// lockfile then pins the commit); a branch or a bare repository is a range.
const EXACT = /^(?:\d+\.\d+\.\d+|github:[\w.-]+\/[\w.-]+#v\d+\.\d+\.\d+)$/;

export function dependencyViolations(pkg: PackageJson): string[] {
  const violations: string[] = [];
  for (const name of Object.keys(pkg.dependencies ?? {})) {
    if (!(RUNTIME_ALLOWLIST as readonly string[]).includes(name)) {
      violations.push(`${name} is not in the runtime allowlist (${RUNTIME_ALLOWLIST.join(", ")})`);
    }
  }
  for (const [name, version] of [
    ...Object.entries(pkg.dependencies ?? {}),
    ...Object.entries(pkg.devDependencies ?? {}),
  ]) {
    if (!EXACT.test(version)) violations.push(`${name}@${version} is not an exact version`);
  }
  if (!/^pnpm@\d+\.\d+\.\d+$/.test(pkg.packageManager ?? "")) {
    violations.push(`packageManager must pin pnpm exactly, got ${pkg.packageManager ?? "nothing"}`);
  }
  return violations;
}
