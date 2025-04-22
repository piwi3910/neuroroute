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
│   └── integration/           # Integration tests
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

## API Documentation

Once the server is running, you can access the Swagger documentation at:

```
http://localhost:3000/documentation
```

## License

[MIT](LICENSE)