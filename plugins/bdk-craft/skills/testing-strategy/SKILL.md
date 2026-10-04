---
name: testing-strategy
description: Test strategy choices - what each test level owns, mocks only at owned boundaries, Test Data Builders, Page Objects for UI end-to-end tests, and contract tests between services. Use when planning tests for a feature, a module or a whole project.
license: MIT
---

# Testing strategy

A test suite is slow, brittle or blind when every test tries to do everything. This skill gives each level one job, places test doubles only where they are safe, and fixes the two patterns that keep tests readable as they grow: the Test Data Builder and the Page Object.

## 1. Give each level one job

| Level       | Owns                                                                                                                    | Does not own                                   | Doubles                                          |
| ----------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------ |
| Unit        | Rules and decisions of one module: calculations, validation, state transitions                                          | Wiring, I/O, framework behaviour               | Ports the module owns; nothing else              |
| Integration | One adapter against the real thing: the repository against a real database, the HTTP client against a local fake server | Business rules (already covered by unit tests) | None for the thing under test                    |
| Contract    | The agreement between a consumer and a provider: request shapes, response shapes, status codes                          | Business behaviour behind the API              | The other side, replaced by its contract         |
| End-to-end  | A few critical user journeys through the deployed system                                                                | Edge cases and error permutations              | None, or only third parties outside your control |

- Push each check to the lowest level that can see the failure. An edge case of a price calculation is a unit test, never an end-to-end test.
- End-to-end tests cover the journeys that must never break (sign in, pay, the main workflow), not every screen. A handful, not hundreds.

## 2. Place test doubles at owned boundaries only

- Mock or fake only interfaces your code owns: a port like `PaymentGateway`, `Clock` or `OrderRepository`.
- Never mock a type you do not own: the HTTP library, the database driver, the framework's request object, the browser's `fetch`. Wrap it in a small adapter of your own, mock the adapter in unit tests, and cover the adapter with an integration test.
- Prefer a fake (a working in-memory implementation) over a mock with expectations for ports that store state. Use a mock when the interaction itself is the behaviour: "sends one email".
- Never mock the module under test or its value objects.
- Inject time and randomness through a port (`Clock`, `IdGenerator`), so tests are deterministic.

## 3. Build test data with Test Data Builders

Tests that construct objects inline repeat every required field and break when a field is added. Use a builder per domain object:

```ts
const order = anOrder()
  .withCustomer(aCustomer().withTier("gold"))
  .withLine(aLine().withQuantity(3))
  .build();
```

- The builder starts with valid defaults for every field, so a test sets only the fields it is about.
- Name builder functions `aX()` / `anX()` and setters `withY()`; `build()` returns the object.
- One builder per domain type, kept next to the tests, shared by every level.
- No shared mutable fixture objects across tests; each test builds its own.

## 4. Drive UI end-to-end tests through Page Objects

A UI test that locates elements inline breaks in twenty places when one screen changes. Wrap every page or component in a Page Object:

```ts
class LoginPage {
  constructor(private readonly page: Page) {}
  async open() { await this.page.goto("/login"); }
  async signIn(email: string, password: string) {
    await this.page.getByLabel("Email").fill(email);
    await this.page.getByLabel("Password").fill(password);
    await this.page.getByRole("button", { name: "Sign in" }).click();
  }
  errorMessage() { return this.page.getByRole("alert"); }
}
```

- Page Objects expose user intentions (`signIn`), never raw selectors.
- Locate elements by role, label or visible text, the way a user finds them. Use a dedicated test id only when nothing accessible exists.
- Assertions stay in the test, not in the Page Object.
- One Page Object per page or reusable component; a method that navigates returns the next Page Object.
- Wait for a visible state, never for a fixed time.

## 5. Verify contracts between services

- When a service consumes another team's API, write consumer contract tests that record the requests it sends and the responses it relies on.
- The provider runs those contracts in its own build, so a breaking change fails there, before deployment.
- Do not replace contract tests with a shared end-to-end environment; it finds the break later and blames the wrong team.

## The output

Deliver the strategy as a table, then the tests:

```text
Test plan
| Behaviour or risk | Level | Doubles | Data |
| discount for gold customers | unit | none | anOrder(), aCustomer() builders |
| orders saved and reloaded | integration | none, real database | anOrder() builder |
| sign in with a wrong password shows an error | end-to-end | none | LoginPage |
```

Every row names one level. Every double named is a port the project owns.

## Anti-patterns

- The ice-cream cone: many end-to-end tests, few unit tests.
- Mocking the HTTP client or the ORM directly in unit tests.
- Fixtures with fifty fields copied into every test.
- Selectors spread across end-to-end test files; sleeps instead of waits.
- Testing the same rule at every level.
