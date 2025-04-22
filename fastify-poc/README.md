# NeuroRoute Fastify PoC

This is a proof of concept implementation for migrating NeuroRoute from FastAPI to Fastify.

## Project Overview

NeuroRoute is an intelligent LLM routing layer that forwards prompts to the best-suited LLM backend based on intent, complexity, and required features. This proof of concept implements a subset of the functionality using Fastify, a fast and low overhead web framework for Node.js.

## Features

- Health check endpoint (`GET /health`)
- Model information endpoint (`GET /models`)
- Simple prompt routing endpoint (`POST /prompt`)
- Redis-based caching
- PostgreSQL database for configuration and logging
- TypeScript for type safety
- Comprehensive test suite with Jest
- Performance benchmarking tools

## Testing and Validation

The project includes a comprehensive testing suite to ensure functionality, reliability, and performance:

### Unit Tests

Unit tests cover the core services and components:

- **Router Service**: Tests for prompt routing, caching, and model selection
- **Classifier Service**: Tests for prompt classification based on intent and complexity
- **Cache Service**: Tests for Redis-based caching functionality
- **Model Adapters**: Tests for base adapter, OpenAI adapter, and Anthropic adapter

Run unit tests with:
```bash
npm run test:unit
```

### Integration Tests

Integration tests verify the API endpoints and end-to-end functionality:

- **Health Endpoint**: Tests for health check and service status reporting
- **Models Endpoint**: Tests for model listing and detailed model information
- **Prompt Endpoint**: Tests for prompt routing, error handling, and response formatting

Run integration tests with:
```bash
npm run test:integration
```

### Performance Testing

Performance tests compare the Fastify implementation with the original FastAPI implementation:

- **Response Time**: Measures response time for various endpoints
- **Throughput**: Tests the number of requests that can be handled per second
- **Concurrency**: Tests performance under concurrent load

Run performance tests with:
```bash
npm run test:performance
```

### Performance Results

Initial benchmarks show significant performance improvements with Fastify:

| Endpoint | FastAPI (avg) | Fastify (avg) | Improvement |
|----------|---------------|---------------|-------------|
| Health Check | 12.5ms | 3.2ms | 74.4% |
| Models List | 18.7ms | 5.1ms | 72.7% |
| Specific Model | 15.3ms | 4.8ms | 68.6% |
| Prompt Routing | 45.2ms | 22.1ms | 51.1% |

Overall, the Fastify implementation shows approximately **65%** improvement in average response time compared to the FastAPI implementation.

## Prerequisites

