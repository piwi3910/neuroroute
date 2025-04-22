# NeuroRoute API Testing and Validation Framework

This document provides an overview of the testing and validation framework implemented for the NeuroRoute API. The framework ensures reliability, correctness, and performance of the API through comprehensive testing and validation at multiple levels.

## Table of Contents

1. [Overview](#overview)
2. [Unit Testing](#unit-testing)
3. [Integration Testing](#integration-testing)
4. [Performance Testing](#performance-testing)
5. [Validation Framework](#validation-framework)
6. [CI/CD Integration](#cicd-integration)
7. [Running Tests](#running-tests)
8. [Test Coverage](#test-coverage)

## Overview

The testing and validation framework consists of four main components:

1. **Unit Testing**: Tests for individual components in isolation
2. **Integration Testing**: Tests for interactions between components
3. **Performance Testing**: Tests for throughput, latency, and scalability
4. **Validation Framework**: Schema validation for API requests and responses

The framework is designed to be comprehensive, maintainable, and integrated with the CI/CD pipeline.

## Unit Testing

Unit tests verify the behavior of individual components in isolation. The following components have unit tests:

### Model Adapters

- **OpenAI Adapter**: Tests for API interactions, error handling, and circuit breaker functionality
- **Anthropic Adapter**: Tests for API interactions, error handling, and circuit breaker functionality
- **LMStudio Adapter**: Tests for local model interactions and error handling
- **Adapter Registry**: Tests for model selection and caching

### Services

- **Router Service**: Tests for prompt routing, model selection, and fallback mechanisms
- **Classifier Service**: Tests for prompt classification, complexity determination, and feature detection
- **Config Manager**: Tests for configuration management, API key handling, and event listeners
- **Cache Service**: Tests for caching strategies and TTL handling

### Utilities

- **Error Handler**: Tests for error classification and response formatting
- **Logger**: Tests for logging and tracing functionality

### Running Unit Tests

```bash
# Run all unit tests
npm run test:unit

# Run specific unit tests
npm run test:unit -- -t "OpenAI Adapter"
```

## Integration Testing

Integration tests verify the interactions between components. The following integration tests are implemented:

### Request Flow

- **Prompt Routing**: Tests for routing prompts to the appropriate model
- **Model Selection**: Tests for selecting models based on prompt classification
- **Fallback Mechanisms**: Tests for handling unavailable models
- **Caching**: Tests for caching responses and respecting cache strategies
- **Error Handling**: Tests for handling model errors gracefully

### Database Integration

- **Config Storage**: Tests for storing and retrieving configurations
- **API Key Management**: Tests for secure API key storage and retrieval

### Redis Integration

- **Cache Storage**: Tests for storing and retrieving cached responses
- **Circuit Breaker**: Tests for circuit breaker state management

### Running Integration Tests

```bash
# Run all integration tests
npm run test:integration

# Run specific integration tests
npm run test:integration -- -t "Request Flow"
```

## Performance Testing

Performance tests verify the throughput, latency, and scalability of the API. The following performance tests are implemented:

### Benchmarks

- **Endpoint Benchmarks**: Tests for key API endpoints
- **Load Testing**: Tests for various load conditions
- **Concurrency Testing**: Tests for multiple concurrent requests

### Metrics

- **Requests per Second**: Measures throughput
- **Latency**: Measures response time
- **Throughput**: Measures data transfer rate

### Running Performance Tests

```bash
# Run performance tests
npm run test:performance
```

The performance tests generate a report at `performance-report.html` with metrics and charts.

## Validation Framework

The validation framework ensures that API requests and responses conform to the expected schemas. The following schemas are implemented:

### Request Schemas

- **Prompt Request**: Validates prompt requests with options
- **Model Config**: Validates model configuration requests
- **API Key**: Validates API key requests

### Response Schemas

- **Prompt Response**: Validates prompt responses with tokens and metadata
- **Model Config**: Validates model configuration responses
- **API Key**: Validates API key responses

### Schema Validation

The validation framework uses [Zod](https://github.com/colinhacks/zod) for runtime type checking and schema validation. Schemas are defined in `src/schemas/validation.ts`.

```typescript
// Example of validating a prompt request
import { validatePromptRequest } from '../schemas/validation';

const request = {
  prompt: 'Tell me about the weather',
  model: 'gpt-4',
  options: {
    maxTokens: 1024,
    temperature: 0.7
  }
};

try {
  const validatedRequest = validatePromptRequest(request);
  // Request is valid, proceed with processing
} catch (error) {
  // Request is invalid, handle error
}
```

## CI/CD Integration

The testing and validation framework is integrated with the CI/CD pipeline using GitHub Actions. The workflow is defined in `.github/workflows/test.yml`.

### Workflow Steps

1. **Setup**: Set up Node.js, PostgreSQL, and Redis
2. **Unit Tests**: Run unit tests
3. **Integration Tests**: Run integration tests
4. **Performance Tests**: Run performance tests
5. **Coverage Report**: Generate and upload coverage report
6. **Schema Validation**: Validate schemas

### Workflow Triggers

The workflow is triggered on:

- Push to `main` and `develop` branches
- Pull requests to `main` and `develop` branches

## Running Tests

### Prerequisites

- Node.js 20 or later
- PostgreSQL 15 or later
- Redis 7 or later

### Setup

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev
```

### Running Tests

```bash
# Run all tests
npm test

# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run performance tests
npm run test:performance

# Generate coverage report
npm run test:coverage
```

## Test Coverage

The testing framework aims for at least 80% code coverage for all components. Coverage reports are generated using Jest and can be viewed in the `coverage` directory.

### Coverage Metrics

- **Statements**: Percentage of statements covered
- **Branches**: Percentage of branches covered
- **Functions**: Percentage of functions covered
- **Lines**: Percentage of lines covered

### Viewing Coverage Reports

```bash
# Generate coverage report
npm run test:coverage

# Open coverage report
open coverage/lcov-report/index.html
```

## Conclusion

The testing and validation framework provides comprehensive testing for the NeuroRoute API, ensuring reliability, correctness, and performance. The framework is integrated with the CI/CD pipeline and provides detailed reports for test coverage and performance metrics.