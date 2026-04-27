# Code Quality Rules

Language-agnostic principles applied during review and planning. Skill consumers handle language-specific tooling.

- **Naming.** Descriptive identifiers; no abbreviations unless idiomatic for the language.
- **Function size.** One responsibility per function. Big functions become hard to test and review.
- **Comments.** Explain *why* — the non-obvious constraint, the workaround. Not *what* (the code already says that). No commented-out code; delete it.
- **Error handling.** Validate at system boundaries (user input, external APIs). Trust internal calls and framework guarantees. No defensive try/except around code that can't fail.
- **Dead code.** Remove unused code rather than commenting it out. Version control preserves history.
- **Tests.** New public APIs have tests. Tests document intended behavior.
- **No language-specific tooling.** This file is language-agnostic. Skill consumers handle language nuance.
