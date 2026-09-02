# Mermaid Patterns for Architecture Documentation

## Common Diagram Types

### Data Flow Diagram

Data movement through system:

```mermaid
flowchart LR
    Input --> Parser --> Processor --> Output
    Parser -.->|errors| Validator
    Processor <--> Cache
```

### Component Architecture

System components and relationships:

```mermaid
flowchart TB
    subgraph Presentation["Presentation Layer"]
        CLI
        API
    end

    subgraph Business["Business Layer"]
        Service
        UseCase
    end

    subgraph Data["Data Layer"]
        Repository
        Storage
    end

    CLI --> UseCase
    API --> UseCase
    UseCase --> Service
    Service --> Repository
    Repository --> Storage
```

### Algorithm Flow

Decision points and processing steps:

```mermaid
flowchart TD
    Start --> LoadData["Load Data"]
    LoadData --> Decision{valid?}
    Decision -->|yes| Process
    Decision -->|no| ErrorHandler["Error Handler"]
    Process --> Transform
    Transform --> Save
    ErrorHandler --> LogExit["Log & Exit"]
```

### Class Relationships

Inheritance and composition:

```mermaid
classDiagram
    class BaseClass {
        +method1()
        +method2()
    }
    class ChildA {
        +method1()
        +special_a()
    }
    class ChildB {
        +method1()
        +special_b()
    }
    class Processor {
        -strategy
        +execute()
    }

    ChildA --|> BaseClass : inherits
    ChildB --|> BaseClass : inherits
    Processor --> BaseClass : uses
```

### Sequential Process

Step-by-step workflow with phases:

```mermaid
flowchart TB
    subgraph Phase1["Phase 1: Preparation"]
        ParseInput["Parse Input"] --> ValidateSchema["Validate Schema"]
    end

    subgraph Phase2["Phase 2: Processing"]
        TransformData["Transform Data"] --> ApplyRules["Apply Rules"]
    end

    subgraph Phase3["Phase 3: Output"]
        FormatOutput["Format Output"] --> SaveResults["Save Results"]
    end

    ValidateSchema --> TransformData
    ApplyRules --> FormatOutput
```

## Style Guidelines

### Node Shapes

- `["text"]` - Process/component (rectangle)
- `{"text"}` - Decision point (diamond)
- `("text")` - Start/end (rounded/stadium)
- `classDiagram` `class` block - Class/struct with fields
- `[("text")]` - DB/storage (cylinder)
- `[/"text"/]` - File/directory (parallelogram)

### Edge Styles

- `-->` - Standard flow
- `-.->` - Optional/error path
- `-.-` - Weak dependency (no arrowhead)
- `==>` - Primary/critical path

### Common Attributes

```mermaid
flowchart LR
    %% Layout direction: LR (left-right), TB (top-bottom), RL, BT
    A["Node A"] -->|"transforms"| B["Node B"]
    C <--> D

    subgraph Group["Group Label"]
        E --> F
    end
```

### Color Schemes

Apply with `classDef` + `class` assignment:

```mermaid
flowchart LR
    A["Processing"]
    B["Success"]
    C["Error"]
    D["Warning"]

    classDef processing fill:#ADD8E6
    classDef success fill:#90EE90
    classDef error fill:#F08080
    classDef warning fill:#FFFFE0

    class A processing
    class B success
    class C error
    class D warning
```

- `#ADD8E6` (lightblue) - Processing/transformation
- `#90EE90` (lightgreen) - Success/valid state
- `#F08080` (lightcoral) - Error/invalid state
- `#FFFFE0` (lightyellow) - Warning/optional
- `#D3D3D3` (lightgrey) - Grouping/container
