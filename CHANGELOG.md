# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2025-04-24

### Added

- **Flow Architecture**: Implemented a modular pipeline-based system for prompt processing
  - **Preprocessor**: Added service for initial prompt processing with plugin architecture
    - Sanitization processor for removing harmful content
    - Compression processor for reducing prompt size
    - Replacement processor for substituting tokens or patterns
  - **Classifier**: Added service for analyzing prompts with plugin architecture
    - Rules-based classifier for determining prompt intent, complexity, and features
    - ML-based classifier scaffold for future implementation
  - **Routing Engine**: Added service for selecting the appropriate model
    - Rules-based routing strategy
    - Future support for latency-based, cost-based, and preferred model routing
  - **Normalization Engine**: Added service for preparing prompts for specific backends
    - Format conversion for backend-specific formats
    - Model-specific adaptations
- **Documentation**: Added comprehensive flow architecture guide
- **Testing**: Added unit and integration tests for flow architecture components
- **Scripts**: Added test scripts for API flow architecture

### Fixed

- TypeScript errors in preprocessor service
- ESM import issues in app.ts
- Server port binding issues

### Changed

- Refactored prompt route to use the new flow architecture
- Updated error handling to support flow architecture
- Improved test setup for integration tests

## [0.1.0] - 2025-04-22

### Added

- Initial project setup with Fastify
- Basic API endpoints for health, chat, and prompt
- Model adapters for OpenAI, Anthropic, and LMStudio
- Authentication and authorization
- Configuration management
- Error handling
- Logging
- Documentation