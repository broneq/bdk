## ADDED Requirements

### Requirement: Test hooks have the time budget of tests
The root Vitest config SHALL give every hook (`beforeAll`, `beforeEach`, `afterAll`, `afterEach`, `onTestFinished`) the same timeout it gives a test, so a hook that builds or deletes git fixtures does not fail on the filesystem stalls of a loaded machine that a test of the same work survives. A hook that needs more time than a test SHALL pass its own limit.

#### Scenario: Full runs under load pass
- **WHEN** a full `pnpm test` runs three times in a row while two more full runs of the suite run at the same time with `--maxWorkers` raised
- **THEN** every run passes with no hook timeout

#### Scenario: Hook budget follows the test budget
- **WHEN** a contributor reads `vitest.config.ts`
- **THEN** `hookTimeout` equals `testTimeout`
