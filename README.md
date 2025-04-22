# NeuroRoute v0.0.1

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
   
   # Edit the .env file with your API keys
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

NeuroRoute requires API keys for OpenAI and Anthropic services. To ensure these keys remain secure:

1. **Never commit API keys to Git**
   - The `.env` file is included in `.gitignore` to prevent accidental commits
   - Always use `.env.example` with placeholder values in version control

2. **Rotate API keys regularly**
   - Periodically generate new API keys and update your local `.env` file
   - Revoke old keys after rotation

3. **Use environment-specific keys**
   - Use different API keys for development, testing, and production
   - Consider using API key management services for production environments

4. **Monitor API key usage**
   - Regularly check your API usage dashboards for unusual activity
   - Set up billing alerts to prevent unexpected charges

5. **Limit API key permissions**
   - When possible, use scoped API keys with minimal required permissions
   - Create separate keys for different services or components

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