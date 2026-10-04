---
name: data-modeling
description: Relational data modeling choices - entities from use cases, constraints in the database, justified denormalisation, expand-and-contract migrations. Use when designing a schema, adding tables or columns, or planning a database migration.
license: MIT
---

# Data modeling

Applications come and go, but the data stays. A schema that does not enforce its own rules collects bad rows from every code path that forgot one. A migration that changes a live table in one step breaks the running code. This skill fixes both: rules in the database, changes in deployable phases.

## 1. Start from the use cases

- List the use cases that read and write the data, with the query each one needs: "list a customer's open orders, newest first", "sum paid orders per day".
- Derive entities and relationships from them. An entity is something with its own identity and lifecycle; an attribute is a fact about an entity.
- State each relationship's cardinality and optionality in words: "an order has one or more lines; a line belongs to exactly one order".

## 2. Put the rules in the schema

Every rule the data must always obey is a constraint, not only application code:

| Rule                                       | Constraint                                                                                                |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| A value is always present                  | `NOT NULL` (the default for every column; allow null only with a reason)                                  |
| A value is unique, alone or in combination | `UNIQUE`, or a unique index; partial (`WHERE deleted_at IS NULL`) when needed                             |
| A value comes from a small fixed set       | `CHECK (status IN ('draft', 'placed', 'paid'))`, or a lookup table when the set changes or has attributes |
| A range or relation between columns        | `CHECK (quantity > 0)`, `CHECK (ends_at > starts_at)`                                                     |
| A reference to another row                 | `FOREIGN KEY` with an explicit `ON DELETE` (`RESTRICT` by default, `CASCADE` only for owned children)     |

## 3. Choose the types

- Primary keys: a surrogate key (`bigint` identity, or a UUID when ids are created outside the database or must not be guessable). Natural keys (an email, a SKU) get a `UNIQUE` constraint, not the primary key, because they change.
- Money: `numeric(p, s)` or an integer in minor units, plus a currency column. Never a floating-point type.
- Time: a time-zone-aware timestamp (`timestamptz` in PostgreSQL), stored in UTC. A date without a time is a `date`.
- Text: `text` or `varchar` with a `CHECK` on length when the domain has a limit.
- Every table gets `created_at` and, when rows change, `updated_at`.

## 4. Normalise, then denormalise on purpose

- Model to third normal form first: every non-key column depends on the key, the whole key and nothing but the key.
- Denormalise only for a measured read problem, and write the justification next to it: which query, which cost, and how the copy is kept in sync (a trigger, the same transaction, or an accepted delay).
- Keep history explicitly: a price on an order line is copied at the time of the order, because the product price changes later. That is a fact about the line, not denormalisation.
- Prefer a status column and an archive table to soft deletes everywhere. A `deleted_at` column must then appear in every unique index and every query.

## 5. Index for the queries

- Every foreign key column gets an index, unless the table is tiny.
- Each use-case query from step 1 gets an index that serves its filter and its order: `(customer_id, created_at DESC)` for "a customer's orders, newest first".
- Do not add an index without a query that needs it; each one slows every write.

## 6. Migrate live tables with expand and contract

Never change a column in place while the old code is running. Split every breaking change into phases, each a separate deployable migration, with the application deployed between them:

1. **Expand:** add the new column or table, nullable or with a default. Old code keeps working.
2. **Dual write:** deploy code that writes both the old and the new shape.
3. **Backfill:** copy the existing rows to the new shape, in batches, outside one long transaction.
4. **Switch reads:** deploy code that reads the new shape. Add the `NOT NULL` and other constraints now, validated against the backfilled data.
5. **Contract:** deploy code that stops writing the old shape, then drop the old column in a later migration.

A rename is expand and contract too: add the new column, copy, switch, drop. Each phase can be rolled back without losing data.

## The output

Deliver the schema as DDL, then a note:

```text
Model note
Use cases -> queries: <each use case with its query and the index that serves it>
Constraints: <each business rule and the constraint that enforces it>
Denormalised: <column> - <query it serves> - kept in sync by <mechanism>   (or: none)
Migration phases: 1 expand ... 5 contract   (for a change to a live table)
```

## Anti-patterns

- Nullable by default.
- Status as a free `varchar` with no `CHECK`.
- Foreign keys left out "for performance".
- Floating-point money; local-time timestamps.
- Generic `entity`, `attribute`, `value` tables (EAV) instead of a schema.
- One migration that renames a column the running code still reads.
