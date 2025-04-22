# NeuroRoute API v0.1.0

## Initial Release

This is the initial release of the NeuroRoute API, a powerful routing service for AI models. This release includes the complete migration from FastAPI to Fastify, along with numerous improvements and new features.

### Key Features

- **Model Routing**: Intelligent routing between different AI models based on prompt classification
- **Caching**: Advanced caching system for improved performance
- **Fallback Mechanism**: Automatic fallback to alternative models when primary models are unavailable
- **Model Chaining**: Sequential processing of prompts through multiple models for enhanced results
- **Admin API**: Comprehensive admin interface for configuration and monitoring
- **Metrics & Monitoring**: Detailed metrics and monitoring capabilities
- **Database Integration**: Prisma ORM for database operations
- **Authentication**: JWT-based authentication for secure API access
- **Rate Limiting**: Configurable rate limiting to prevent abuse
- **Swagger Documentation**: Interactive API documentation

### Supported Models

- **OpenAI**: GPT-4.1
- **Anthropic**: Claude 3.7 Sonnet
- **Local**: LM Studio integration for local model inference

### Technical Improvements

- **Fastify Migration**: Complete rewrite from FastAPI (Python) to Fastify (Node.js/TypeScript)
- **ESM Support**: Full support for ECMAScript modules
- **TypeScript**: Strong typing throughout the codebase
- **Testing**: Comprehensive unit and integration tests
- **Error Handling**: Improved error handling and reporting
- **Performance**: Significant performance improvements
- **Documentation**: Extensive documentation for developers and administrators

### Breaking Changes

- Complete API rewrite from Python to TypeScript
- New authentication mechanism
- Updated configuration format
- New database schema

### Installation

See the [README.md](./neuroroute-api/README.md) for installation instructions.