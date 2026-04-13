# Graphviz Patterns for Architecture Documentation

## Common Diagram Types

### Data Flow Diagram

Data movement through system:

```dot
digraph data_flow {
    rankdir=LR;
    node [shape=box];

    "Input" -> "Parser" -> "Processor" -> "Output";
    "Parser" -> "Validator" [style=dashed, label="errors"];
    "Processor" -> "Cache" [dir=both];
}
```

### Component Architecture

System components and relationships:

```dot
digraph architecture {
    node [shape=component];

    subgraph cluster_presentation {
        label="Presentation Layer";
        "CLI" "API";
    }

    subgraph cluster_business {
        label="Business Layer";
        "Service" "UseCase";
    }

    subgraph cluster_data {
        label="Data Layer";
        "Repository" "Storage";
    }

    "CLI" -> "UseCase";
    "API" -> "UseCase";
    "UseCase" -> "Service";
    "Service" -> "Repository";
    "Repository" -> "Storage";
}
```

### Algorithm Flow

Decision points and processing steps:

```dot
digraph algorithm {
    node [shape=box];
    decision [shape=diamond];

    "Start" -> "Load Data";
    "Load Data" -> decision [label="valid?"];
    decision -> "Process" [label="yes"];
    decision -> "Error Handler" [label="no"];
    "Process" -> "Transform";
    "Transform" -> "Save";
    "Error Handler" -> "Log & Exit";
}
```

### Class Relationships

Inheritance and composition:

```dot
digraph classes {
    node [shape=record];

    Base [label="{BaseClass|+ method1()\l+ method2()\l}"];
    Child1 [label="{ChildA|+ method1()\l+ special_a()\l}"];
    Child2 [label="{ChildB|+ method1()\l+ special_b()\l}"];

    Child1 -> Base [arrowhead=empty, label="inherits"];
    Child2 -> Base [arrowhead=empty, label="inherits"];

    Processor [label="{Processor|- strategy\l|+ execute()\l}"];
    Processor -> Base [arrowhead=diamond, label="uses"];
}
```

### Sequential Process

Step-by-step workflow:

```dot
digraph workflow {
    rankdir=TB;
    node [shape=box];

    subgraph cluster_phase1 {
        label="Phase 1: Preparation";
        style=filled;
        color=lightgrey;
        "Parse Input" -> "Validate Schema";
    }

    subgraph cluster_phase2 {
        label="Phase 2: Processing";
        style=filled;
        color=lightgrey;
        "Transform Data" -> "Apply Rules";
    }

    subgraph cluster_phase3 {
        label="Phase 3: Output";
        style=filled;
        color=lightgrey;
        "Format Output" -> "Save Results";
    }

    "Validate Schema" -> "Transform Data";
    "Apply Rules" -> "Format Output";
}
```

## Style Guidelines

### Node Shapes

- `box` - Process/component
- `diamond` - Decision point
- `ellipse` - Start/end
- `record` - Class/struct with fields
- `component` - System component
- `cylinder` - DB/storage
- `folder` - File/directory

### Edge Styles

- `solid` - Standard flow
- `dashed` - Optional/error path
- `dotted` - Weak dependency
- `bold` - Primary/critical path

### Common Attributes

```dot
// Layout
rankdir=LR  // Left to right (default TB: top to bottom)

// Node styling
node [shape=box, style=filled, fillcolor=lightblue]

// Edge labels
"A" -> "B" [label="transforms"]

// Bidirectional
"A" -> "B" [dir=both]

// Subgraphs/clusters
subgraph cluster_name {
    label="Group Label";
    style=filled;
    color=lightgrey;
    "Node1" -> "Node2";
}
```

### Color Schemes

- `lightblue` - Processing/transformation
- `lightgreen` - Success/valid state
- `lightcoral` - Error/invalid state
- `lightyellow` - Warning/optional
- `lightgrey` - Grouping/container