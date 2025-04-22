# NeuroRoute v0.0.2 - API Key Database Storage

This release adds secure database storage for API keys, eliminating the need to store sensitive keys in environment variables.

## Features

- **Database Storage for API Keys**: Store API keys securely in a local SQLite database
- **API Endpoints for Key Management**: REST API for managing API keys
- **Automatic Database Initialization**: Creates necessary directories and tables on startup
- **Fallback to Environment Variables**: Uses environment variables as fallback if database keys not available
- **Updated Dependencies**: Latest versions of Anthropic and OpenAI SDKs

## Classification Logic

The current classification uses a rule-based approach:

- **"create file", "basic math", "hello"** → Local LLM via LM Studio
- **"analyze", "summarize", "code", "compare"** → OpenAI GPT-4
- **"long document", "legal", "detailed reasoning"** → Claude Opus

## Recent Changes

- Added database storage for API keys
- Created API endpoints for managing API keys
- Updated Anthropic SDK to v0.49.0
- Updated OpenAI SDK to v1.75.0
- Fixed duplicate database initialization in main.py
- Updated .gitignore to exclude database files

## Installation

### Prerequisites

- Python 3.11+
- Redis (optional, for caching)
- LM Studio (for local model access)

### Setup

1. Clone the repository
   ```bash
   git clone https://github.com/piwi3910/neuroroute.git
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

6. Start the API
   ```bash
   uvicorn main:app --reload
   ```

The API will be available at `http://localhost:8000`.

# NeuroRoute v0.0.1 - Initial Release

This is the initial release of NeuroRoute, an intelligent LLM routing layer that forwards prompts to the best-suited LLM backend based on intent, complexity, and required features.

## Features

- **Smart Routing**: Routes prompts to the most appropriate LLM backend based on intent, complexity, and required features
- **Multiple LLM Backends**:
  - Local LM Studio for simple queries
  - OpenAI GPT-4 for code and analysis
  - Anthropic Claude for long documents and detailed reasoning
- **Redis Caching**: Optional caching of responses for improved performance
- **Comprehensive Logging**: Detailed logging of prompts, responses, and metrics
- **Modular Design**: Easy to extend with new models and classification strategies

## Classification Logic

The current classification uses a rule-based approach:

- **"create file", "basic math", "hello"** → Local LLM via LM Studio
- **"analyze", "summarize", "code", "compare"** → OpenAI GPT-4
- **"long document", "legal", "detailed reasoning"** → Claude Opus

## Recent Changes

- Added Docker Compose support for Redis
- Fixed configuration issues in config.py (cors_origins type, explicit .env loading)
- Added _camel_to_snake method in router.py to fix dynamic adapter loading
- Fixed health check interval references in router.py
- Added API testing documentation