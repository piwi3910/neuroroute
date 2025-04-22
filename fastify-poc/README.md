# NeuroRoute

![NeuroRoute Logo](https://via.placeholder.com/200x50?text=NeuroRoute)

NeuroRoute is an intelligent routing system for LLM requests, directing prompts to the most appropriate model based on content analysis. This repository contains the Fastify implementation of NeuroRoute.

## Features

- **Intelligent Model Routing**: Automatically routes prompts to the most appropriate AI model based on content analysis
- **Multi-Model Support**: Integrates with OpenAI, Anthropic, and local LM Studio models
- **Advanced Caching**: Optimizes response times with intelligent caching strategies
- **Rate Limiting**: Protects the API from abuse with configurable rate limits
- **Monitoring**: Comprehensive metrics and monitoring for performance insights
- **Authentication**: Secure API access with API key authentication
- **Admin API**: Manage users, API keys, and system configuration
- **Swagger Documentation**: Interactive API documentation
- **TypeScript**: Type-safe codebase with TypeScript
- **Prisma ORM**: Database access with Prisma ORM
- **Redis**: Caching and rate limiting with Redis
- **Docker**: Containerized deployment with Docker and Docker Compose

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- PostgreSQL (v15 or later)
- Redis (v7 or later)
- Docker and Docker Compose (optional, for containerized deployment)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/neuroroute.git
   cd neuroroute/fastify-poc
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

7. Access the API documentation:
   ```
   http://localhost:3000/documentation
   ```

### Docker Deployment

1. Build and start the containers:
   ```bash
   docker-compose up -d
   ```

2. Run database migrations:
   ```bash
   docker-compose exec app npx prisma migrate deploy
   ```

3. Access the API:
   ```
   http://localhost:3000
   ```

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

## Documentation

- [Developer Guide](./docs/developer-guide.md): Comprehensive guide for developers
- [Admin API Guide](./docs/admin-api-guide.md): Guide for using the Admin API
- [Configuration Reference](./docs/configuration-reference.md): Reference for all configuration options
- [API Documentation](http://localhost:3000/documentation): Interactive API documentation (when running the server)
- [Testing Validation Report](./docs/testing-validation-report.md): Results of testing and validation

## Scripts

- `npm run dev`: Start the development server
- `npm run build`: Build the application
- `npm run start`: Start the production server
- `npm run test`: Run tests
- `npm run test:unit`: Run unit tests
- `npm run test:integration`: Run integration tests
- `npm run test:performance`: Run performance tests
- `npm run test:coverage`: Run tests with coverage
- `npm run lint`: Run linting
- `npm run prisma:generate`: Generate Prisma client
- `npm run prisma:migrate`: Run database migrations

## Deployment

NeuroRoute can be deployed in various environments using the provided deployment scripts:

- `./scripts/deployment/deploy-dev.sh`: Deploy to development environment
- `./scripts/deployment/deploy-staging.sh`: Deploy to staging environment
- `./scripts/deployment/deploy-prod.sh`: Deploy to production environment
- `./scripts/deployment/db-migrate.sh`: Run database migrations

## Architecture

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

## Performance

NeuroRoute is designed for high performance and scalability:

- **Response Time**: Average response time of ~22ms for prompt routing
- **Throughput**: Up to 2,450 requests per second for health checks
- **Concurrency**: Consistent performance with increasing concurrency levels
- **Memory Usage**: ~80MB base memory usage

For detailed performance metrics, see the [Testing Validation Report](./docs/testing-validation-report.md).

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgements

- [Fastify](https://www.fastify.io/) - Fast and low overhead web framework for Node.js
- [Prisma](https://www.prisma.io/) - Next-generation ORM for Node.js and TypeScript
- [Redis](https://redis.io/) - In-memory data structure store
- [OpenAI](https://openai.com/) - AI research and deployment company
- [Anthropic](https://www.anthropic.com/) - AI safety and research company