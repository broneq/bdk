# Security Rules

Language-agnostic principles applied during review and planning. Skill consumers handle language-specific tooling (static analysers, dependency scanners).

- **Trust boundaries.** Treat all data crossing into the system from outside — user input, request bodies, query params, headers, file contents, third-party API responses — as untrusted until validated. Validate shape, type, and range at the boundary; trust it thereafter. This is the security half of the "validate at boundaries" code-quality rule.
- **Injection.** Never build interpreted strings (SQL, shell, HTML, LDAP, template, command) by concatenating untrusted input. Use parameterised queries, prepared statements, and library-provided escaping. The rule is structural: data and code must travel in separate channels.
- **Output encoding.** Encode data for the context it lands in (HTML body, attribute, URL, JS, log line) at the point of output, not at input. The same value is safe in one sink and dangerous in another; encode per-sink.
- **Secrets.** No credentials, tokens, keys, or connection strings in source, logs, error messages, or client-shipped code. Read them from the environment or a secrets manager. A secret that reaches a log or a stack trace is a leaked secret.
- **Authentication vs authorisation.** Authenticate once at the edge; authorise on every privileged action. Check that *this* principal may act on *this* resource at the point of use — never infer authorisation from a prior auth step or a hidden client-side field.
- **Least privilege.** Grant the narrowest scope that works — DB roles, API tokens, file permissions, IAM policies. Default-deny; widen only with justification. A component compromised with narrow privilege does bounded damage.
- **Fail closed.** On error, ambiguity, or a missing check, deny access rather than allow it. An auth check that throws must block the action, not fall through to the success path.
- **Sensitive data exposure.** Do not return more than the caller needs — strip internal fields, stack traces, and version banners from responses. Errors shown to users say what failed, not how the system is built.
- **Dependency hygiene.** Treat third-party packages as attack surface. Pin versions, prefer maintained libraries over hand-rolled crypto/parsers, and remove unused dependencies — each one is code you did not write but ship.
- **No language-specific tooling.** This file is language-agnostic. Skill consumers handle scanner and linter integration.
