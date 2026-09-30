# V3 rules migration

T31 (issue #58) turns the 131 bullets of the v2 rule files into the per-rule pack of `rule-pack`. This report records, for every bullet T40 measured (`docs/V3-EVAL-RULES-NOOP.md`), its kind, the decision and the id a kept bullet gets. Group 6 of the Change writes the pack from it, after the review.

## Method

- **Kind** (design D-1): `house` is a choice among valid alternatives; `knowledge` is a fact about a library, language or tool; "not a rule" is a goal that names no alternative, a principle without a valid alternative, or a note about the rule file itself.
- **Decision** (design D-2), after the spot-check corrections of T40 and the re-measurement of the 14 re-seeded bullets:
  - not a rule: removed;
  - `knowledge`: kept only when M1 is WRONG, MISSED or MIXED for Haiku or Sonnet, otherwise removed;
  - `house`: removed when it is a measured no-op (M1 COVERED for both, M2 seeded with no measurable difference and a `without` mean detection of at least 0.8), otherwise kept. A no-op candidate that M2 could not seed is kept, because no ablation tested it.
- **Exception** (user review of this report): the bullets of `rules/security.md` are kept as `house` rules whatever their class, because a security problem the reviewer misses costs more than the prompt space the rule takes. The file's note about itself (`security.10`) is still removed, like the same note in `rules/code-quality.md`.
- **Numbering**: kept bullets are numbered per prefix in their original file order. A removed bullet gets no id and no tombstone (T5).
- **Class** is the T40 class the decision used: the spot-check correction applied, and for the 14 re-seeded bullets the class of the re-measurement (`series-m2-2026-09-30`), whose `with` vs `without` result is in the last column.
- The plan rules `BDK-PL-1` to `BDK-PL-3` (P7) are new and come from no bullet.

## Counts

| file                            | kept | removed: measured no-op | removed: knowledge both models have | removed: not a rule |
| ------------------------------- | ---- | ----------------------- | ----------------------------------- | ------------------- |
| `rules/architecture.md`         | 5    | 1                       | 0                                   | 1                   |
| `rules/code-quality.md`         | 8    | 1                       | 0                                   | 1                   |
| `rules/design-patterns.md`      | 11   | 2                       | 0                                   | 1                   |
| `rules/engineering-judgment.md` | 2    | 0                       | 0                                   | 0                   |
| `rules/security.md`             | 9    | 0                       | 0                                   | 1                   |
| `rules/test-quality.md`         | 11   | 6                       | 0                                   | 0                   |
| `rules/languages/javascript.md` | 8    | 11                      | 6                                   | 0                   |
| `rules/languages/react.md`      | 19   | 1                       | 4                                   | 0                   |
| `rules/languages/typescript.md` | 12   | 5                       | 5                                   | 0                   |
| total                           | 85   | 27                      | 15                                  | 4                   |

85 bullets are kept, 46 removed.

## Per bullet

### `rules/architecture.md`

| T40 id                     | excerpt                             | class           | spot-check correction | kind       | decision                                               | re-measured M2       |
| -------------------------- | ----------------------------------- | --------------- | --------------------- | ---------- | ------------------------------------------------------ | -------------------- |
| `architecture.01.54b5ad15` | Module boundaries                   | no-op candidate |                       | not a rule | removed: not a rule (a goal that names no alternative) | 1 [1..1] vs 1 [1..1] |
| `architecture.02.a5df5e89` | Dependency direction                | unclear         |                       | house      | kept as BDK-ARCH-1                                     | 1 [0..1] vs 1 [0..1] |
| `architecture.03.1ae7614c` | Dependency Inversion (SOLID — DIP)  | unclear         |                       | house      | kept as BDK-ARCH-2                                     | 1 [0..1] vs 0 [0..0] |
| `architecture.04.26099829` | Interface Segregation (SOLID — ISP) | effective       |                       | house      | kept as BDK-ARCH-3                                     |                      |
| `architecture.05.5785e278` | Premature abstraction               | effective       |                       | house      | kept as BDK-ARCH-4                                     |                      |
| `architecture.06.5f36bcdd` | Justified changes                   | no-op candidate |                       | house      | removed: measured no-op                                |                      |
| `architecture.07.357bc58d` | Single source of truth              | unclear         |                       | house      | kept as BDK-ARCH-5                                     | 0 [0..0] vs 0 [0..1] |

### `rules/code-quality.md`

| T40 id                     | excerpt                             | class           | spot-check correction | kind       | decision                                    | re-measured M2 |
| -------------------------- | ----------------------------------- | --------------- | --------------------- | ---------- | ------------------------------------------- | -------------- |
| `code-quality.01.e4ed906e` | Naming                              | effective       |                       | house      | kept as BDK-CQ-1                            |                |
| `code-quality.02.056621da` | Function size                       | unclear         |                       | house      | kept as BDK-CQ-2                            |                |
| `code-quality.03.28b26fee` | Single Responsibility (SOLID — SRP) | unclear         |                       | house      | kept as BDK-CQ-3                            |                |
| `code-quality.04.e5a77810` | Comments                            | effective       |                       | house      | kept as BDK-CQ-4                            |                |
| `code-quality.05.7ff54a8f` | Comments do not accrete             | unclear         |                       | house      | kept as BDK-CQ-5                            |                |
| `code-quality.06.db386736` | Error handling                      | unclear         |                       | house      | kept as BDK-CQ-6                            |                |
| `code-quality.07.98e318ea` | Dead code                           | no-op candidate |                       | house      | removed: measured no-op                     |                |
| `code-quality.08.226892d5` | Tests                               | unclear         |                       | house      | kept as BDK-CQ-7                            |                |
| `code-quality.09.41d89cfb` | Async pipeline observability        | no-op candidate |                       | house      | kept as BDK-CQ-8                            |                |
| `code-quality.10.5476143b` | No language-specific tooling        | no-op candidate |                       | not a rule | removed: not a rule (a note about the file) |                |

### `rules/design-patterns.md`

| T40 id                        | excerpt                               | class           | spot-check correction                           | kind       | decision                                                                              | re-measured M2       |
| ----------------------------- | ------------------------------------- | --------------- | ----------------------------------------------- | ---------- | ------------------------------------------------------------------------------------- | -------------------- |
| `design-patterns.01.ec59d579` | Pattern fit                           | no-op candidate |                                                 | house      | removed: measured no-op                                                               | 1 [1..1] vs 1 [1..1] |
| `design-patterns.02.eea458e1` | Strategy                              | unclear         |                                                 | house      | kept as BDK-DP-1                                                                      | 1 [0..1] vs 0 [0..0] |
| `design-patterns.03.2dad9824` | Factory / Abstract Factory            | effective       |                                                 | house      | kept as BDK-DP-2                                                                      |                      |
| `design-patterns.04.78b91b1a` | Observer / Event                      | unclear         |                                                 | house      | kept as BDK-DP-3                                                                      | 1 [0..1] vs 0 [0..0] |
| `design-patterns.05.843b44bd` | Decorator                             | effective       |                                                 | house      | kept as BDK-DP-4                                                                      |                      |
| `design-patterns.06.f5d3ec17` | Repository                            | unclear         |                                                 | house      | kept as BDK-DP-5                                                                      | 0 [0..0] vs 0 [0..0] |
| `design-patterns.07.712e8a13` | Tell-Don't-Ask                        | unclear         |                                                 | house      | kept as BDK-DP-6                                                                      |                      |
| `design-patterns.08.dacc8c77` | Extract-to-owner trigger              | unclear         |                                                 | house      | kept as BDK-DP-7                                                                      |                      |
| `design-patterns.09.5f5e9bf0` | Replace conditional with polymorphism | effective       |                                                 | house      | kept as BDK-DP-8                                                                      |                      |
| `design-patterns.10.ff10f7bf` | Open/Closed (SOLID — OCP)             | unclear         |                                                 | house      | kept as BDK-DP-9                                                                      |                      |
| `design-patterns.11.3b98ce86` | Liskov Substitution (SOLID — LSP)     | no-op candidate |                                                 | house      | removed: measured no-op                                                               |                      |
| `design-patterns.12.36037d8b` | Anti-patterns to avoid                | unclear         |                                                 | house      | kept as BDK-DP-10                                                                     |                      |
| `design-patterns.13.47ca8808` | Pattern documentation                 | no-op candidate |                                                 | house      | kept as BDK-DP-11                                                                     |                      |
| `design-patterns.14.a9368ad8` | GoF catalog                           | unclear         | haiku, sonnet WRONG to MISSED; class to unclear | not a rule | removed: not a rule (a note on the file's scope; its instruction repeats Pattern fit) |                      |

### `rules/engineering-judgment.md`

| T40 id                             | excerpt                                   | class           | spot-check correction                             | kind  | decision         | re-measured M2 |
| ---------------------------------- | ----------------------------------------- | --------------- | ------------------------------------------------- | ----- | ---------------- | -------------- |
| `engineering-judgment.01.1c143231` | Quality over build cost                   | no-op candidate |                                                   | house | kept as BDK-EJ-1 |                |
| `engineering-judgment.02.56e82a4b` | Fix what's clearly off, even if unrelated | no-op candidate | haiku MISSED to COVERED; class to no-op candidate | house | kept as BDK-EJ-2 |                |

### `rules/security.md`

| T40 id                 | excerpt                         | class           | spot-check correction | kind       | decision                                    | re-measured M2 |
| ---------------------- | ------------------------------- | --------------- | --------------------- | ---------- | ------------------------------------------- | -------------- |
| `security.01.26bead3a` | Trust boundaries                | no-op candidate |                       | house      | kept as BDK-SEC-1                           |                |
| `security.02.882ee51d` | Injection                       | no-op candidate |                       | house      | kept as BDK-SEC-2                           |                |
| `security.03.88c26adb` | Output encoding                 | no-op candidate |                       | house      | kept as BDK-SEC-3                           |                |
| `security.04.ea1485ed` | Secrets                         | no-op candidate |                       | house      | kept as BDK-SEC-4                           |                |
| `security.05.8e63100b` | Authentication vs authorisation | no-op candidate |                       | house      | kept as BDK-SEC-5                           |                |
| `security.06.84dd9121` | Least privilege                 | no-op candidate |                       | house      | kept as BDK-SEC-6                           |                |
| `security.07.fe53e6a3` | Fail closed                     | no-op candidate |                       | house      | kept as BDK-SEC-7                           |                |
| `security.08.b52f50c9` | Sensitive data exposure         | no-op candidate |                       | house      | kept as BDK-SEC-8                           |                |
| `security.09.e8d17979` | Dependency hygiene              | no-op candidate |                       | house      | kept as BDK-SEC-9                           |                |
| `security.10.f3eef68b` | No language-specific tooling    | no-op candidate |                       | not a rule | removed: not a rule (a note about the file) |                |

### `rules/test-quality.md`

| T40 id                     | excerpt                                                                | class           | spot-check correction                            | kind  | decision                | re-measured M2 |
| -------------------------- | ---------------------------------------------------------------------- | --------------- | ------------------------------------------------ | ----- | ----------------------- | -------------- |
| `test-quality.01.c64e3dd1` | Every test names an observable behavior and the input that triggers it | unclear         |                                                  | house | kept as BDK-TQ-1        |                |
| `test-quality.02.7ee028ff` | Banned - word-presence assertions over prose                           | no-op candidate |                                                  | house | removed: measured no-op |                |
| `test-quality.03.c00d9084` | Banned - grep-the-source tests                                         | no-op candidate |                                                  | house | removed: measured no-op |                |
| `test-quality.04.93bd498a` | Banned - documentation-content tests                                   | no-op candidate |                                                  | house | removed: measured no-op |                |
| `test-quality.05.038d2a57` | Banned - path-existence tests                                          | no-op candidate |                                                  | house | removed: measured no-op |                |
| `test-quality.06.51848a5d` | Banned - asserting a literal the test itself supplied                  | no-op candidate |                                                  | house | removed: measured no-op |                |
| `test-quality.07.8a3de13b` | Banned - constant mirrors                                              | unclear         |                                                  | house | kept as BDK-TQ-2        |                |
| `test-quality.08.1b4f5c32` | Banned - interaction-only assertions                                   | unclear         |                                                  | house | kept as BDK-TQ-3        |                |
| `test-quality.09.aab96a99` | Banned - tests without a real assertion                                | no-op candidate | haiku MIXED to COVERED; class to no-op candidate | house | removed: measured no-op |                |
| `test-quality.10.e443895c` | Banned - introspection smoke tests                                     | unclear         |                                                  | house | kept as BDK-TQ-4        |                |
| `test-quality.11.4f8ce52c` | Banned - type-declaration mirrors                                      | unclear         |                                                  | house | kept as BDK-TQ-5        |                |
| `test-quality.12.50d9906a` | Banned - shape-only assertions                                         | unclear         |                                                  | house | kept as BDK-TQ-6        |                |
| `test-quality.13.4340d869` | Still allowed - generator and renderer output                          | no-op candidate |                                                  | house | kept as BDK-TQ-7        |                |
| `test-quality.14.000e5dd1` | Still allowed - schema and syntax validation of data files             | no-op candidate |                                                  | house | kept as BDK-TQ-8        |                |
| `test-quality.15.67efa34a` | Still allowed - strings that are the contract                          | no-op candidate |                                                  | house | kept as BDK-TQ-9        |                |
| `test-quality.16.5e2bb8be` | Still allowed - bounded snapshots of generated artifacts               | unclear         |                                                  | house | kept as BDK-TQ-10       |                |
| `test-quality.17.b8a39a39` | When the honest answer is no test, declare it                          | no-op candidate |                                                  | house | kept as BDK-TQ-11       |                |

### `rules/languages/javascript.md`

| T40 id                             | excerpt                                                                  | class           | spot-check correction                            | kind      | decision                                                  | re-measured M2 |
| ---------------------------------- | ------------------------------------------------------------------------ | --------------- | ------------------------------------------------ | --------- | --------------------------------------------------------- | -------------- |
| `languages/javascript.01.3656bc66` | ESM with named exports is the baseline                                   | unclear         |                                                  | house     | kept as BDK-JS-1                                          |                |
| `languages/javascript.02.1e2c38ec` | Break circular dependencies — they hide initialization-order bugs        | no-op candidate |                                                  | house     | removed: measured no-op                                   |                |
| `languages/javascript.03.d8477f81` | `const` by default; `let` only when reassignment is real                 | no-op candidate |                                                  | house     | removed: measured no-op                                   |                |
| `languages/javascript.04.4cc2150a` | Don't mutate shared state — use the immutable operations                 | no-op candidate |                                                  | house     | removed: measured no-op                                   |                |
| `languages/javascript.05.22be531b` | `async`/`await` over raw `.then` chains                                  | unclear         |                                                  | house     | kept as BDK-JS-2                                          |                |
| `languages/javascript.06.ba108d02` | Parallelize independent async work; await sequentially only when ordered | unclear         |                                                  | house     | kept as BDK-JS-3                                          |                |
| `languages/javascript.07.97883d94` | No floating promises — every async path has an error handler             | no-op candidate |                                                  | house     | removed: measured no-op                                   |                |
| `languages/javascript.08.61063137` | Make long-running async work cancellable with `AbortController`          | no-op candidate |                                                  | house     | removed: measured no-op                                   |                |
| `languages/javascript.09.bdc1f5f3` | `===` always; `==` never                                                 | unclear         |                                                  | house     | kept as BDK-JS-4                                          |                |
| `languages/javascript.10.f79ad05e` | `??` for nullish fallbacks, `?.` for nullish access                      | no-op candidate |                                                  | house     | removed: measured no-op                                   |                |
| `languages/javascript.11.1c0fb041` | Chain errors with `Error.cause`; model failures as typed errors          | unclear         |                                                  | house     | kept as BDK-JS-5                                          |                |
| `languages/javascript.12.62d43cb6` | Reach for the modern stdlib instead of hand-rolling                      | unclear         | sonnet MISSED to COVERED                         | knowledge | kept as BDK-JS-6                                          |                |
| `languages/javascript.13.170d7d21` | Top-level `await` belongs in leaf modules, not shared libraries          | no-op candidate |                                                  | house     | removed: measured no-op                                   |                |
| `languages/javascript.14.cdf81466` | Pure functions in the core; side effects at the edges                    | no-op candidate |                                                  | house     | removed: measured no-op                                   |                |
| `languages/javascript.15.a6220c9f` | Mind the classic foot-guns                                               | unclear         | sonnet MISSED to COVERED                         | knowledge | kept as BDK-JS-7                                          |                |
| `languages/javascript.16.fb708e4d` | Never turn untrusted input into code                                     | no-op candidate |                                                  | knowledge | removed: knowledge both models have (M1 COVERED for both) |                |
| `languages/javascript.17.1c945754` | `textContent` for untrusted text; sanitize before any HTML sink          | no-op candidate |                                                  | knowledge | removed: knowledge both models have (M1 COVERED for both) |                |
| `languages/javascript.18.6205c1b3` | Treat untrusted keys as prototype-pollution vectors                      | effective       |                                                  | house     | kept as BDK-JS-8                                          |                |
| `languages/javascript.19.b7a40285` | `execFile`/`spawn` with an argument array — never `exec` with user input | no-op candidate |                                                  | knowledge | removed: knowledge both models have (M1 COVERED for both) |                |
| `languages/javascript.20.04eccab6` | Validate user-controlled URLs against SSRF                               | no-op candidate | haiku MIXED to COVERED; class to no-op candidate | house     | removed: measured no-op                                   |                |
| `languages/javascript.21.18578ef9` | Confine user file paths to a base directory                              | no-op candidate |                                                  | house     | removed: measured no-op                                   |                |
| `languages/javascript.22.f316889c` | Bound regex against ReDoS                                                | no-op candidate |                                                  | house     | removed: measured no-op                                   |                |
| `languages/javascript.23.02a8cb13` | Cryptographic randomness for anything security-bearing                   | no-op candidate |                                                  | knowledge | removed: knowledge both models have (M1 COVERED for both) |                |
| `languages/javascript.24.6df1d612` | Constant-time comparison for secrets                                     | no-op candidate |                                                  | knowledge | removed: knowledge both models have (M1 COVERED for both) |                |
| `languages/javascript.25.30a53061` | Validate `postMessage` origin; isolate `target="_blank"`                 | no-op candidate |                                                  | knowledge | removed: knowledge both models have (M1 COVERED for both) |                |

### `rules/languages/react.md`

| T40 id                        | excerpt                                                                  | class              | spot-check correction                                 | kind      | decision                                                  | re-measured M2       |
| ----------------------------- | ------------------------------------------------------------------------ | ------------------ | ----------------------------------------------------- | --------- | --------------------------------------------------------- | -------------------- |
| `languages/react.01.7f1e2abd` | Server Components by default                                             | no-op candidate    |                                                       | house     | kept as BDK-REACT-1                                       |                      |
| `languages/react.02.770dd87f` | Trust the React Compiler — drop manual memoization                       | effective          |                                                       | house     | kept as BDK-REACT-2                                       |                      |
| `languages/react.03.d753f359` | `useEffect` is for syncing with external systems, not for derived state  | no-op candidate    |                                                       | house     | removed: measured no-op                                   |                      |
| `languages/react.04.bd01d447` | Forms go through Actions                                                 | unclear            |                                                       | house     | kept as BDK-REACT-3                                       | 1 [0..1] vs 0 [0..0] |
| `languages/react.05.c8d8910c` | Data fetching is declarative — Suspense + `use()`                        | unclear            |                                                       | house     | kept as BDK-REACT-4                                       | 0 [0..1] vs 0 [0..0] |
| `languages/react.06.9fabf21e` | State escalates only when shared                                         | unclear            |                                                       | house     | kept as BDK-REACT-5                                       | 1 [1..1] vs 0 [0..1] |
| `languages/react.07.354f8c17` | Composition beats Context for prop drilling                              | unclear            |                                                       | house     | kept as BDK-REACT-6                                       |                      |
| `languages/react.08.da4c4908` | Semantic HTML first; ARIA only as repair                                 | unclear            |                                                       | house     | kept as BDK-REACT-7                                       |                      |
| `languages/react.09.0fd2a34f` | Suspense + ErrorBoundary at meaningful granularity                       | unclear            | sonnet MIXED to COVERED                               | house     | kept as BDK-REACT-8                                       |                      |
| `languages/react.10.b94cb0a5` | `ref` is a prop in React 19                                              | effective          |                                                       | knowledge | kept as BDK-REACT-9                                       |                      |
| `languages/react.11.47cc2659` | State shape escalates with coupling, not size                            | effective          |                                                       | house     | kept as BDK-REACT-10                                      |                      |
| `languages/react.12.78cadee6` | Component size measured in responsibilities, not lines                   | unclear            |                                                       | house     | kept as BDK-REACT-11                                      |                      |
| `languages/react.13.faaba6fa` | Cap cohesive props around five; flag boolean explosion                   | unclear            |                                                       | house     | kept as BDK-REACT-12                                      |                      |
| `languages/react.14.3f4c147c` | Extract custom hooks for reuse or for local readability — place by scope | unclear            |                                                       | house     | kept as BDK-REACT-13                                      |                      |
| `languages/react.15.fd4c706b` | `useEffectEvent` over refs for latest-value handlers                     | corrects the model |                                                       | knowledge | kept as BDK-REACT-14                                      |                      |
| `languages/react.16.bade8d1b` | Optimistic UI is local; Suspense is structural                           | corrects the model | sonnet MIXED to COVERED; sonnet-prime MIXED to MISSED | house     | kept as BDK-REACT-15                                      |                      |
| `languages/react.17.6e3551fc` | Server Action errors: return for recoverable, throw for fatal            | no-op candidate    |                                                       | house     | kept as BDK-REACT-16                                      |                      |
| `languages/react.18.5d6ea2fe` | Context for environment, store for hot state                             | effective          |                                                       | house     | kept as BDK-REACT-17                                      |                      |
| `languages/react.19.9766037e` | `<ViewTransition>` is an enhancement, not a routing primitive            | unclear            | sonnet-prime COVERED to MISSED                        | house     | kept as BDK-REACT-18                                      |                      |
| `languages/react.20.0477adec` | Asset preloading is declarative and co-located                           | corrects the model |                                                       | house     | kept as BDK-REACT-19                                      |                      |
| `languages/react.21.94ab3e2d` | `dangerouslySetInnerHTML` is the one XSS hatch — sanitize at it          | no-op candidate    |                                                       | knowledge | removed: knowledge both models have (M1 COVERED for both) |                      |
| `languages/react.22.cc13d2c5` | React does not sanitize URL schemes — validate `href`/`src`              | no-op candidate    |                                                       | knowledge | removed: knowledge both models have (M1 COVERED for both) |                      |
| `languages/react.23.774e0d8f` | Server Component props and Server Action arguments are a trust boundary  | no-op candidate    |                                                       | knowledge | removed: knowledge both models have (M1 COVERED for both) |                      |
| `languages/react.24.80817108` | Secrets never cross into a Client Component                              | no-op candidate    |                                                       | knowledge | removed: knowledge both models have (M1 COVERED for both) |                      |

### `rules/languages/typescript.md`

| T40 id                             | excerpt                                                                           | class           | spot-check correction | kind      | decision                                                  | re-measured M2       |
| ---------------------------------- | --------------------------------------------------------------------------------- | --------------- | --------------------- | --------- | --------------------------------------------------------- | -------------------- |
| `languages/typescript.01.652cdaa6` | Strict mode is the floor, not a goal                                              | no-op candidate |                       | house     | removed: measured no-op                                   |                      |
| `languages/typescript.02.f372a9a8` | Turn on the checks `strict` leaves out                                            | no-op candidate |                       | house     | kept as BDK-TS-1                                          |                      |
| `languages/typescript.03.cc1de1ef` | `unknown`, never `any`, at the edges                                              | unclear         |                       | house     | kept as BDK-TS-2                                          |                      |
| `languages/typescript.04.ced7773d` | Annotate the boundaries; infer the interior                                       | unclear         |                       | house     | kept as BDK-TS-3                                          | 0 [0..0] vs 0 [0..0] |
| `languages/typescript.05.bb9b783b` | Types vanish at runtime — validate untrusted input with a real parser             | no-op candidate |                       | knowledge | removed: knowledge both models have (M1 COVERED for both) |                      |
| `languages/typescript.06.574c25ce` | Model variants as discriminated unions                                            | unclear         |                       | house     | kept as BDK-TS-4                                          |                      |
| `languages/typescript.07.9cc08024` | Make illegal states unrepresentable                                               | no-op candidate |                       | house     | removed: measured no-op                                   |                      |
| `languages/typescript.08.81127fac` | Guard exhaustiveness with `never`, preferably via a reusable `assertNever` helper | no-op candidate |                       | house     | removed: measured no-op                                   |                      |
| `languages/typescript.09.dc7b325b` | `satisfies` for config and literals — not `as`                                    | unclear         |                       | house     | kept as BDK-TS-5                                          |                      |
| `languages/typescript.10.a1c07b66` | `as` is an unchecked claim — earn it or remove it                                 | unclear         |                       | house     | kept as BDK-TS-6                                          |                      |
| `languages/typescript.11.4ac2e4a4` | Non-null `!` is almost always a smell                                             | no-op candidate |                       | house     | removed: measured no-op                                   |                      |
| `languages/typescript.12.7a742072` | `catch` is `unknown` — anything can be thrown                                     | no-op candidate |                       | house     | removed: measured no-op                                   | 1 [1..1] vs 1 [1..1] |
| `languages/typescript.13.fc7ffd88` | Avoid `enum`; reach for `as const` objects or unions                              | effective       |                       | house     | kept as BDK-TS-7                                          |                      |
| `languages/typescript.14.59fe5951` | Generics serve readability, not cleverness                                        | unclear         |                       | house     | kept as BDK-TS-8                                          | 1 [0..1] vs 0 [0..0] |
| `languages/typescript.15.8dad880f` | Template literal types for known, finite string sets only                         | unclear         |                       | house     | kept as BDK-TS-9                                          |                      |
| `languages/typescript.16.e37a8262` | Configure modules for your bundler                                                | unclear         |                       | house     | kept as BDK-TS-10                                         |                      |
| `languages/typescript.17.d06cfb2e` | The type system provides zero runtime security                                    | no-op candidate |                       | knowledge | removed: knowledge both models have (M1 COVERED for both) |                      |
| `languages/typescript.18.eec3bdec` | `JSON.parse` returns `any` and bypasses every guard                               | unclear         |                       | knowledge | removed: knowledge both models have (M1 COVERED for both) |                      |
| `languages/typescript.19.00a6efe2` | `any` and unsafe casts erase security-relevant invariants                         | no-op candidate |                       | knowledge | removed: knowledge both models have (M1 COVERED for both) |                      |
| `languages/typescript.20.fba20d9c` | Third-party types can lie about runtime shape                                     | no-op candidate |                       | knowledge | removed: knowledge both models have (M1 COVERED for both) |                      |
| `languages/typescript.21.4ebaaaf8` | The npm dependency tree is the largest attack surface                             | unclear         |                       | house     | kept as BDK-TS-11                                         |                      |
| `languages/typescript.22.dbd6f1d7` | `verbatimModuleSyntax` keeps import intent honest                                 | no-op candidate |                       | house     | kept as BDK-TS-12                                         |                      |
