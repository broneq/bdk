# Design Patterns Rules

Language-agnostic principles for applying structural design patterns.

- **Pattern fit.** Apply a pattern only when it solves a concrete, present problem — not to future-proof or demonstrate familiarity. Named patterns (Strategy, Factory, Observer, Decorator, Repository, etc.) communicate intent; unnamed ad-hoc structure does not.
- **Strategy.** Extract varying behaviour into a collaborator when the same algorithm is selected at runtime. Prefer over conditionals that grow with each new case.
- **Factory / Abstract Factory.** Centralise object construction when creation logic is complex, varies by context, or must be swapped in tests. Do not use for trivial `new` calls.
- **Observer / Event.** Decouple producers from consumers when the producer should not know about its subscribers. Prefer over direct method calls when the subscriber set changes at runtime.
- **Decorator.** Add behaviour to an object without subclassing. Prefer over inheritance when the added behaviour is optional or composable.
- **Repository.** Isolate data-access logic behind a domain-facing interface. Keeps domain objects free of query language or ORM details.
- **Tell-Don't-Ask.** Behaviour lives with data. A `Document` object exposes `document.line(5).text()`; do not scatter helpers like `get_line_text(parse(src), 5)` that pull state out and operate on it externally. Counters Anemic model.
- **Replace conditional with polymorphism.** When a switch or if-chain dispatches on a type tag (`if kind == "pdf": ... elif kind == "xml": ...`), push branches into subclasses or a Strategy. New cases extend code, not edit it.
- **Open/Closed (SOLID — OCP).** Modules are open for extension, closed for modification. Adding a behaviour should mean adding code (a new subclass, strategy, or handler), not editing a central switch every existing caller depends on. The polymorphism rule above is OCP in practice; reach for it only once a second case actually appears — not speculatively (see Pattern fit).
- **Liskov Substitution (SOLID — LSP).** A subtype must honour its supertype's contract — same accepted inputs, no stronger preconditions, no weaker postconditions, no surprise exceptions. A subclass that overrides a method to throw `NotSupported` or silently no-op breaks callers written against the base type. If substitution does not hold, the relationship is not "is-a" — prefer composition.
- **Anti-patterns to avoid.** God class (one class knows everything), Shotgun surgery (one change touches many files), Primitive obsession (domain concepts as raw strings/ints), Anemic model (objects with only getters/setters and no behaviour).
- **Pattern documentation.** When proposing a pattern, name it, state the problem it solves, and show the proposed shape — not just the name.
- **GoF catalog.** The five patterns named above (Strategy, Factory, Observer, Decorator, Repository) are the ones that recur in review. The full Gang of Four catalog applies; reach for it when a problem matches a named pattern, but do not introduce patterns not listed here without justifying fit per the Pattern fit rule.
