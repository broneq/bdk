# Spec Delta

## MODIFIED Requirements

### Requirement: plan tasks are contracts with concrete test cases

A task SHALL state what the code must do and SHALL NOT carry implementation code: its goal in a few sentences, the exact signatures, types, file formats and messages that another task or part consumes, `Files:` naming every file it creates, modifies or tests, `Depends on:` for tasks of the same part it builds on, and `Stop rule:` where a worker could widen it beyond its files. A fenced code block appears only to fix an exact external format (a wire format, a file format, a command line), never a function body.

Every task with executable code SHALL carry `Test cases:`, and each test case SHALL name an input or situation and the observable result expected from it, written so a test can assert it. Every behaviour the task text states SHALL have at least one test case, including the boundaries and error paths the task or the design names. A task whose files are all non-executable content carries `Verification: none` instead (`kernel-state`, Plan part and plan index).

#### Scenario: concrete test case

- **WHEN** a task adds `formatDate(value, fallback)` with a fallback for a missing value
- **THEN** its test cases include one naming a missing value and the fallback it returns, not only "test the fallback"

#### Scenario: no implementation code

- **WHEN** `/bdk:plan` finishes on a `small` feature Change
- **THEN** no task of any part holds a fenced code block with a function body
