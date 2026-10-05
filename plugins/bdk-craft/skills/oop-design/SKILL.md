---
name: oop-design
description: Object design choices - value objects, composition over inheritance, constructor injection, tell-don't-ask, and strategy or state objects over conditionals. Use when designing classes, a domain model, or reshaping one big class.
license: MIT
---

# Object design

Most object designs fail in the same few ways: primitives where domain values belong, inheritance used to share code, collaborators fetched instead of given, and logic sitting outside the object that owns the data. This skill makes those choices explicit and records them in a design note.

## Steps

1. List the nouns and verbs of the use case in the user's words. Nouns become candidate types, verbs become methods on the type that owns the data they need.
2. Classify every candidate type with the table below. Each type has exactly one kind.
3. Apply the rules to each type in turn.
4. Write the design note, then the code.

## Kinds

| Kind         | Identity                              | Mutable                      | Holds                                                  | Example                                  |
| ------------ | ------------------------------------- | ---------------------------- | ------------------------------------------------------ | ---------------------------------------- |
| Value object | none: equal when all fields are equal | no                           | a domain value and its rules                           | `Money`, `EmailAddress`, `DateRange`     |
| Entity       | an id that survives changes           | yes, through its own methods | state and the invariants over it                       | `Order`, `Account`                       |
| Policy       | none                                  | no                           | one interchangeable rule                               | `PercentageDiscount`, `FreeShippingOver` |
| Service      | none                                  | no                           | a use case that coordinates entities                   | `PlaceOrder`                             |
| Port         | none                                  | -                            | an interface to the outside world, owned by the domain | `PaymentGateway`, `OrderRepository`      |
| Adapter      | none                                  | -                            | the implementation of a port for one technology        | `StripePaymentGateway`                   |

## Rules

### Value objects for domain values

- Wrap every value with rules (a format, a range, a unit, a currency) in a value object. A raw `string` email or a `number` price spreads its validation across every caller.
- Validate in the constructor or a factory and make an invalid instance impossible to create.
- Make it immutable. Operations return a new instance: `price.add(tax)`, never `price.amount += tax`.
- Money is an integer amount of minor units plus a currency, never a floating-point number. Adding two currencies is an error, not a conversion.

### Composition over inheritance

- Use inheritance only for a true "is a" relation that will not change at runtime, and only one level deep.
- When variants differ in one behaviour, extract that behaviour behind an interface and give the object an instance of it.
- A base class that exists to share helper code is the wrong tool. Move the helpers to a collaborator or a function.

### Replace a conditional with an object

| The conditional                                                               | Replace it with                                                     |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| A `switch` on a type code that picks an algorithm, repeated in several places | Strategy: one interface, one class per algorithm, chosen once       |
| A `switch` on a status that decides which operations are allowed              | State: one class per state, each answering the operations it allows |
| A chain of `if`s that each add an optional step                               | Decorator or a list of steps applied in order                       |

Keep a single `if` that appears once. The pattern pays off when the same decision is repeated.

### Constructor injection

- An object receives its collaborators through its constructor, typed as ports or interfaces.
- No object creates its own collaborators with `new` inside a method, reads a global, or looks itself up in a service locator.
- Wire the graph in one place at the edge of the program (the composition root).
- More than four constructor parameters signals more than one responsibility. Split the class.

### Tell, don't ask

- Put a behaviour on the object that owns the data it needs: `order.addLine(product, quantity)`, not `order.getLines().push(...)`.
- An entity exposes operations that keep its invariants, not setters. `account.withdraw(amount)` checks the balance; `setBalance` cannot.
- A method that only reads another object's fields to make a decision belongs on that other object.

## The design note

Before the code, write this table and the decisions under it:

```text
Design note
| Type | Kind | Responsibility | Collaborators |
| Money | Value object | amount in minor units + currency; add, multiply | - |
| Order | Entity | lines, total, place(); keeps "no empty order placed" | Money |
| DiscountPolicy | Port | apply(order) -> Money | - |
| PercentageDiscount | Policy | DiscountPolicy for a percentage | Money |
| PlaceOrder | Service | validates, applies the policy, saves | OrderRepository, DiscountPolicy |

Decisions
- Discounts are policies behind DiscountPolicy (strategy), not subclasses of Order: new discount kinds come without touching Order.
- ...
```

Every type in the code appears in the note with one kind. Every decision names the rule above it follows, or the reason for leaving it.

## Anti-patterns

- Anaemic entities: data classes with getters and setters, and every rule in a service.
- God service: one class with a method per use case and twenty dependencies.
- Inheritance for reuse: `class AdminUser extends User` to share three helper methods.
- Primitive obsession: `string` ids, `number` money and `string` status codes passed through every layer.
- An interface for every class. Add a port where there is a second implementation, a test double or an outside system.
