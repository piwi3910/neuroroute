# NeuroRoute

NeuroRoute is an intelligent routing layer built with Node.js and Fastify. It receives prompts and intelligently forwards them to the best-suited LLM backend based on intent, complexity, and required features. The goal is to optimize for cost, speed, and capability, while keeping the system modular and easy to extend.

## Features

- **Smart Routing**: Routes prompts to the most appropriate LLM backend.
- **Multiple LLM Backends**:
  - Local LM Studio for simple queries
  - OpenAI GPT models
  - Anthropic Claude models
- **OpenAI-Compatible API**: Includes a `/chat/completions` endpoint compatible with the OpenAI API specification.
- **Redis Caching**: Optional caching of responses for improved performance.
- **PostgreSQL Database**: Uses PostgreSQL for storing API keys, configurations, and logs.
- **Prisma ORM**: Integrates with Prisma for database management.
- **Comprehensive Logging**: Detailed logging of prompts, responses, and metrics using Pino.
- **Modular Design**: Easy to extend with new models and classification strategies.
- **Secure API Key Management**: Store API keys securely in the database.
- **Dynamic Configuration**: Manage model configurations and routing rules via API.
- **Monitoring & Tracing**: Built-in support for performance metrics and request tracing.

## Installation

### Prerequisites

- Node.js v18+
- npm
- PostgreSQL database
- Redis (optional, for caching)
- LM Studio (optional, for local model access)

### Setup

1.  **Clone the repository**
    ```bash
    git clone <repository-url>
    cd neuroroute
    ```

2.  **Install API dependencies**
    ```bash
    cd neuroroute-api
    npm install
    ```

3.  **Configure environment variables**
    - Copy the example `.env` file in the `neuroroute-api` directory:
      ```bash
      cp .env.example .env
      ```
    - Edit the `.env` file with your database connection string, Redis URL (optional), and API keys (optional, can also use API endpoints):
      ```bash
      # Example .env content
      DATABASE_URL="postgresql://user:password@host:port/database"
      REDIS_URL="redis://localhost:6379"
      OPENAI_API_KEY="sk-..."
      ANTHROPIC_API_KEY="sk-ant-..."
      LMSTUDIO_URL="http://localhost:1234/v1" # Default LM Studio URL
      JWT_SECRET="your-secure-jwt-secret"
      # ... other variables
      ```

4.  **Set up the database**
    - Ensure your PostgreSQL server is running.
    - Run Prisma migrations to create the database schema:
      ```bash
      npx prisma migrate dev
      ```

5.  **Start LM Studio (optional, for local model queries)**
    - Open LM Studio application.
    - Load your preferred local model (e.g., Mistral or LLaMA3).
    - Enable the local HTTP server (usually on port 1234).

6.  **Start Redis (optional, for caching)**
    ```bash
    # Option 1: Using Redis server directly
    redis-server

    # Option 2: Using Docker Compose (if available in project root)
    # docker-compose up -d redis
    ```

## Secure API Key Management

NeuroRoute provides two methods for managing API keys:

### 1. Database Storage (Recommended)

API keys are stored securely in the PostgreSQL database:

- Keys are not exposed in environment variables or configuration files.
- API endpoints allow for easy management of keys.

### 2. Environment Variables

For backward compatibility or simpler setups, API keys can still be provided via environment variables in the `.env` file:

- The `.env` file is included in `.gitignore` to prevent accidental commits.
- Always use `.env.example` with placeholder values in version control.

### Best Practices

1.  **Never commit API keys to Git.**
2.  **Rotate API keys regularly.**
3.  **Use environment-specific keys.**
4.  **Monitor API key usage.**
5.  **Limit API key permissions.**

## Usage

### Starting the API

1.  **Build the project:**
    ```bash
    npm run build
    ```
2.  **Start the Fastify server:**
    ```bash
    npm start
    ```
    Alternatively, for development with auto-reloading:
    ```bash
    npm run dev
    ```

