export const DEFAULT_DIAGRAM = `graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Do something]
    B -->|No| D[Do something else]
    C --> E[End]
    D --> E`

export const EXAMPLE_DIAGRAMS = [
  {
    type: 'flowchart',
    code: `graph TD
    A[Pull Request Opened] --> B{Tests Pass?}
    B -->|No| C[Request Changes]
    C --> D[Author Updates Code]
    D --> B
    B -->|Yes| E[Code Review]
    E --> F{Approved?}
    F -->|No| C
    F -->|Yes| G[Merge to Main]
    G --> H[Deploy to Staging]
    H --> I[Deploy to Production]`,
  },
  {
    type: 'sequence',
    code: `sequenceDiagram
    participant Client
    participant API
    participant Database
    Client->>API: GET /users/123
    API->>Database: Query user by ID
    Database-->>API: User record
    API-->>Client: 200 OK with JSON`,
  },
  {
    type: 'class',
    code: `classDiagram
    class User {
        +String id
        +String email
        +authenticate()
        +logout()
    }
    class Admin {
        +deleteUser()
        +viewAuditLog()
    }
    class Customer {
        +placeOrder()
        +viewOrderHistory()
    }
    User <|-- Admin
    User <|-- Customer`,
  },
  {
    type: 'er',
    code: `erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains
    CUSTOMER }|..|{ DELIVERY-ADDRESS : uses`,
  },
  {
    type: 'state',
    code: `stateDiagram-v2
    [*] --> Pending
    Pending --> Confirmed: Payment Received
    Confirmed --> Shipped: Item Picked
    Shipped --> Delivered: Package Delivered
    Delivered --> [*]
    Pending --> Cancelled: User Cancels
    Cancelled --> [*]`,
  },
]
