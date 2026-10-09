# Design

## Context

See proposal.md - Why. Reproduction: the denied calls were `"<root>/bin/bdk" plan check ...` with and without a trailing `; echo "exit=$?"`. The grant pattern `*/bin/bdk *` needs a space right after `bdk`; the closing quote breaks that. The skill's own `allowed-tools` entry has the same shape, so a real session prompts for the quoted form too.

## Goals / Non-Goals

**Goals:** both eval cases stable at 1.00; the cause fixed where it arises.

**Non-Goals:** the same quoted form in other skills (`execute-waves`, `diagnose-bug`, `plan-draft`, `verify-plan`, the `!` config block). Their cases pass with the grants they have; the `!` block is substituted before the permission check. Not widened without a measured failure.

## Decisions

- **Fix in the skill wording, not in the grants.** Widening the README grant (for example `Bash(*/bin/bdk" *)`, or `Bash(*)`) would hide a form that the skill's own `allowed-tools` does not match either, so real users would still be prompted. The skill names the one form the grant matches. Alternative rejected: grant change only.
- **Unquoted path.** The plugin root has no spaces in the plugin cache path; a root with spaces would need the quote, but then the grant cannot match in any form, so quoting buys nothing.
- **State the reason in the skill** (a denied call stops the stage), so the model does not "improve" the command with `cd` or `echo`.
- No CLI helper: the eval shows the wording is enough (3 runs each at 1.00).

## Risks / Trade-offs

- [Model still adds `echo`/`cd` in a run] -> measured 6 of 6 clean runs; the reason is in the text.
- [Other skills share the quoted form] -> recorded as non-goal; revisit on a measured denial.

## Measurements

Before (this host, clean HOME, sonnet, 3 runs): `plan-verify-written` 0.52. After: `plan-verify-written` 1.00 ($1.36), `plan-budget-spent` 1.00 ($1.33).