The API will be available at `http://localhost:3000` (or the port specified in your `.env` file).

### API Endpoints

NeuroRoute provides several API endpoints:

#### `/chat/completions` (OpenAI Compatible)

- **Method**: `POST`
- **Description**: Generate chat completions using an OpenAI-compatible interface. Supports streaming.
- **Body**: Follows the [OpenAI Chat Completions API specification](https://platform.openai.com/docs/api-reference/chat/create).
  ```json
  {
    "model": "gpt-4.1", // Or other model ID like 'claude-3-7-sonnet-latest', 'lmstudio-local'
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Hello!"}
    ],
    "stream": false, // Set to true for streaming
    "temperature": 0.7,
    "max_tokens": 100
  }
  ```
- **Response (Non-streaming)**: OpenAI-compatible chat completion object.
- **Response (Streaming)**: Server-Sent Events (SSE) stream with chunks in OpenAI format, ending with `data: [DONE]`.

#### `/prompt` (Legacy)

- **Method**: `POST`
- **Description**: Route a simple prompt to the best model based on internal logic.
- **Body**:
  ```json
  {
    "prompt": "Write a function to calculate fibonacci numbers",
    "model": "optional-model-id", // Optional: Force a specific model
    "max_tokens": 1024,
    "temperature": 0.7
  }
  ```
- **Response**:
  ```json
  {
    "response": "...",
    "model_used": "gpt-4.1",
    "tokens": { "prompt": 10, "completion": 50, "total": 60 },
    "processing_time": 1.234,
    // ... other metadata
  }
  ```

#### `/models`

- **Method**: `GET`
- **Description**: List available models and their capabilities based on the dynamic configuration.

#### `/admin/*`

- **Description**: Endpoints for managing API keys, model configurations, and viewing audit logs. Requires authentication. (See `neuroroute-api/docs/admin-api-guide.md` for details).

#### `/health`

- **Method**: `GET`
- **Description**: Check the health status of the API.

### API Documentation

Interactive API documentation (Swagger UI) is available at `/documentation` when running in development mode or if `ENABLE_SWAGGER` is set to `true`.

## Project Structure (`neuroroute-api`)

```
neuroroute-api/
├── dist/                  # Compiled JavaScript output
├── prisma/                # Prisma schema and migrations
├── scripts/               # Build and utility scripts
├── src/
│   ├── app.ts             # Fastify application setup
│   ├── config.ts          # Configuration loading
│   ├── models/            # LLM Adapter implementations (OpenAI, Anthropic, LMStudio)
│   ├── plugins/           # Fastify plugins (Auth, CORS, Redis, Swagger, etc.)
│   ├── routes/            # API route definitions (chat, prompt, admin, models, health)
│   ├── schemas/           # Request/response validation schemas
│   ├── services/          # Core services (Router, Cache, Classifier, Prisma, ConfigManager)
│   ├── types/             # TypeScript type definitions
│   └── utils/             # Utility functions (Logger, Error Handler, Translators)
├── test/                  # Unit, integration, and performance tests
├── .env.example           # Example environment variables
├── Dockerfile             # Docker build definition
├── eslint.config.js       # ESLint configuration
├── jest.config.js         # Jest test configuration
├── package.json           # Project dependencies and scripts
├── README.md              # API-specific README
└── tsconfig.json          # TypeScript configuration
```

## Classification Logic

The current classification uses a simple rule-based approach within `src/services/classifier.ts`. This can be extended or replaced with more sophisticated methods (e.g., ML models, embeddings) as needed.

## Future Enhancements

- ML-based classification using embeddings.
- Support for multimodal inputs.
- More fine-grained model selection based on context and cost/latency/quality trade-offs.
- Additional LLM backends.
- Token budget management per request or user.
- User-specific model preferences.
- Enhanced monitoring dashboards.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[MIT License](LICENSE)