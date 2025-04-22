# NeuroRoute Configuration Reference

This document provides a comprehensive reference for all configuration options available in NeuroRoute. Configuration is primarily managed through environment variables, which can be set in a `.env` file or directly in the environment.

## Table of Contents

- [NeuroRoute Configuration Reference](#neuroroute-configuration-reference)
  - [Table of Contents](#table-of-contents)
  - [Server Configuration](#server-configuration)
  - [Database Configuration](#database-configuration)
  - [Redis Configuration](#redis-configuration)
  - [Caching Configuration](#caching-configuration)
  - [Rate Limiting Configuration](#rate-limiting-configuration)
  - [Authentication Configuration](#authentication-configuration)
  - [Monitoring Configuration](#monitoring-configuration)
  - [Documentation Configuration](#documentation-configuration)
  - [Model Provider Configuration](#model-provider-configuration)
  - [Logging Configuration](#logging-configuration)
  - [Security Configuration](#security-configuration)
  - [Environment-Specific Files](#environment-specific-files)
    - [Example .env File](#example-env-file)
  - [Configuration Precedence](#configuration-precedence)
  - [Accessing Configuration in Code](#accessing-configuration-in-code)
  - [Validating Configuration](#validating-configuration)
  - [Sensitive Configuration](#sensitive-configuration)

## Server Configuration

These variables control the basic server settings.

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `NODE_ENV` | Environment (development, test, production) | `development` | `production` |
| `PORT` | Server port | `3000` | `8080` |
| `HOST` | Server host | `0.0.0.0` | `localhost` |
| `API_URL` | Public API URL | `http://localhost:3000` | `https://api.example.com` |
| `CORS_ORIGIN` | Allowed CORS origins | `*` | `https://example.com,https://admin.example.com` |
| `CORS_METHODS` | Allowed CORS methods | `GET,POST,PUT,DELETE` | `GET,POST,PUT,DELETE,PATCH` |
| `CORS_CREDENTIALS` | Allow credentials in CORS requests | `true` | `false` |
| `TRUST_PROXY` | Trust proxy headers | `false` | `true` |

## Database Configuration

These variables control the PostgreSQL database connection.

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `DATABASE_URL` | PostgreSQL connection URL | `postgresql://postgres:postgres@localhost:5432/neuroroute` | `postgresql://user:password@host:5432/dbname` |
| `DB_POOL_MIN` | Minimum database connections | `2` | `5` |
| `DB_POOL_MAX` | Maximum database connections | `10` | `20` |
| `DB_IDLE_TIMEOUT` | Connection idle timeout (ms) | `10000` | `30000` |
| `DB_CONNECT_TIMEOUT` | Connection timeout (ms) | `5000` | `10000` |
| `DB_SLOW_QUERY_THRESHOLD` | Threshold for slow query logging (ms) | `500` | `1000` |
| `DB_LOG_QUERIES` | Log all database queries | `false` | `true` |
| `DB_SSL` | Use SSL for database connection | `false` | `true` |
| `DB_SSL_REJECT_UNAUTHORIZED` | Reject unauthorized SSL connections | `true` | `false` |

## Redis Configuration

These variables control the Redis connection for caching and rate limiting.

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` | `redis://user:password@host:6379` |
| `REDIS_PREFIX` | Prefix for Redis keys | `neuroroute:` | `myapp:` |
| `REDIS_DB` | Redis database number | `0` | `1` |
| `REDIS_PASSWORD` | Redis password | - | `password` |
| `REDIS_TLS` | Use TLS for Redis connection | `false` | `true` |
| `REDIS_SENTINEL` | Use Redis Sentinel | `false` | `true` |
| `REDIS_SENTINEL_NAME` | Redis Sentinel master name | - | `mymaster` |
| `REDIS_CLUSTER` | Use Redis Cluster | `false` | `true` |

## Caching Configuration

These variables control the caching behavior.

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `ENABLE_CACHE` | Enable response caching | `true` | `false` |
| `CACHE_TTL` | Cache time-to-live (seconds) | `300` | `600` |
| `CACHE_PREFIX` | Cache key prefix | `cache:` | `responses:` |
| `CACHE_BY_USER` | Cache responses by user | `false` | `true` |
| `CACHE_BY_QUERY_PARAMS` | Cache responses by query parameters | `true` | `false` |
| `CACHE_BY_HEADERS` | Headers to include in cache key | `accept-language` | `accept-language,user-agent` |
| `CACHE_COMPRESSION` | Enable cache compression | `true` | `false` |
| `CACHE_MIN_SIZE` | Minimum size for compression (bytes) | `1024` | `2048` |
| `CACHE_EXCLUDE_PATHS` | Paths to exclude from caching (comma-separated) | `^/health,^/metrics,^/admin` | `^/health,^/private` |
| `CACHE_EXCLUDE_METHODS` | Methods to exclude from caching (comma-separated) | `POST,PUT,DELETE,PATCH` | `POST,PUT,DELETE` |

## Rate Limiting Configuration

These variables control the rate limiting behavior.

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `RATE_LIMIT_ENABLED` | Enable rate limiting | `true` | `false` |
| `RATE_LIMIT_MAX` | Maximum requests per window | `100` | `200` |
| `RATE_LIMIT_WINDOW` | Rate limit window (ms) | `60000` | `120000` |
| `PROMPT_RATE_LIMIT_MAX` | Maximum prompt requests per window | `20` | `30` |
| `PROMPT_RATE_LIMIT_WINDOW` | Prompt rate limit window (ms) | `60000` | `120000` |
| `ADMIN_RATE_LIMIT_MAX` | Maximum admin requests per window | `50` | `100` |
| `ADMIN_RATE_LIMIT_WINDOW` | Admin rate limit window (ms) | `60000` | `120000` |
| `RATE_LIMIT_HEADERS` | Include rate limit headers in responses | `true` | `false` |
| `RATE_LIMIT_STORE` | Store for rate limit data (redis, memory) | `redis` | `memory` |
| `RATE_LIMIT_SKIP_FAILED_REQUESTS` | Skip failed requests in rate limiting | `false` | `true` |
| `RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS` | Skip successful requests in rate limiting | `false` | `true` |

## Authentication Configuration

These variables control the authentication behavior.

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `AUTH_ENABLED` | Enable authentication | `true` | `false` |
| `AUTH_HEADER` | Header for API key | `x-api-key` | `authorization` |
| `AUTH_PREFIX` | Prefix for API keys | `nr_` | `api_` |
| `AUTH_KEY_LENGTH` | Length of generated API keys | `32` | `64` |
| `JWT_SECRET` | Secret for JWT tokens | - | `your-secret-key` |
| `JWT_EXPIRES_IN` | JWT token expiration | `1d` | `7d` |
| `JWT_ALGORITHM` | JWT signing algorithm | `HS256` | `RS256` |
| `JWT_ISSUER` | JWT issuer | `neuroroute` | `myapp` |
| `JWT_AUDIENCE` | JWT audience | `neuroroute-api` | `myapp-api` |

## Monitoring Configuration

These variables control the monitoring and metrics behavior.

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `ENABLE_METRICS` | Enable metrics collection | `true` | `false` |
| `METRICS_PATH` | Metrics endpoint path | `/metrics` | `/prometheus` |
| `METRICS_SAMPLE_RATE` | Percentage of requests to sample | `1.0` | `0.5` |
| `ENABLE_TRACING` | Enable distributed tracing | `false` | `true` |
| `TRACING_EXPORTER` | Tracing exporter (jaeger, zipkin) | - | `jaeger` |
| `TRACING_ENDPOINT` | Tracing exporter endpoint | - | `http://jaeger:14268/api/traces` |
| `ALERT_MEMORY_THRESHOLD` | Memory usage alert threshold (%) | `90` | `80` |
| `ALERT_CPU_THRESHOLD` | CPU usage alert threshold (%) | `80` | `70` |
| `ALERT_RESPONSE_TIME_THRESHOLD` | Response time alert threshold (ms) | `1000` | `500` |
| `ALERT_ERROR_RATE_THRESHOLD` | Error rate alert threshold (%) | `5` | `2` |
| `ALERT_WEBHOOK` | Webhook URL for alerts | - | `https://hooks.slack.com/services/...` |

## Documentation Configuration

These variables control the API documentation.

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `ENABLE_SWAGGER` | Enable Swagger documentation | `true` | `false` |
| `SWAGGER_ROUTE` | Swagger UI route | `/documentation` | `/api-docs` |
| `SWAGGER_THEME` | Swagger UI theme | - | `dark` |
| `SWAGGER_TITLE` | Swagger UI title | `NeuroRoute API Documentation` | `My API Docs` |
| `SWAGGER_DESCRIPTION` | API description | `NeuroRoute API documentation` | `My API description` |
| `SWAGGER_VERSION` | API version | `1.0.0` | `2.0.0` |
| `SWAGGER_CONTACT_NAME` | Contact name | `API Support` | `John Doe` |
| `SWAGGER_CONTACT_EMAIL` | Contact email | `support@example.com` | `john@example.com` |
| `SWAGGER_CONTACT_URL` | Contact URL | `https://example.com/support` | `https://example.com/contact` |

## Model Provider Configuration

These variables control the LLM providers.

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `OPENAI_API_KEY` | OpenAI API key | - | `sk-...` |
| `OPENAI_API_URL` | OpenAI API URL | `https://api.openai.com/v1` | `https://api.openai.com/v1` |
| `OPENAI_ORG_ID` | OpenAI organization ID | - | `org-...` |
| `ANTHROPIC_API_KEY` | Anthropic API key | - | `sk-ant-...` |
| `ANTHROPIC_API_URL` | Anthropic API URL | `https://api.anthropic.com` | `https://api.anthropic.com` |
| `LMSTUDIO_API_URL` | LM Studio API URL | `http://localhost:1234/v1` | `http://lmstudio:1234/v1` |
| `DEFAULT_MODEL` | Default model to use | `gpt-3.5-turbo` | `claude-3-sonnet` |
| `ENABLED_MODELS` | Enabled models (comma-separated) | `gpt-3.5-turbo,gpt-4,claude-3-opus,claude-3-sonnet` | `gpt-4,claude-3-opus` |
| `MODEL_TIMEOUT` | Model request timeout (ms) | `30000` | `60000` |
| `MAX_TOKENS` | Default max tokens | `1024` | `2048` |
| `TEMPERATURE` | Default temperature | `0.7` | `0.5` |

## Logging Configuration

These variables control the logging behavior.

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `LOG_LEVEL` | Logging level | `info` | `debug` |
| `LOG_FORMAT` | Log format (pretty, json) | `pretty` in development, `json` in production | `json` |
| `LOG_DESTINATION` | Log destination (stdout, file) | `stdout` | `file` |
| `LOG_FILE` | Log file path (if destination is file) | `logs/app.log` | `/var/log/neuroroute.log` |
| `LOG_MAX_SIZE` | Maximum log file size (MB) | `10` | `100` |
| `LOG_MAX_FILES` | Maximum number of log files | `5` | `10` |
| `LOG_COMPRESS` | Compress rotated log files | `true` | `false` |
| `LOG_REDACT` | Fields to redact from logs (comma-separated) | `req.headers.authorization,req.headers["x-api-key"],req.body.password,req.body.apiKey` | `req.headers.cookie` |
| `REQUEST_LOGGING` | Enable request logging | `true` | `false` |
| `REQUEST_LOG_BODY` | Log request bodies | `false` | `true` |
| `RESPONSE_LOG_BODY` | Log response bodies | `false` | `true` |

## Security Configuration

These variables control security features.

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `HELMET_ENABLED` | Enable Helmet security headers | `true` | `false` |
| `CONTENT_SECURITY_POLICY` | Content Security Policy | - | `default-src 'self'` |
| `ALLOWED_HOSTS` | Allowed hosts (comma-separated) | `*` | `example.com,api.example.com` |
| `MAX_BODY_SIZE` | Maximum request body size (bytes) | `1048576` (1MB) | `5242880` (5MB) |
| `ENABLE_CSRF` | Enable CSRF protection | `false` | `true` |
| `CSRF_SECRET` | CSRF secret | - | `your-csrf-secret` |
| `CSRF_COOKIE_NAME` | CSRF cookie name | `_csrf` | `xsrf-token` |
| `CSRF_HEADER_NAME` | CSRF header name | `x-csrf-token` | `x-xsrf-token` |

## Environment-Specific Files

NeuroRoute supports different environment-specific configuration files:

- `.env`: Default environment variables
- `.env.development`: Development environment variables
- `.env.test`: Test environment variables
- `.env.staging`: Staging environment variables
- `.env.production`: Production environment variables

Environment-specific files take precedence over the default `.env` file.

### Example .env File

```dotenv
# Server Configuration
NODE_ENV=development
PORT=3000
HOST=0.0.0.0
API_URL=http://localhost:3000

# Database Configuration
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/neuroroute
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_SLOW_QUERY_THRESHOLD=500

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_PREFIX=neuroroute:

# Caching Configuration
ENABLE_CACHE=true
CACHE_TTL=300
CACHE_PREFIX=cache:

# Rate Limiting Configuration
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000
PROMPT_RATE_LIMIT_MAX=20
PROMPT_RATE_LIMIT_WINDOW=60000
ADMIN_RATE_LIMIT_MAX=50
ADMIN_RATE_LIMIT_WINDOW=60000

# Authentication Configuration
AUTH_ENABLED=true
AUTH_HEADER=x-api-key
AUTH_PREFIX=nr_

# Monitoring Configuration
ENABLE_METRICS=true
METRICS_PATH=/metrics
METRICS_SAMPLE_RATE=1.0

# Documentation Configuration
ENABLE_SWAGGER=true
SWAGGER_ROUTE=/documentation

# Model Provider Configuration
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key
DEFAULT_MODEL=gpt-3.5-turbo

# Logging Configuration
LOG_LEVEL=info
LOG_FORMAT=pretty
REQUEST_LOGGING=true

# Security Configuration
HELMET_ENABLED=true
MAX_BODY_SIZE=1048576
```

## Configuration Precedence

Configuration values are loaded in the following order, with later sources taking precedence:

1. Default values hardcoded in the application
2. `.env` file
3. Environment-specific file (e.g., `.env.production`)
4. Environment variables set in the system
5. Command-line arguments

## Accessing Configuration in Code

Configuration values are accessible in the application through the `config` object:

```typescript
// Using the config object
const port = fastify.config.PORT;
const dbUrl = fastify.config.DATABASE_URL;

// With fallback values
const maxTokens = fastify.config.MAX_TOKENS || 1024;
const temperature = fastify.config.TEMPERATURE || 0.7;
```

## Validating Configuration

NeuroRoute validates configuration values on startup using JSON Schema validation. If required configuration values are missing or invalid, the application will fail to start with an error message indicating the missing or invalid values.

## Sensitive Configuration

Sensitive configuration values (API keys, passwords, etc.) should be stored securely:

- In development, use `.env` files (excluded from version control)
- In production, use environment variables or a secrets management service
- Never hardcode sensitive values in the application code
- Use the `LOG_REDACT` setting to prevent sensitive values from appearing in logs