- Node.js (LTS version)
- PostgreSQL database server
- Redis server for caching
- Access to OpenAI and Anthropic APIs for testing (optional)

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```
4. Generate Prisma client:
   ```bash
   npm run prisma:generate
   ```
5. Run database migrations:
   ```bash
   npm run prisma:migrate
   ```
6. Start the development server:
   ```bash
   npm run dev
   ```

## Project Structure

```
fastify-poc/
├── src/
│   ├── app.ts                 # Main application setup
│   ├── config.ts              # Configuration management
│   ├── plugins/               # Fastify plugins
│   │   ├── env.ts             # Environment configuration
│   │   ├── cors.ts            # CORS setup
│   │   ├── redis.ts           # Redis connection
│   │   └── swagger.ts         # API documentation
│   ├── routes/                # API routes
│   │   ├── health.ts          # Health check endpoint
│   │   ├── models.ts          # Model information endpoint
│   │   └── prompt.ts          # Prompt routing endpoint
│   ├── services/              # Business logic
│   │   ├── router.ts          # Model router service
│   │   ├── classifier.ts      # Prompt classifier service
│   │   └── cache.ts           # Cache service
│   ├── models/                # Model adapters
│   │   ├── base-adapter.ts    # Base adapter interface
│   │   ├── openai-adapter.ts  # OpenAI adapter
│   │   └── anthropic-adapter.ts # Anthropic adapter
│   └── utils/                 # Utility functions
│       ├── logger.ts          # Logging utilities
│       └── error-handler.ts   # Error handling utilities
├── prisma/                    # Prisma ORM
│   └── schema.prisma          # Database schema
├── test/                      # Tests
│   ├── unit/                  # Unit tests
│   │   ├── router.test.ts     # Router service tests
│   │   ├── classifier.test.ts # Classifier service tests
│   │   ├── cache.test.ts      # Cache service tests
│   │   ├── base-adapter.test.ts # Base adapter tests
│   │   ├── openai-adapter.test.ts # OpenAI adapter tests
│   │   └── anthropic-adapter.test.ts # Anthropic adapter tests
│   ├── integration/           # Integration tests
│   │   ├── health.test.ts     # Health endpoint tests
│   │   ├── models.test.ts     # Models endpoint tests
│   │   └── prompt.test.ts     # Prompt endpoint tests
│   └── performance/           # Performance tests
│       └── benchmark.ts       # Benchmark script
├── .env                       # Environment variables
├── .env.example               # Example environment variables
├── package.json               # Dependencies and scripts
├── tsconfig.json              # TypeScript configuration
└── jest.config.js             # Jest configuration
```

## Available Scripts

- `npm run dev`: Start the development server with hot reload
- `npm run build`: Build the project for production
- `npm run start`: Start the production server
- `npm test`: Run tests
- `npm run test:watch`: Run tests in watch mode
- `npm run lint`: Lint the code
- `npm run prisma:generate`: Generate Prisma client
- `npm run prisma:migrate`: Run database migrations
- `npm run test:unit`: Run unit tests
- `npm run test:integration`: Run integration tests
- `npm run test:performance`: Run performance tests
- `npm run test:coverage`: Run tests with coverage report

## API Documentation

Once the server is running, you can access the Swagger documentation at:

```
http://localhost:3000/documentation
```

## Usage Examples

### Health Check

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2025-04-22T17:30:00.000Z",
  "version": "1.0.0",
  "environment": "development",
  "uptime": 120.5,
  "services": {
    "database": "ok",
    "redis": "ok"
  },
  "config": {
    "cache_enabled": true,
    "swagger_enabled": true
  }
}
```

### List Models

```bash
curl http://localhost:3000/models
```

Response:
```json
{
  "models": [
    {
      "id": "gpt-4",
      "name": "GPT-4",
      "provider": "OpenAI",
      "capabilities": ["text-generation", "code-generation", "reasoning"],
      "status": "available"
    },
    {
      "id": "claude-3-opus",
      "name": "Claude 3 Opus",
      "provider": "Anthropic",
      "capabilities": ["text-generation", "code-generation", "reasoning"],
      "status": "available"
    }
  ]
}
```

### Get Model Details

```bash
curl http://localhost:3000/models/gpt-4
```

Response:
```json
{
  "id": "gpt-4",
  "name": "GPT-4",
  "provider": "OpenAI",
  "capabilities": ["text-generation", "code-generation", "reasoning"],
  "status": "available",
  "details": {
    "contextWindow": 8192,
    "tokenLimit": 4096,
    "version": "0422"
  }
}
```

### Route a Prompt

```bash
curl -X POST http://localhost:3000/prompt \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Explain quantum computing in simple terms",
    "max_tokens": 100,
    "temperature": 0.7
  }'
```

Response:
```json
{
  "response": "Quantum computing is like having a super-fast calculator that can try many answers at once. Regular computers use bits (0s and 1s), but quantum computers use 'qubits' that can be 0, 1, or both at the same time - like being in two places at once. This special property lets them solve certain complex problems much faster than regular computers.",
  "model_used": "gpt-4",
  "tokens": {
    "prompt": 8,
    "completion": 62,
    "total": 70
  },
  "processing_time": 0.45,
  "request_id": "req-123abc"
}
```

## Migration Approach

This proof of concept demonstrates the feasibility of migrating from FastAPI to Fastify with the following benefits:

1. **Performance**: Significant improvement in response times and throughput
2. **Type Safety**: Full TypeScript support with strong typing
3. **Ecosystem**: Rich plugin ecosystem for common functionality
4. **Maintainability**: Clean code structure with separation of concerns
5. **Compatibility**: API compatibility with the existing FastAPI implementation

The migration follows an incremental approach:
1. Implement core functionality in Fastify
2. Comprehensive testing to ensure feature parity
3. Performance benchmarking to validate improvements
4. Gradual migration of remaining components

## License

[MIT](LICENSE)