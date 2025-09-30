# Bank Statement to FIRS Architecture

## System Overview

This document describes the architecture for processing bank statement Excel files and submitting transaction data to the FIRS service through RabbitMQ message queues.

## Architecture Diagram

```mermaid
graph TB
    subgraph "Client Layer"
        Client[Client/User]
    end

    subgraph "API Layer"
        Controller[BankStatementController<br/>POST /bank-statement/upload]
    end

    subgraph "Service Layer"
        BankService[BankStatementService]
        FileProcessor[FileProcessorService]
        RowProcessor[RowProcessorService]
        FirsService[FirsService]
    end

    subgraph "Infrastructure Layer"
        Supabase[(Supabase Storage<br/>FIRS-QBO Bucket)]
        RabbitMQ[RabbitMQService]
        FIRS[FIRS API<br/>External Service]
    end

    subgraph "Message Queues"
        FileQueue{{bank-statement-files<br/>Queue}}
        RowQueue{{bank-statement-rows<br/>Queue}}
    end

    Client -->|1. Upload Excel File| Controller
    Controller -->|2. Process Upload| BankService
    BankService -->|3. Upload File| Supabase
    Supabase -->|4. Return File URL| BankService
    BankService -->|5. Publish File Message| RabbitMQ
    RabbitMQ -->|6. Queue Message| FileQueue

    FileQueue -->|7. Consume| FileProcessor
    FileProcessor -->|8. Download & Parse Excel| Supabase
    FileProcessor -->|9. Publish Row Messages| RabbitMQ
    RabbitMQ -->|10. Queue Messages| RowQueue

    RowQueue -->|11. Consume| RowProcessor
    RowProcessor -->|12. Transform & Submit| FirsService
    FirsService -->|13. HTTP POST| FIRS
    FIRS -->|14. Response| FirsService

    style Client fill:#e1f5ff
    style Controller fill:#fff4e1
    style BankService fill:#fff4e1
    style FileProcessor fill:#e8f5e9
    style RowProcessor fill:#e8f5e9
    style FirsService fill:#f3e5f5
    style Supabase fill:#fce4ec
    style RabbitMQ fill:#fff9c4
    style FIRS fill:#ffebee
    style FileQueue fill:#fff9c4
    style RowQueue fill:#fff9c4
```

## Component Diagram

```mermaid
classDiagram
    class BankStatementController {
        +uploadBankStatement(file, companyId)
        -bankStatementService
    }

    class BankStatementService {
        +uploadBankStatement(file, companyId)
        -supabaseService
        -rabbitMQService
    }

    class FileProcessorService {
        +onModuleInit()
        -processFile(message)
        -downloadFile(url)
        -rabbitMQService
    }

    class RowProcessorService {
        +onModuleInit()
        -processRow(message)
        -shouldProcessRow(row)
        -sendToFirs(message)
        -rabbitMQService
        -firsService
    }

    class RabbitMQService {
        +connect()
        +disconnect()
        +publish(queue, message)
        +consume(queue, callback)
        +waitForConnection()
        -connection
        -channel
    }

    class SupabaseService {
        +uploadFile(buffer, fileName, bucket, contentType)
        +uploadQRCode(buffer, fileName)
        -supabase
    }

    class FirsService {
        +submitInvoice(invoiceData, companyConfig)
        +updateInvoice(invoiceData, irn, companyConfig)
        +getEntity(entityId)
        -httpClient
    }

    BankStatementController --> BankStatementService
    BankStatementService --> SupabaseService
    BankStatementService --> RabbitMQService
    FileProcessorService --> RabbitMQService
    RowProcessorService --> RabbitMQService
    RowProcessorService --> FirsService
```

## Sequence Diagram

```mermaid
sequenceDiagram
    actor User
    participant Controller as BankStatementController
    participant Service as BankStatementService
    participant Supabase as SupabaseService
    participant RMQ as RabbitMQService
    participant FileQ as bank-statement-files
    participant FileProc as FileProcessorService
    participant RowQ as bank-statement-rows
    participant RowProc as RowProcessorService
    participant FIRS as FirsService

    User->>Controller: POST /bank-statement/upload<br/>(Excel File)
    Controller->>Service: uploadBankStatement(file, companyId)
    Service->>Supabase: uploadFile(buffer, fileName)
    Supabase-->>Service: fileUrl

    Service->>RMQ: publish('bank-statement-files', message)
    RMQ->>FileQ: enqueue message
    Service-->>Controller: {fileUrl, message}
    Controller-->>User: 200 OK

    Note over FileProc,FileQ: Background Processing
    FileQ->>FileProc: consume message
    FileProc->>Supabase: downloadFile(fileUrl)
    Supabase-->>FileProc: file buffer
    FileProc->>FileProc: parse Excel (XLSX.read)

    loop For each row
        FileProc->>RMQ: publish('bank-statement-rows', rowMessage)
        RMQ->>RowQ: enqueue row message
    end

    Note over RowProc,RowQ: Row Processing
    loop For each queued row
        RowQ->>RowProc: consume row message
        RowProc->>RowProc: shouldProcessRow(row)
        alt Row is valid
            RowProc->>FIRS: sendToFirs(message)
            FIRS->>FIRS: transformRowToInvoice()
            FIRS-->>RowProc: success/failure
        else Row is invalid
            RowProc->>RowProc: log & skip
        end
    end
```

