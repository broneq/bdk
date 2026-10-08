## Purpose

Lets a household sort entries into categories, by hand or by rules that match the description, so budgets and reports can group them.

## ADDED Requirements

### Requirement: Categories

`ledger category add <name>` SHALL add a category and print `Added category <name>`. A name follows the rule of account names and SHALL NOT be `none`, which the entry filters use for entries without a category; any other name SHALL print `ledger: invalid name <name>` to stderr and exit 2, and a name the book already holds SHALL print `ledger: category <name> exists` and exit 2. `ledger category list` SHALL print one category name per line in name order. A missing or unknown subcommand SHALL print `ledger: category needs one of add, list` and exit 2.

#### Scenario: Add and list categories

- **WHEN** `ledger category add food` and `ledger category add bills` run
- **THEN** `ledger category list` prints `bills`, then `food`

#### Scenario: Reserved name

- **WHEN** `ledger category add none` runs
- **THEN** it prints `ledger: invalid name none` to stderr and exits 2

#### Scenario: Existing category

- **WHEN** the book holds the category `food` and `ledger category add food` runs
- **THEN** it prints `ledger: category food exists` to stderr and exits 2

### Requirement: Rules

`ledger rule add <pattern> <category>` SHALL append a rule and print `Added rule <n>: <pattern> -> <category>`, where `<n>` is its position from 1. A rule's pattern matches an entry when the pattern occurs in the entry's description, ignoring case. A category the book does not hold SHALL print `ledger: no category <name>` to stderr and exit 2. `ledger rule list` SHALL print one line per rule in order, `<n>. <pattern> -> <category>`. A missing or unknown subcommand SHALL print `ledger: rule needs one of add, list` and exit 2.

#### Scenario: Add a rule

- **WHEN** the book holds the category `food` and `ledger rule add coffee food` runs
- **THEN** it prints `Added rule 1: coffee -> food` and `ledger rule list` prints `1. coffee -> food`

#### Scenario: Rule for an unknown category

- **WHEN** `ledger rule add coffee drinks` runs and the book has no category `drinks`
- **THEN** it prints `ledger: no category drinks` to stderr and exits 2

### Requirement: Categorize

`ledger categorize` SHALL give every entry whose category is `null` and that is not part of a transfer the category of the first rule, in rule order, whose pattern matches it, and SHALL print `Categorized <n> entries`, where `<n>` is the number of entries it changed. Entries with a category, transfer entries and entries no rule matches SHALL stay unchanged.

#### Scenario: Match ignores case

- **WHEN** the book holds the rule `coffee -> food` and an entry without a category described `COFFEE beans`
- **THEN** `ledger categorize` prints `Categorized 1 entries` and the entry has the category `food`

#### Scenario: First rule wins

- **WHEN** the rules are `shop -> groceries`, then `coffee shop -> food`, and an entry without a category is described `Coffee shop`
- **THEN** after `ledger categorize` the entry has the category `groceries`

#### Scenario: Category kept

- **WHEN** an entry described `Coffee` has the category `bills` and the rule `coffee -> food` exists
- **THEN** after `ledger categorize` the entry still has the category `bills`

#### Scenario: Transfers untouched

- **WHEN** the rule `transfer -> bills` exists and the book holds a transfer
- **THEN** `ledger categorize` prints `Categorized 0 entries` and both transfer entries keep the category `null`
