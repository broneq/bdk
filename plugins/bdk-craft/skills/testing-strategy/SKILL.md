---
name: testing-strategy
description: Test strategy and test design choices - one job per test level, test doubles only at owned boundaries, Test Data Builders, Page Objects for browser tests, contract tests between services, injected clocks. Load it before answering any question about how to test a feature, service or app, before writing a test plan, and before writing example tests.
license: MIT
---

# Testing strategy

A suite gets slow, brittle or blind when every test tries to do everything. Plan the tests in this order, then show examples that use the patterns below.

## 1. Give each behaviour one level

| Level | Owns | Doubles |
| --- | --- | --- |
| Unit | Rules of one module: calculations, validation, state transitions, limits and lockouts | Only ports the module owns (`PaymentGateway`, `Clock`, `OrderRepository`) |
| Integration | One adapter against the real thing: repository against a real database, HTTP client against a local fake server | None for the thing under test |
| Contract | The request and response shapes between a consumer and a provider (for example consumer-driven contracts with Pact) | The other side, replaced by the contract |
| End-to-end | A few journeys that must never break, through the running system | None, or only third parties you do not control |

Push every check to the lowest level that can see the failure. Edge cases and error permutations are unit tests; end-to-end tests are a handful of critical journeys.

**Done when:** every behaviour or risk in the request has exactly one level in a plan table.

## 2. Place doubles at owned boundaries only

- Never mock a library the project does not own (`stripe`, `axios`, `pg`, `fetch`, an Elasticsearch client). Wrap it in a small adapter, replace the adapter in unit tests, and cover the adapter with an integration test against a real or locally faked server.
- Prefer a fake (working in-memory implementation) for ports that store state; use a mock when the interaction is the behaviour ("sends one e-mail").
- Inject time and randomness (`Clock`, `IdGenerator`). Test a lockout or an expiry by advancing a fake clock, never by sleeping.

**Done when:** every double in the plan is a port the project owns.

## 3. Build test data with Test Data Builders

```ts
const order = anOrder()
  .withCustomer(aCustomer().withTier("gold"))
  .withLine(aLine().withQuantity(3))
  .build();
```

- Valid defaults for every field, so a test sets only what it is about.
- `aX()` / `anX()` to start, `withY()` to change a field, `build()` to finish; one builder per domain type, shared by every level.
- Each test builds its own data; no shared mutable fixtures.

**Done when:** the example tests build domain objects through builders, not inline literals.

## 4. Drive browser tests through Page Objects

```ts
class LoginPage {
  constructor(private readonly page: Page) {}
  async open() { await this.page.goto("/login"); }
  async signIn(email: string, password: string) {
    await this.page.getByLabel("Email").fill(email);
    await this.page.getByLabel("Password").fill(password);
    await this.page.getByRole("button", { name: "Sign in" }).click();
  }
  error() { return this.page.getByRole("alert"); }
}
```

- Methods express user intent; selectors stay inside the class and use roles, labels or visible text.
- Assertions stay in the test. A method that navigates returns the next Page Object.
- Wait for a visible state, never for a fixed time.

**Done when:** every end-to-end example goes through a `...Page` class.

## 5. Cover service boundaries with contract tests

When a frontend or service consumes another service's API, the consumer records the requests it sends and the responses it relies on, and the provider verifies that contract in its own build. A shared end-to-end environment finds the same break later and blames the wrong team.

**Done when:** every consumer-provider pair in the request has a contract test in the plan.

## Output

A plan table (behaviour or risk, level, doubles, data), then example tests at the unit, integration or contract, and end-to-end levels that use the builders, the Page Object and the fake clock.

## Anti-patterns

- Many end-to-end tests, few unit tests.
- `jest.mock("stripe")` or `vi.mock("axios")` in unit tests.
- Fifty-field fixtures copied into every test.
- Selectors spread across test files; `sleep(1000)` instead of waiting for a state.
