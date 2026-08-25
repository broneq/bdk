# Test Quality Rules

Language-agnostic principles for deciding whether a test is worth writing. Applied when planning test cases and when writing them.

- **Every test names an observable behavior and the input that triggers it.** Before writing a test, state a plausible product change that would make it fail. If no such change exists, the test verifies nothing - do not write it. A missing test is visible; a test that cannot fail is worse, because it reads as coverage.
- **Banned - word-presence assertions over prose.** Never assert that a documentation file, README, docstring, or comment body contains a phrase or matches a pattern. Prose gets reworded, and the test either breaks for no reason or keeps passing on a sentence that now means the opposite.
- **Banned - grep-the-source tests.** Never assert on the text of source files: that an import is absent, that a call appears a certain number of times, that a naming convention holds. That is the linter's job, and a test cannot enforce it over code not yet written.
- **Banned - documentation-content tests.** Never assert that a symbol's documentation mentions something. Documentation is not behavior.
- **Banned - path-existence tests.** Never assert that a file or directory exists without exercising the behavior that consumes it. If the path matters, test what breaks when it is wrong.
- **Banned - asserting a literal the test itself supplied.** When a stub or fixture is configured to return a value and the test asserts that same value, the test verifies the stub, not the code under test.
- **Banned - constant mirrors.** Asserting that a constant equals its own definition catches nothing: any change edits both sides at once. If the value matters, assert the behavior that depends on it.
- **Banned - interaction-only assertions.** Asserting that a collaborator was called, with no assertion on the produced result or the resulting state, pins the current implementation in place while proving nothing about what it produces.
- **Banned - tests without a real assertion.** An always-true assertion, a not-null check as the only check, or a swallowed exception all mean the test passes regardless of behavior.
- **Banned - introspection smoke tests.** Asserting that a symbol exists, is callable, or that a module loads verifies the language, not the code.
- **Banned - type-declaration mirrors.** Asserting a value's type where the signature already declares it duplicates the type checker and fails only where the type checker would have failed first.
- **Banned - shape-only assertions.** Asserting that a structure has certain fields or a certain size, without asserting what any value means, passes on entirely wrong data.
- **Still allowed - generator and renderer output.** Asserting that a template renderer resolved a marker, or that a resolver selected the right branch, exercises real code even though the output is text. The bans above cover testing hand-written prose, not testing the code that produces text.
- **Still allowed - schema and syntax validation of data files.** Parsing a configuration or data file and checking it conforms to its schema is verification of an artifact, not a word test.
- **Still allowed - strings that are the contract.** Command output format, protocol field names, stable error codes, and exit codes are a public interface; assert them.
- **Still allowed - bounded snapshots of generated artifacts** when the artifact is the deliverable and the comparison is over structure, not prose.
- **When the honest answer is no test, declare it.** If a change is non-executable content and the only test anyone could write is on the banned list, say so and rely on review. Padding a change with a test that cannot fail is worse than an explicitly untested change, because it hides the gap.
