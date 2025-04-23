# Router Service

This service is responsible for routing incoming prompts to the appropriate language model and normalizing the prompts for the selected model. It has been refactored into two main components: the Routing Engine and the Normalization Engine, following the new flow architecture.

## Architecture

The router service now consists of:

- **Routing Engine**: Selects the best model based on prompt classification and various routing strategies (rules-based, latency, cost, etc.).
- **Normalization Engine**: Prepares the prompt for the selected model, including format conversion and model-specific adaptations.

Both engines use a registry pattern to allow for pluggable implementations of routing strategies and normalizers.

```mermaid
graph TD
    A[Prompt] --> B[Classification Result]
    B --> C[Routing Engine]
    C --> D[Routing Result (Model ID)]
    D --> E[Normalization Engine]
    E --> F[Normalized Prompt]
    F --> G[Model Adapter]
    G --> H[Model Response]
```

## Components

### Routing Engine

- **`src/services/router/routing/index.ts`**: Main entry point for the Routing Engine.
- **`src/services/router/routing/registry.ts`**: Registry for managing routing strategies.
- **`src/services/router/routing/strategies/`**: Directory containing different routing strategy implementations.
    - **`rules-based.ts`**: The default strategy, based on prompt classification rules.
    - **`latency.ts`**: Placeholder for a latency-based strategy.
    - **`cost.ts`**: Placeholder for a cost-based strategy.

### Normalization Engine

- **`src/services/router/normalization/index.ts`**: Main entry point for the Normalization Engine.
- **`src/services/router/normalization/registry.ts`**: Registry for managing normalizers.
- **`src/services/router/normalization/normalizers/`**: Directory containing different normalizer implementations.
    - **`openai.ts`**: Placeholder for an OpenAI normalizer.
    - **`anthropic.ts`**: Placeholder for an Anthropic normalizer.
    - **`lmstudio.ts`**: Placeholder for an LMStudio normalizer.

## Interfaces

Key interfaces are defined in `src/services/router/interfaces.ts`:

- `RoutingStrategy`: Defines the interface for routing strategy plugins.
- `RoutingOptions`: Defines options that can influence routing decisions.
- `RoutingResult`: Defines the result of a routing operation.
- `Normalizer`: Defines the interface for normalizer plugins.
- `NormalizationOptions`: Defines options that can influence normalization.
- `RoutingEngine`: Defines the interface for the Routing Engine.
- `NormalizationEngine`: Defines the interface for the Normalization Engine.
- `RouterService`: Defines the interface for the refactored main Router Service.
- `RouterResponse`: Defines the standard response format for prompt routing.
- `ChatCompletionResponse`: Defines the response format for chat completions.

## How to Add New Strategies or Normalizers

To add a new routing strategy or normalizer:

1.  Create a new file in the `src/services/router/routing/strategies/` or `src/services/router/normalization/normalizers/` directory, respectively.
2.  Implement the `RoutingStrategy` or `Normalizer` interface.
3.  Export a function to create an instance of your new strategy or normalizer.
4.  Register your new strategy or normalizer in the corresponding registry (`src/services/router/routing/index.ts` for strategies, `src/services/router/normalization/index.ts` for normalizers).

## Error Handling

Error handling should be implemented within each component and propagated up the call stack. Specific error types should be used where appropriate.

## Logging

Detailed logging should be added throughout the components to provide visibility into the routing and normalization process.

## Unit Tests

Unit tests should be created for each component and individual strategy/normalizer implementations to ensure correctness and cover edge cases.