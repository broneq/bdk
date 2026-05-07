# Design Patterns Rules

Language-agnostic principles for applying structural design patterns.

- **Pattern fit.** Apply a pattern only when it solves a concrete, present problem — not to future-proof or demonstrate familiarity. Named patterns (Strategy, Factory, Observer, Decorator, Repository, etc.) communicate intent; unnamed ad-hoc structure does not.
- **Strategy.** Extract varying behaviour into a collaborator when the same algorithm is selected at runtime. Prefer over conditionals that grow with each new case.
- **Factory / Abstract Factory.** Centralise object construction when creation logic is complex, varies by context, or must be swapped in tests. Do not use for trivial `new` calls.
- **Observer / Event.** Decouple producers from consumers when the producer should not know about its subscribers. Prefer over direct method calls when the subscriber set changes at runtime.
- **Decorator.** Add behaviour to an object without subclassing. Prefer over inheritance when the added behaviour is optional or composable.
- **Repository.** Isolate data-access logic behind a domain-facing interface. Keeps domain objects free of query language or ORM details.
- **Anti-patterns to avoid.** God class (one class knows everything), Shotgun surgery (one change touches many files), Primitive obsession (domain concepts as raw strings/ints), Anemic model (objects with only getters/setters and no behaviour).
- **Pattern documentation.** When proposing a pattern, name it, state the problem it solves, and show the proposed shape — not just the name.
