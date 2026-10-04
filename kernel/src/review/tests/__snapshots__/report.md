# 2026-09-25-passwordless-login

Users log in with a one-time link.

- Kind: feature
- Range: `aaaaaaaaaaaa..bbbbbbbbbbbb`
- Files: 4, lines +84 -5
- Open entries by level: blocker 1, should-fix 1, nice-to-have 1, untriaged 1
- By disposition: defer 1, none 3

## Parts and areas

| | `README.md` | `src/auth` | `src/mail` |
|---|---|---|---|
| 01 Magic link |  | +70 -4 (2) |  |
| 02 Mail |  |  | +12 -1 (1) |
| outside the plan | +2 -0 (1) |  |  |

## Change map

### auth

Login gains a magic link path; password login is unchanged.

- `src/auth/login.test.ts` +40 -0 [L-00000003 · nice-to-have · defer]
  - Task 01-1 Issue the link
- `src/auth/login.ts` +30 -4 [L-00000002 · should-fix] [L-00000003 · nice-to-have · defer]
  - Task 01-1 Issue the link
  - 1111111 feat: issue the link
  - 2222222 fix: hash the token

### public-api

The login endpoint accepts a link token.

No changed file matches its paths.

### Outside the plan

The README documents the new flow.

- `README.md` +2 -0 [L-00000005 · untriaged]

## Gate

- Tests: pass
- Lint: pass
- Coverage unit: 91.5% (min 80%) pass

## Decisions

### should-fix (1)

- **L-00000002** finding L-00000002
  - finding · high · security · by agent:reviewer · undecided
  - Refs: `src/auth/login.ts#verify`
  - Problem: The token is compared with ==.
  - Why it matters: A timing attack reveals it.
  - Suggested fix: Use timingSafeEqual.

### nice-to-have (1)

- **L-00000003** observation L-00000003
  - observation · by agent:reviewer · decided defer
  - Refs: `auth`
  - Dates are built by hand.

### untriaged (1)

- **L-00000005** finding L-00000005
  - finding · by agent:reviewer · undecided
  - Refs: `README.md`

## Settled

- L-00000006 finding L-00000006 (fixed in 01-1)

## Context

- L-00000001 decision: Links expire
- L-00000007 assumption: Mail arrives in a minute