## Data Flow

```mermaid
flowchart LR
    A[Excel File Upload] --> B[Supabase Storage]
    B --> C{File URL}
    C --> D[bank-statement-files Queue]
    D --> E[File Parser]
    E --> F{Row Data}
    F --> G[bank-statement-rows Queue]
    G --> H[Row Validator]
    H --> I{Valid?}
    I -->|Yes| J[Transform to Invoice]
    I -->|No| K[Skip & Log]
    J --> L[FIRS API]
    L --> M[Response]

    style A fill:#e1f5ff
    style B fill:#fce4ec
    style D fill:#fff9c4
    style E fill:#e8f5e9
    style G fill:#fff9c4
    style H fill:#e8f5e9
    style J fill:#f3e5f5
    style L fill:#ffebee
```

## Message Types

```mermaid
classDiagram
    class BankStatementFileMessage {
        +string fileUrl
        +string fileName
        +string companyId
        +string uploadedAt
    }

    class BankStatementRow {
        +string date
        +string description
        +number amount
        +number balance
        +string reference
    }

    class BankStatementRowMessage {
        +BankStatementRow row
        +number rowNumber
        +string fileName
        +string fileUrl
        +string companyId
    }

    BankStatementRowMessage --> BankStatementRow
```

## Key Components

### 1. **BankStatementController**
- **Endpoint**: `POST /bank-statement/upload`
- **Responsibilities**:
  - Accept file uploads
  - Validate file type (Excel: .xls, .xlsx)
  - Delegate to service layer

### 2. **BankStatementService**
- **Responsibilities**:
  - Upload files to Supabase storage
  - Publish file metadata to RabbitMQ
  - Return upload confirmation

### 3. **FileProcessorService**
- **Queue**: Consumes from `bank-statement-files`
- **Responsibilities**:
  - Download Excel files from Supabase
  - Parse Excel using XLSX library
  - Split into individual rows
  - Publish rows to row processing queue

### 4. **RowProcessorService**
- **Queue**: Consumes from `bank-statement-rows`
- **Responsibilities**:
  - Validate row data
  - Transform to invoice format
  - Submit to FIRS service
  - Handle errors and retries

### 5. **RabbitMQService**
- **Responsibilities**:
  - Manage RabbitMQ connection
  - Publish messages to queues
  - Setup consumers with callbacks
  - Handle connection retries

### 6. **FirsService**
- **Responsibilities**:
  - Transform data to FIRS invoice format
  - Submit invoices to FIRS API
  - Handle FIRS API responses

## Queue Configuration

| Queue Name | Consumer | Message Type | Durability |
|------------|----------|--------------|------------|
| `bank-statement-files` | FileProcessorService | BankStatementFileMessage | Durable |
| `bank-statement-rows` | RowProcessorService | BankStatementRowMessage | Durable |

## Error Handling

```mermaid
flowchart TD
    A[Message Received] --> B{Processing Success?}
    B -->|Success| C[ACK Message]
    B -->|Failure| D[Log Error]
    D --> E[NACK Message<br/>no requeue]

    style C fill:#e8f5e9
    style E fill:#ffebee
```

- **Success**: Message is acknowledged (ACK)
- **Failure**: Message is not acknowledged (NACK) without requeue to prevent infinite loops
- All errors are logged for monitoring

## Environment Variables

```env
RABBITMQ_URL=amqp://localhost:5672
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
FIRS_API_BASE_URL=https://api.firs.gov.ng
```

## Scalability Considerations

1. **Horizontal Scaling**: Multiple instances can consume from the same queues
2. **Queue Durability**: Messages persist if RabbitMQ crashes
3. **Prefetch**: Set to 1 for fair distribution across consumers
4. **Asynchronous**: File upload returns immediately, processing happens in background

## Future Enhancements

- Dead Letter Queue (DLQ) for failed messages
- Message TTL for automatic cleanup
- Priority queues for urgent processing
- Metrics and monitoring integration
- Retry logic with exponential backoff