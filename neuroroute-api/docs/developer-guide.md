# NeuroRoute Developer Guide

## Table of Contents

1. [Introduction](#introduction)
2. [Architecture Overview](#architecture-overview)
3. [Getting Started](#getting-started)
4. [Project Structure](#project-structure)
5. [Core Components](#core-components)
6. [API Endpoints](#api-endpoints)
7. [Configuration](#configuration)
8. [Deployment](#deployment)
9. [Monitoring and Logging](#monitoring-and-logging)
10. [Performance Optimization](#performance-optimization)
11. [Troubleshooting](#troubleshooting)
12. [Contributing](#contributing)

## Introduction

NeuroRoute is an intelligent routing system for LLM requests, directing prompts to the most appropriate model based on content analysis. This developer guide provides comprehensive information about the Fastify implementation, including architecture, setup, deployment, and best practices.

## Architecture Overview

NeuroRoute follows a plugin-based architecture using Fastify, with the following key components:

- **Core Server**: The main Fastify application that handles HTTP requests
- **Plugins**: Modular components that extend the server's functionality
- **Routes**: API endpoints for different features
- **Services**: Business logic for routing, classification, and caching
- **Models**: Adapters for different LLM providers
- **Database**: PostgreSQL for persistent storage
- **Cache**: Redis for response caching and performance optimization

### System Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│  NeuroRoute │────▶│  LLM APIs   │
│  Requests   │     │    Server   │     │ (OpenAI,    │
└─────────────┘     └──────┬──────┘     │ Anthropic,  │
                           │            │ etc.)       │
                           │            └─────────────┘
                    ┌──────▼──────┐
                    │   Services  │
                    │ - Router    │
                    │ - Classifier│
                    │ - Cache     │
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              │                         │
     ┌────────▼─────────┐     ┌─────────▼────────┐
     │    PostgreSQL    │     │       Redis      │
     │  - Configuration │     │  - Response Cache│
     │  - API Keys      │     │  - Rate Limiting │
     │  - Usage Stats   │     │                  │
     └──────────────────┘     └──────────────────┘
```

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- PostgreSQL (v15 or later)
- Redis (v7 or later)
- Docker and Docker Compose (for containerized deployment)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/neuroroute.git
   cd neuroroute/neuroroute-api
   ```

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
   npx prisma generate
   ```

5. Run database migrations:
   ```bash
   npx prisma migrate deploy
   ```

6. Start the development server:
   ```bash
   npm run dev
   ```

## Project Structure

```
neuroroute-api/
├── src/                  # Source code
│   ├── app.ts            # Main application setup
│   ├── config.ts         # Configuration management
│   ├── plugins/          # Fastify plugins
│   │   ├── auth.ts       # Authentication plugin
│   │   ├── cors.ts       # CORS plugin
│   │   ├── env.ts        # Environment configuration
│   │   ├── redis.ts      # Redis connection
│   │   ├── swagger.ts    # API documentation
│   │   ├── monitoring.ts # Monitoring and metrics
│   │   ├── rate-limit.ts # Rate limiting
│   │   └── db-optimizer.ts # Database optimization
│   ├── routes/           # API routes
│   │   ├── health.ts     # Health check endpoint
│   │   ├── models.ts     # Model information endpoint
│   │   ├── prompt.ts     # Prompt routing endpoint
│   │   ├── admin.ts      # Admin endpoints
│   │   └── dashboard.ts  # Dashboard endpoints
│   ├── services/         # Business logic
│   │   ├── router.ts     # Model router service
│   │   ├── classifier.ts # Prompt classifier service
│   │   ├── cache.ts      # Cache service
│   │   ├── api-key.ts    # API key management
│   │   ├── config-manager.ts # Configuration management
│   │   ├── prisma.ts     # Database service
│   │   └── user.ts       # User management
│   ├── models/           # Model adapters
│   │   ├── base-adapter.ts    # Base adapter interface
│   │   ├── openai-adapter.ts  # OpenAI adapter
│   │   ├── anthropic-adapter.ts # Anthropic adapter
│   │   └── lmstudio-adapter.ts # LM Studio adapter
│   ├── types/            # TypeScript type definitions
│   │   └── fastify.d.ts  # Fastify type extensions
│   └── utils/            # Utility functions
│       ├── logger.ts     # Logging utilities
│       └── error-handler.ts # Error handling utilities
├── prisma/               # Prisma ORM
│   ├── schema.prisma     # Database schema
│   └── migrations/       # Database migrations
├── test/                 # Tests
│   ├── unit/             # Unit tests
│   ├── integration/      # Integration tests
│   └── performance/      # Performance tests
├── scripts/              # Scripts
│   ├── deployment/       # Deployment scripts
│   └── run-tests.sh      # Test runner
├── docs/                 # Documentation
├── .env.example          # Example environment variables
├── docker-compose.yml    # Docker Compose configuration
├── Dockerfile            # Docker configuration
├── package.json          # Dependencies and scripts
└── tsconfig.json         # TypeScript configuration
```

## Core Components

### Plugins

NeuroRoute uses Fastify's plugin system to modularize functionality:

- **env**: Loads and validates environment variables
- **cors**: Configures Cross-Origin Resource Sharing
- **redis**: Sets up Redis connection for caching
- **swagger**: Provides API documentation
- **auth**: Handles authentication and authorization
- **monitoring**: Collects metrics and monitors performance
- **rate-limit**: Implements request rate limiting
- **db-optimizer**: Optimizes database queries and connections
- **advanced-cache**: Provides advanced caching strategies

### Services

- **router**: Routes prompts to appropriate models
- **classifier**: Analyzes prompts to determine the best model
- **cache**: Caches responses for improved performance
- **api-key**: Manages API keys for authentication
- **config-manager**: Manages system configuration
- **prisma**: Handles database operations
- **user**: Manages user accounts and permissions

### Model Adapters

Model adapters provide a consistent interface to different LLM providers:

- **base-adapter**: Common interface for all adapters
- **openai-adapter**: Adapter for OpenAI models
- **anthropic-adapter**: Adapter for Anthropic models
- **lmstudio-adapter**: Adapter for local LM Studio models

## API Endpoints

### Health Check

- `GET /health`: Returns the health status of the system

### Models

- `GET /models`: Lists all available models
- `GET /models/:id`: Gets information about a specific model

### Prompt

- `POST /prompt`: Routes a prompt to the appropriate model

### Admin

- `GET /admin/users`: Lists all users
- `POST /admin/users`: Creates a new user
- `GET /admin/users/:id`: Gets a specific user
- `PUT /admin/users/:id`: Updates a user
- `DELETE /admin/users/:id`: Deletes a user
- `GET /admin/api-keys`: Lists all API keys
- `POST /admin/api-keys`: Creates a new API key
- `DELETE /admin/api-keys/:id`: Revokes an API key
- `GET /admin/config`: Gets system configuration
- `PUT /admin/config`: Updates system configuration

### Dashboard

- `GET /dashboard/stats`: Gets system statistics
- `GET /dashboard/usage`: Gets usage statistics
- `GET /dashboard/models`: Gets model usage statistics

## Configuration

NeuroRoute uses environment variables for configuration. Here are the available options:

### Server Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment (development, test, production) | `development` |
| `PORT` | Server port | `3000` |
| `HOST` | Server host | `0.0.0.0` |
| `LOG_LEVEL` | Logging level | `info` |
| `API_URL` | Public API URL | `http://localhost:3000` |

### Database Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection URL | `postgresql://postgres:postgres@localhost:5432/neuroroute` |
| `DB_POOL_MIN` | Minimum database connections | `2` |
| `DB_POOL_MAX` | Maximum database connections | `10` |
| `DB_SLOW_QUERY_THRESHOLD` | Threshold for slow query logging (ms) | `500` |

### Redis Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `ENABLE_CACHE` | Enable response caching | `true` |
| `CACHE_TTL` | Cache time-to-live (seconds) | `300` |
| `CACHE_PREFIX` | Cache key prefix | `cache:` |
| `CACHE_BY_USER` | Cache responses by user | `false` |

### Rate Limiting

| Variable | Description | Default |
|----------|-------------|---------|
| `RATE_LIMIT_MAX` | Maximum requests per window | `100` |
| `RATE_LIMIT_WINDOW` | Rate limit window (ms) | `60000` |
| `PROMPT_RATE_LIMIT_MAX` | Maximum prompt requests per window | `20` |
| `PROMPT_RATE_LIMIT_WINDOW` | Prompt rate limit window (ms) | `60000` |
| `ADMIN_RATE_LIMIT_MAX` | Maximum admin requests per window | `50` |
| `ADMIN_RATE_LIMIT_WINDOW` | Admin rate limit window (ms) | `60000` |

### Monitoring

| Variable | Description | Default |
|----------|-------------|---------|
| `ENABLE_METRICS` | Enable metrics collection | `true` |
| `METRICS_PATH` | Metrics endpoint path | `/metrics` |
| `METRICS_SAMPLE_RATE` | Percentage of requests to sample | `1.0` |

### API Documentation

| Variable | Description | Default |
|----------|-------------|---------|
| `ENABLE_SWAGGER` | Enable Swagger documentation | `true` |
| `SWAGGER_ROUTE` | Swagger UI route | `/documentation` |

### Model Providers

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key | - |
| `ANTHROPIC_API_KEY` | Anthropic API key | - |
| `LMSTUDIO_API_URL` | LM Studio API URL | `http://localhost:1234/v1` |

## Deployment

NeuroRoute can be deployed in various environments using Docker and Docker Compose.

### Development Deployment

```bash
# Start development environment
./scripts/deployment/deploy-dev.sh
```

### Staging Deployment

```bash
# Start staging environment
./scripts/deployment/deploy-staging.sh
```

### Production Deployment

```bash
# Start production environment
./scripts/deployment/deploy-prod.sh
```

### Database Migrations

```bash
# Create a new migration
./scripts/deployment/db-migrate.sh development --create --name add_user_roles

# Deploy migrations
./scripts/deployment/db-migrate.sh production --deploy
```

### Docker Deployment

The included Docker and Docker Compose files provide a containerized deployment:

```bash
# Build and start containers
docker-compose up -d

# View logs
docker-compose logs -f

# Stop containers
docker-compose down
```

### CI/CD Pipeline

The project includes GitHub Actions workflows for continuous integration and deployment:

- **Test**: Runs on all pull requests and pushes to main/develop
- **Build**: Builds Docker image on pushes to main/develop
- **Deploy to Staging**: Deploys to staging on pushes to develop
- **Deploy to Production**: Deploys to production on pushes to main

## Monitoring and Logging

### Logging

NeuroRoute uses Pino for structured logging:

- **Development**: Pretty-printed logs for readability
- **Production**: JSON logs for machine processing

Log levels:
- `error`: Error conditions
- `warn`: Warning conditions
- `info`: Informational messages
- `debug`: Debug messages
- `trace`: Trace messages

### Metrics

The monitoring plugin collects various metrics:

- **System Metrics**: CPU, memory, and uptime
- **Request Metrics**: Response time, status codes, and throughput
- **Database Metrics**: Query time and error rates
- **Cache Metrics**: Hit rate and size

Metrics are exposed in Prometheus format at the `/metrics` endpoint.

### Alerts

The monitoring plugin can trigger alerts based on thresholds:

- **Memory Usage**: Alerts when memory usage exceeds threshold
- **CPU Usage**: Alerts when CPU usage exceeds threshold
- **Response Time**: Alerts when response time exceeds threshold
- **Error Rate**: Alerts when error rate exceeds threshold

## Performance Optimization

NeuroRoute includes several performance optimizations:

### Caching

- **Response Caching**: Caches responses to reduce computation
- **Cache Strategies**: Configurable caching strategies
- **Cache Invalidation**: Automatic and manual cache invalidation

### Database Optimization

- **Connection Pooling**: Optimized database connection pooling
- **Query Monitoring**: Monitors and logs slow queries
- **Query Optimization**: Optimizes database queries

### Rate Limiting

- **Global Rate Limiting**: Limits overall request rate
- **Endpoint-Specific Limits**: Different limits for different endpoints
- **User-Based Limits**: Limits requests per user

### Memory Optimization

- **Memory Monitoring**: Monitors memory usage
- **Garbage Collection**: Optimizes garbage collection
- **Resource Cleanup**: Properly closes connections and resources

## Troubleshooting

### Common Issues

#### Server Won't Start

- Check if required services (PostgreSQL, Redis) are running
- Verify environment variables are correctly set
- Check for port conflicts

#### Database Connection Issues

- Verify PostgreSQL is running
- Check DATABASE_URL environment variable
- Ensure database user has correct permissions

#### Redis Connection Issues

- Verify Redis is running
- Check REDIS_URL environment variable
- Ensure Redis is accessible from the server

#### Slow Response Times

- Check database query performance
- Verify caching is enabled and working
- Monitor system resources (CPU, memory)

### Debugging

- Set `LOG_LEVEL=debug` for more detailed logs
- Use the `/health` endpoint to check system status
- Check the `/metrics` endpoint for performance metrics

## Contributing

### Development Workflow

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write tests
5. Run linting and tests
6. Submit a pull request

### Coding Standards

- Follow TypeScript best practices
- Use ESLint for code quality
- Write comprehensive tests
- Document your code

### Testing

- **Unit Tests**: Test individual components
- **Integration Tests**: Test API endpoints
- **Performance Tests**: Test system performance

Run tests with:
```bash
npm test
```

### Documentation

- Update API documentation when adding or changing endpoints
- Keep this developer guide up to date
- Document configuration options