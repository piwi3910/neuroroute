# NeuroRoute

NeuroRoute is an intelligent routing layer that receives prompts and intelligently forwards them to the best-suited LLM backend based on intent, complexity, and required features. The goal is to optimize for cost, speed, and capability, while keeping the system modular and easy to extend.

## Features

- **Smart Routing**: Routes prompts to the most appropriate LLM backend
- **Multiple LLM Backends**:
  - Local LM Studio for simple queries
  - OpenAI GPT-4 for code and analysis
  - Anthropic Claude for long documents and detailed reasoning
- **Redis Caching**: Optional caching of responses for improved performance
- **Comprehensive Logging**: Detailed logging of prompts, responses, and metrics
- **Modular Design**: Easy to extend with new models and classification strategies
- **Secure API Key Storage**: Store API keys securely in a local database

## Installation

### Prerequisites

- Python 3.11+
- Redis (optional, for caching)
- LM Studio (for local model access)

### Setup

1. Clone the repository
   ```bash
   git clone <repository-url>
   cd neuroroute
   ```

2. Install dependencies
   ```bash
   pip install -r requirements.txt
   ```

3. Configure environment variables
   ```bash
   # Copy the example .env file
   cp .env.example .env
   
   # Edit the .env file with your API keys (optional, can also use API endpoints)
   nano .env
   ```

4. Start LM Studio (for local model queries)
   - Open LM Studio application
   - Load your preferred local model (e.g., Mistral or LLaMA3)
   - Enable the local HTTP server on port 1234

5. Start Redis (optional, for caching)
   ```bash
   # Option 1: Using Redis server directly
   redis-server
   
   # Option 2: Using Docker Compose
   docker-compose up -d redis
   ```

## Secure API Key Management

NeuroRoute provides two methods for managing API keys:

### 1. Database Storage (Recommended)

API keys are stored securely in a local SQLite database:

- Keys are not exposed in environment variables or configuration files
- Database files are automatically excluded from git
- API endpoints allow for easy management of keys

### 2. Environment Variables

For backward compatibility, API keys can still be provided via environment variables:

- The `.env` file is included in `.gitignore` to prevent accidental commits
- Always use `.env.example` with placeholder values in version control

### Best Practices

1. **Never commit API keys to Git**
2. **Rotate API keys regularly**
3. **Use environment-specific keys**
4. **Monitor API key usage**
5. **Limit API key permissions**

## Usage

### Starting the API

```bash
# Start the FastAPI server
uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`.

### API Endpoints

#### Route a Prompt

```http
POST /prompt
Content-Type: application/json

{
  "prompt": "Write a function to calculate fibonacci numbers",
  "metadata": {
    "user_id": "user123",
    "priority": "quality"
  }
}
```

Response:

```json
{
  "model_used": "openai",
  "response": "Here's a function to calculate Fibonacci numbers using recursion...",
  "latency_ms": 1234,
  "token_usage": {
    "prompt_tokens": 12,
    "completion_tokens": 156,
    "total_tokens": 168
  }
}
```

#### List Available Models

```http
GET /models
```

Response:

```json
{
  "models": {
    "local": {
      "name": "local-lmstudio",
      "provider": "lmstudio",
      "capabilities": ["basic", "chat", "simple_math", "file_creation"],
      "max_tokens": 4096
    },
    "openai": {
      "name": "gpt-4-turbo",
      "provider": "openai",
      "capabilities": ["analysis", "code", "summarization", "comparison", "complex_reasoning"],
      "max_tokens": 128000
    },
    "anthropic": {
      "name": "claude-3-sonnet",
      "provider": "anthropic",
      "capabilities": ["long_document", "legal", "detailed_reasoning", "analysis"],
      "max_tokens": 200000
    }
  },
  "count": 3
}
```

#### API Key Management

##### List All API Keys

```http
GET /api-keys/
```

Response:

```json
[
  {
    "provider": "openai",
    "api_key": "sk-...",
    "is_active": true,
    "id": 1
  },
  {
    "provider": "anthropic",
    "api_key": "sk-ant-...",
    "is_active": true,
    "id": 2
  }
]
```

##### Get API Key for a Provider

```http
GET /api-keys/{provider}
```

Response:

```json
{
  "provider": "openai",
  "api_key": "sk-...",
  "is_active": true,
  "id": 1
}
```

##### Create or Update API Key

```http
POST /api-keys/
Content-Type: application/json

{
  "provider": "openai",
  "api_key": "sk-...",
  "is_active": true
}
```

Response:

```json
{
  "provider": "openai",
  "api_key": "sk-...",
  "is_active": true,
  "id": 1
}
```

##### Update API Key

```http
PUT /api-keys/{provider}
Content-Type: application/json

{
  "provider": "openai",
  "api_key": "sk-...",
  "is_active": true
}
```

Response:

```json
{
  "provider": "openai",
  "api_key": "sk-...",
  "is_active": true,
  "id": 1
}
```

##### Delete API Key

```http
DELETE /api-keys/{provider}
```

#### Health Check

```http
GET /health
```

## Project Structure

```
neuroroute/
│
├── main.py                  # FastAPI entrypoint
├── router.py                # Core routing + model selection logic
├── classifier.py            # Prompt classification logic
├── cache.py                 # Redis wrapper
├── config.py                # Model registry, API keys, etc.
├── api_keys.py              # API key management endpoints
│
├── db/
│   ├── __init__.py          # Database package initialization
│   ├── database.py          # Database connection and session management
│   ├── models.py            # SQLAlchemy models
│   └── crud.py              # Database operations
│
├── models/
│   ├── base_adapter.py      # Base adapter interface
│   ├── openai_adapter.py    # OpenAI adapter
│   ├── anthropic_adapter.py # Anthropic adapter
│   └── local_lmstudio_adapter.py # Local LM Studio adapter
│
├── utils/
│   └── logger.py            # Logging utilities
│
├── logs/                    # Log files
├── db_data/                 # Database files
├── requirements.txt         # Project dependencies
└── README.md                # Project documentation
```

## Classification Logic

The current classification uses a simple rule-based approach:

- **"create file", "basic math", "hello"** → Local LLM via LM Studio
- **"analyze", "summarize", "code", "compare"** → OpenAI GPT-4
- **"long document", "legal", "detailed reasoning"** → Claude Opus

In the future, this can be replaced with a more sophisticated ML-based classifier or embedding model.

## Future Enhancements

- ML-based classification using embeddings
- Support for multimodal inputs (images, audio)
- More fine-grained model selection based on context
- Additional LLM backends
- Token budget management
- Request rate limiting
- User-specific model preferences

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[MIT License](LICENSE)