# ADR: Flow Architecture for Prompt Processing

**Status:** Accepted

**Date:** 2025-04-23

## Context

The NeuroRoute API currently processes prompts through a simple flow:
1. Prompt arrives at Frontend API
2. Router service classifies the prompt
3. Router service selects a model
4. Router service sends the prompt to the selected model

This approach lacks modularity and extensibility. As we plan to add more sophisticated preprocessing, classification, routing, and normalization capabilities, we need a more flexible architecture.

## Decision

We will implement a pipeline-based flow architecture with the following components:

1. **Frontend API**: Entry point for all prompt requests
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

Each component will be designed with a plugin architecture to allow for easy extension and customization.

## Rationale

This architecture provides several benefits:

1. **Modularity**: Each component has a clear, single responsibility
2. **Extensibility**: New preprocessors, classifiers, routing strategies, and normalizers can be added without modifying existing code
3. **Testability**: Each component can be tested in isolation
4. **Flexibility**: Different components can be swapped in and out based on requirements
5. **Future-proofing**: The architecture can accommodate new features and requirements as they arise

## Consequences

### Positive

- Improved code organization and maintainability
- Easier to add new features and capabilities
- Better separation of concerns
- More flexible routing and model selection
- Improved testability

### Negative

- Increased complexity compared to the current approach
- More files and interfaces to manage
- Potential performance overhead from the additional abstraction layers

### Neutral

- Requires refactoring existing code
- Developers will need to understand the new architecture

## Implementation Plan

The implementation will follow the plan outlined in `project_journal/planning/flow-implementation-plan.md`, with a phased approach:

1. Create the basic structure for each component
2. Implement the core functionality
3. Add tests and documentation
4. Refine and optimize

## References

- [Flow Architecture Diagram](../visualizations/prompt-flow-architecture.md)
- [Implementation Plan](../planning/flow-implementation-plan.md)