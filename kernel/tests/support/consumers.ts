// Structural test 3 of `kernel-architecture`, Tests per slice (S6: no key
// without a consumer; design D-2 of v3-t12-layered-config). The inputs are
// passed in, so the negative controls seed a violation without touching disk.

export interface Declared {
  /** The module's root key or the prompt key. */
  readonly key: string;
  readonly consumer: string;
  /** The module or prompt key object itself, compared by identity. */
  readonly value: unknown;
}

export interface ConsumerWorld {
  /** Slice names of `kernel-architecture`, Vertical slices. */
  readonly slices: ReadonlySet<string>;
  /** The exports of a consumer's `config.ts` (`shared/config/modules.ts` for shared/config). */
  exportsOf(consumer: string): Readonly<Record<string, unknown>> | undefined;
  /** Slices with at least one registered command handler. */
  readonly handlerSlices: ReadonlySet<string>;
  /** The texts of the files under a slice's `use-cases/`. */
  useCases(slice: string): readonly string[];
}

export function consumerViolations(declared: readonly Declared[], world: ConsumerWorld): string[] {
  const violations: string[] = [];
  for (const { key, consumer, value } of declared) {
    if (consumer !== "shared/config" && !world.slices.has(consumer)) {
      violations.push(`${key}: consumer ${consumer} is not a slice`);
      continue;
    }
    const exported = Object.entries(world.exportsOf(consumer) ?? {}).find(
      ([, candidate]) =>
        candidate === value || (Array.isArray(candidate) && candidate.includes(value)),
    );
    if (exported === undefined) {
      violations.push(`${key}: not exported from the config.ts of ${consumer}`);
      continue;
    }
    if (!world.handlerSlices.has(consumer)) continue;
    const name = new RegExp(`\\b${exported[0]}\\b`);
    if (!world.useCases(consumer).some((text) => name.test(text))) {
      violations.push(`${key}: ${consumer} has a handler but no use case reads ${exported[0]}`);
    }
  }
  return violations;
}
