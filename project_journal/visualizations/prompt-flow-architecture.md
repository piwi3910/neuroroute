# NeuroRoute Prompt Flow Architecture

```mermaid
graph TD
    A[Frontend API] --> B[Preprocessor]
    B --> C[Classifier]
    C --> D[Routing Engine]
    D --> E[Normalization Engine]
    E --> F[Backend API]
    
    subgraph Preprocessor
        B1[Sanitization]
        B2[Prompt Compression]
        B3[Prompt Replacement]
    end
    
    subgraph Classifier
        C1[Rules-based Classifier]
        C2[Future: ML-based Classifier]
    end
    
    subgraph "Routing Engine"
        D1[Rules-based Routing]
        D2[Future: Latency-based Routing]
        D3[Future: Cost-based Routing]
        D4[Future: Preferred Model Routing]
    end
    
    subgraph "Normalization Engine"
        E1[Format Conversion]
        E2[Model-specific Adaptation]
    end
    
    B --> B1 --> B2 --> B3
    C --> C1
    D --> D1
    E --> E1 --> E2
```

## Flow Description

1. **Frontend API**: The entry point for all prompt requests
2. **Preprocessor**: Handles initial prompt processing
   - Sanitization: Removes harmful content, normalizes text
   - Prompt Compression: Reduces prompt size if needed
   - Prompt Replacement: Substitutes tokens or patterns
3. **Classifier**: Analyzes the prompt to determine its characteristics
   - Currently uses a rules-based classifier
   - Future: Could use ML-based classification
4. **Routing Engine**: Determines which model/backend to use
   - Currently uses rules-based routing
   - Future: Could consider latency, cost, or user preferences
5. **Normalization Engine**: Prepares the prompt for the selected backend
   - Format Conversion: Adapts to backend-specific formats
   - Model-specific Adaptation: Adjusts prompts for specific models
6. **Backend API**: The actual LLM service (OpenAI, Anthropic, etc.)