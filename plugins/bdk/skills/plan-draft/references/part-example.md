# A worked part

Part 02 of a Change `add-login-throttle`, whose part 01 added the store contract. It runs in wave 2 beside part 03 (the admin page), which touches other files.

```markdown
---
id: "02"
depends-on: ["01"]
isolation: worktree
files:
  - src/auth/throttle.ts
  - src/auth/throttle.test.ts
  - src/auth/login.ts
  - src/auth/login.test.ts
---

# Part 02: Throttle failed logins

## Goal

After five failed logins for one account within 15 minutes, the login endpoint answers 429 until the window ends.

## Acceptance scenarios

- `auth/login` / Requirement: Login throttle / Scenario: Fifth failure locks
- `auth/login` / Requirement: Login throttle / Scenario: Window ends

## Tasks

1. Count failures per account in a sliding window
   - File: src/auth/throttle.ts, src/auth/throttle.test.ts
   - Interface: isLocked(store: AttemptStore, account: string, now: Date): Promise<boolean>; recordFailure(store: AttemptStore, account: string, now: Date): Promise<void>. AttemptStore comes from part 01: `src/auth/attempt-store.ts`, `add(account, at)`, `since(account, from): Promise<Date[]>`
   - Verified by: auth/login / Requirement: Login throttle / Scenario: Window ends; src/auth/throttle.test.ts
2. Answer 429 from the login handler while the account is locked
   - File: src/auth/login.ts, src/auth/login.test.ts
   - Interface: POST /login returns 429 `{ "error": "too-many-attempts" }`; handler signature unchanged
   - Verified by: auth/login / Requirement: Login throttle / Scenario: Fifth failure locks; src/auth/login.test.ts; tests run with `pnpm vitest run src/auth`
```

Why it works:

- The part repeats the contract of part 01 (`AttemptStore` and its two methods), so its implementer never opens part 01.
- Every path in `File:` is in `files`, tests included, and no file is shared with part 03 of the same wave.
- `Interface:` gives signatures and the wire format, not bodies; the implementer chooses how to build them.
- Each scenario of the part is named in one `Verified by:` line, and the command is exact.
