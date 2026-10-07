# Diagram recipes

Shapes for the three types that go wrong most often. Copy the shape, replace the nouns.

## Contents

- [Messages over time: sequenceDiagram](#messages-over-time)
- [Lifecycle of one entity: stateDiagram-v2](#lifecycle-of-one-entity)
- [Tables and cardinality: erDiagram](#tables-and-cardinality)

## Messages over time

Draw the reply leg (`-->>`) of every call; a sequence with only requests is a flowchart in disguise. Use `alt` for outcomes, `loop` for retries, and a tinted `rect` for the failure region.

```mermaid
sequenceDiagram
    autonumber
    participant UI as Checkout page
    participant Pay as Payments service
    participant PSP as Card provider
    participant Orders as Orders service

    UI->>Pay: POST /payments
    loop up to 2 retries on timeout
        Pay->>PSP: charge(amount)
    end
    alt approved
        PSP-->>Pay: approved
        Pay->>Orders: mark paid
        Pay-->>UI: 201 Created
    else declined
        rect rgba(179,53,46,0.2)
            PSP-->>Pay: declined
            Pay-->>UI: 402 problem+json
        end
    else still timing out
        rect rgba(138,97,22,0.25)
            Pay->>Orders: mark pending review
            Pay-->>UI: 202 Accepted
        end
    end
```

## Lifecycle of one entity

States are nouns, transitions are events; mark start and end states.

```mermaid
stateDiagram-v2
    [*] --> Draft
    Draft --> InReview: submit
    InReview --> Draft: send back
    InReview --> Approved: approve
    Approved --> Published: publish
    Published --> Archived: archive
    Archived --> [*]
```

## Tables and cardinality

Use the crow's-foot markers for 1:N and N:M; put only the keys and the fields the reader needs.

```mermaid
erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ ORDER_LINE : contains
    PRODUCT ||--o{ ORDER_LINE : "appears in"
    ORDER {
        string id PK
        string customer_id FK
        int total_minor
        string currency
    }
```
