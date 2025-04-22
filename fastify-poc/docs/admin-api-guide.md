# NeuroRoute Admin API User Guide

## Table of Contents

1. [Introduction](#introduction)
2. [Authentication](#authentication)
3. [User Management](#user-management)
4. [API Key Management](#api-key-management)
5. [System Configuration](#system-configuration)
6. [Monitoring and Statistics](#monitoring-and-statistics)
7. [Model Management](#model-management)
8. [Troubleshooting](#troubleshooting)

## Introduction

The NeuroRoute Admin API provides administrative capabilities for managing users, API keys, system configuration, and monitoring. This guide explains how to use these endpoints effectively.

## Authentication

All Admin API endpoints require authentication with an admin-level API key. Include your API key in the request header:

```
X-API-Key: your-admin-api-key
```

Admin API keys have elevated privileges and should be kept secure. They are subject to rate limiting to prevent abuse.

## User Management

The User Management API allows you to create, view, update, and delete user accounts.

### List Users

Retrieve a list of all users in the system.

**Request:**
```http
GET /admin/users
```

**Query Parameters:**
- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Number of users per page (default: 20)
- `sort` (optional): Field to sort by (default: "createdAt")
- `order` (optional): Sort order ("asc" or "desc", default: "desc")
- `filter` (optional): Filter users by name, email, or status

**Response:**
```json
{
  "users": [
    {
      "id": "user_123",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user",
      "status": "active",
      "createdAt": "2025-01-15T10:30:00Z",
      "updatedAt": "2025-04-20T14:25:00Z"
    },
    {
      "id": "user_456",
      "name": "Jane Smith",
      "email": "jane@example.com",
      "role": "admin",
      "status": "active",
      "createdAt": "2025-02-10T08:15:00Z",
      "updatedAt": "2025-04-18T11:20:00Z"
    }
  ],
  "pagination": {
    "total": 42,
    "page": 1,
    "limit": 20,
    "pages": 3
  }
}
```

### Get User

Retrieve details for a specific user.

**Request:**
```http
GET /admin/users/:id
```

**Response:**
```json
{
  "id": "user_123",
  "name": "John Doe",
  "email": "john@example.com",
  "role": "user",
  "status": "active",
  "createdAt": "2025-01-15T10:30:00Z",
  "updatedAt": "2025-04-20T14:25:00Z",
  "apiKeys": [
    {
      "id": "key_789",
      "name": "Development Key",
      "lastUsed": "2025-04-22T09:15:00Z",
      "createdAt": "2025-03-10T11:20:00Z"
    }
  ],
  "usage": {
    "requestsThisMonth": 1250,
    "tokensThisMonth": 78500,
    "costThisMonth": 1.57
  }
}
```

### Create User

Create a new user account.

**Request:**
```http
POST /admin/users
Content-Type: application/json

{
  "name": "New User",
  "email": "newuser@example.com",
  "password": "securePassword123",
  "role": "user"
}
```

**Response:**
```json
{
  "id": "user_789",
  "name": "New User",
  "email": "newuser@example.com",
  "role": "user",
  "status": "active",
  "createdAt": "2025-04-22T15:30:00Z",
  "updatedAt": "2025-04-22T15:30:00Z"
}
```

### Update User

Update an existing user's information.

**Request:**
```http
PUT /admin/users/:id
Content-Type: application/json

{
  "name": "Updated Name",
  "email": "updated@example.com",
  "role": "admin",
  "status": "active"
}
```

**Response:**
```json
{
  "id": "user_123",
  "name": "Updated Name",
  "email": "updated@example.com",
  "role": "admin",
  "status": "active",
  "createdAt": "2025-01-15T10:30:00Z",
  "updatedAt": "2025-04-22T15:35:00Z"
}
```

### Delete User

Delete a user account.

**Request:**
```http
DELETE /admin/users/:id
```

**Response:**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

## API Key Management

The API Key Management endpoints allow you to create, view, and revoke API keys.

### List API Keys

Retrieve a list of all API keys in the system.

**Request:**
```http
GET /admin/api-keys
```

**Query Parameters:**
- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Number of keys per page (default: 20)
- `userId` (optional): Filter keys by user ID
- `status` (optional): Filter keys by status ("active" or "revoked")

**Response:**
```json
{
  "apiKeys": [
    {
      "id": "key_123",
      "name": "Production Key",
      "userId": "user_456",
      "userName": "Jane Smith",
      "status": "active",
      "lastUsed": "2025-04-22T10:15:00Z",
      "createdAt": "2025-01-20T14:30:00Z"
    },
    {
      "id": "key_456",
      "name": "Development Key",
      "userId": "user_123",
      "userName": "John Doe",
      "status": "active",
      "lastUsed": "2025-04-21T16:45:00Z",
      "createdAt": "2025-02-15T09:20:00Z"
    }
  ],
  "pagination": {
    "total": 15,
    "page": 1,
    "limit": 20,
    "pages": 1
  }
}
```

### Get API Key

Retrieve details for a specific API key.

**Request:**
```http
GET /admin/api-keys/:id
```

**Response:**
```json
{
  "id": "key_123",
  "prefix": "nr_",
  "name": "Production Key",
  "userId": "user_456",
  "userName": "Jane Smith",
  "status": "active",
  "permissions": ["read", "write"],
  "lastUsed": "2025-04-22T10:15:00Z",
  "createdAt": "2025-01-20T14:30:00Z",
  "usage": {
    "requestsThisMonth": 850,
    "tokensThisMonth": 42500,
    "costThisMonth": 0.85
  }
}
```

### Create API Key

Create a new API key for a user.

**Request:**
```http
POST /admin/api-keys
Content-Type: application/json

{
  "userId": "user_123",
  "name": "New API Key",
  "permissions": ["read", "write"]
}
```

**Response:**
```json
{
  "id": "key_789",
  "key": "nr_7890abcdef1234567890abcdef123456",
  "name": "New API Key",
  "userId": "user_123",
  "userName": "John Doe",
  "status": "active",
  "permissions": ["read", "write"],
  "createdAt": "2025-04-22T15:40:00Z",
  "message": "Store this API key securely. It won't be shown again."
}
```

### Revoke API Key

Revoke an existing API key.

**Request:**
```http
DELETE /admin/api-keys/:id
```

**Response:**
```json
{
  "success": true,
  "message": "API key revoked successfully"
}
```

## System Configuration

The System Configuration API allows you to view and update system settings.

### Get Configuration

Retrieve the current system configuration.

**Request:**
```http
GET /admin/config
```

**Response:**
```json
{
  "system": {
    "name": "NeuroRoute",
    "version": "1.0.0",
    "environment": "production",
    "maintenanceMode": false
  },
  "rate_limiting": {
    "enabled": true,
    "defaultLimit": 100,
    "defaultWindow": 60000,
    "promptLimit": 20,
    "promptWindow": 60000,
    "adminLimit": 50,
    "adminWindow": 60000
  },
  "caching": {
    "enabled": true,
    "ttl": 300,
    "byUser": false
  },
  "models": {
    "defaultModel": "gpt-3.5-turbo",
    "enabledModels": ["gpt-3.5-turbo", "gpt-4", "claude-3-opus", "claude-3-sonnet"]
  },
  "monitoring": {
    "metricsEnabled": true,
    "loggingLevel": "info",
    "alertingEnabled": true
  }
}
```

### Update Configuration

Update the system configuration.

**Request:**
```http
PUT /admin/config
Content-Type: application/json

{
  "system": {
    "maintenanceMode": true
  },
  "rate_limiting": {
    "defaultLimit": 120,
    "promptLimit": 30
  },
  "caching": {
    "ttl": 600
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Configuration updated successfully",
  "config": {
    "system": {
      "name": "NeuroRoute",
      "version": "1.0.0",
      "environment": "production",
      "maintenanceMode": true
    },
    "rate_limiting": {
      "enabled": true,
      "defaultLimit": 120,
      "defaultWindow": 60000,
      "promptLimit": 30,
      "promptWindow": 60000,
      "adminLimit": 50,
      "adminWindow": 60000
    },
    "caching": {
      "enabled": true,
      "ttl": 600,
      "byUser": false
    },
    "models": {
      "defaultModel": "gpt-3.5-turbo",
      "enabledModels": ["gpt-3.5-turbo", "gpt-4", "claude-3-opus", "claude-3-sonnet"]
    },
    "monitoring": {
      "metricsEnabled": true,
      "loggingLevel": "info",
      "alertingEnabled": true
    }
  }
}
```

## Monitoring and Statistics

The Monitoring API provides access to system metrics and usage statistics.

### System Health

Check the overall system health.

**Request:**
```http
GET /admin/health
```

**Response:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "2025-04-22T15:45:00Z",
  "uptime": 1209600,
  "services": {
    "database": "ok",
    "cache": "ok",
    "models": {
      "openai": "ok",
      "anthropic": "ok",
      "lmstudio": "ok"
    }
  },
  "memory": {
    "rss": 125829120,
    "heapTotal": 64225280,
    "heapUsed": 51621408,
    "external": 1605632
  },
  "cpu": {
    "loadAvg": [0.25, 0.17, 0.12],
    "usage": 2.5
  }
}
```

### System Metrics

Retrieve detailed system metrics.

**Request:**
```http
GET /admin/metrics
```

**Response:**
```json
{
  "requests": {
    "total": 125000,
    "success": 123500,
    "error": 1500,
    "avgResponseTime": 120,
    "p95ResponseTime": 350,
    "p99ResponseTime": 750
  },
  "models": {
    "gpt-3.5-turbo": {
      "requests": 75000,
      "tokens": 3750000,
      "cost": 7.5
    },
    "gpt-4": {
      "requests": 25000,
      "tokens": 1250000,
      "cost": 25.0
    },
    "claude-3-opus": {
      "requests": 15000,
      "tokens": 750000,
      "cost": 22.5
    },
    "claude-3-sonnet": {
      "requests": 10000,
      "tokens": 500000,
      "cost": 10.0
    }
  },
  "cache": {
    "hits": 45000,
    "misses": 80000,
    "hitRate": 0.36,
    "size": 512000000
  },
  "database": {
    "queries": 250000,
    "avgQueryTime": 5,
    "slowQueries": 125
  },
  "memory": {
    "usage": 125829120,
    "peak": 150000000
  }
}
```

### Usage Statistics

Retrieve usage statistics for a specific time period.

**Request:**
```http
GET /admin/stats
```

**Query Parameters:**
- `period` (optional): Time period ("day", "week", "month", "year", default: "month")
- `start` (optional): Start date (ISO format)
- `end` (optional): End date (ISO format)

**Response:**
```json
{
  "period": {
    "start": "2025-03-23T00:00:00Z",
    "end": "2025-04-22T23:59:59Z"
  },
  "requests": {
    "total": 125000,
    "byDay": [
      { "date": "2025-03-23", "count": 4200 },
      { "date": "2025-03-24", "count": 4150 },
      // ... more days
      { "date": "2025-04-22", "count": 4300 }
    ]
  },
  "tokens": {
    "total": 6250000,
    "byDay": [
      { "date": "2025-03-23", "count": 210000 },
      { "date": "2025-03-24", "count": 207500 },
      // ... more days
      { "date": "2025-04-22", "count": 215000 }
    ]
  },
  "cost": {
    "total": 65.0,
    "byDay": [
      { "date": "2025-03-23", "amount": 2.1 },
      { "date": "2025-03-24", "amount": 2.075 },
      // ... more days
      { "date": "2025-04-22", "amount": 2.15 }
    ]
  },
  "topUsers": [
    { "userId": "user_123", "name": "John Doe", "requests": 12500, "tokens": 625000, "cost": 6.5 },
    { "userId": "user_456", "name": "Jane Smith", "requests": 10000, "tokens": 500000, "cost": 5.0 },
    // ... more users
  ],
  "topModels": [
    { "model": "gpt-3.5-turbo", "requests": 75000, "tokens": 3750000, "cost": 7.5 },
    { "model": "gpt-4", "requests": 25000, "tokens": 1250000, "cost": 25.0 },
    // ... more models
  ]
}
```

## Model Management

The Model Management API allows you to configure and manage LLM models.

### List Models

Retrieve a list of all available models.

**Request:**
```http
GET /admin/models
```

**Response:**
```json
{
  "models": [
    {
      "id": "gpt-3.5-turbo",
      "name": "GPT-3.5 Turbo",
      "provider": "openai",
      "capabilities": ["chat", "function_calling"],
      "maxTokens": 16385,
      "status": "available",
      "costPer1kTokens": {
        "input": 0.0015,
        "output": 0.002
      }
    },
    {
      "id": "gpt-4",
      "name": "GPT-4",
      "provider": "openai",
      "capabilities": ["chat", "function_calling", "vision"],
      "maxTokens": 8192,
      "status": "available",
      "costPer1kTokens": {
        "input": 0.03,
        "output": 0.06
      }
    },
    {
      "id": "claude-3-opus",
      "name": "Claude 3 Opus",
      "provider": "anthropic",
      "capabilities": ["chat", "vision"],
      "maxTokens": 200000,
      "status": "available",
      "costPer1kTokens": {
        "input": 0.015,
        "output": 0.075
      }
    }
  ]
}
```

### Get Model

Retrieve details for a specific model.

**Request:**
```http
GET /admin/models/:id
```

**Response:**
```json
{
  "id": "gpt-4",
  "name": "GPT-4",
  "provider": "openai",
  "capabilities": ["chat", "function_calling", "vision"],
  "maxTokens": 8192,
  "status": "available",
  "costPer1kTokens": {
    "input": 0.03,
    "output": 0.06
  },
  "usage": {
    "requestsThisMonth": 25000,
    "tokensThisMonth": 1250000,
    "costThisMonth": 25.0
  },
  "configuration": {
    "enabled": true,
    "priority": 2,
    "defaultTemperature": 0.7,
    "defaultMaxTokens": 1024
  }
}
```

### Update Model

Update a model's configuration.

**Request:**
```http
PUT /admin/models/:id
Content-Type: application/json

{
  "status": "available",
  "configuration": {
    "enabled": true,
    "priority": 1,
    "defaultTemperature": 0.5,
    "defaultMaxTokens": 2048
  }
}
```

**Response:**
```json
{
  "id": "gpt-4",
  "name": "GPT-4",
  "provider": "openai",
  "capabilities": ["chat", "function_calling", "vision"],
  "maxTokens": 8192,
  "status": "available",
  "costPer1kTokens": {
    "input": 0.03,
    "output": 0.06
  },
  "configuration": {
    "enabled": true,
    "priority": 1,
    "defaultTemperature": 0.5,
    "defaultMaxTokens": 2048
  }
}
```

### Test Model

Test a model with a sample prompt.

**Request:**
```http
POST /admin/models/:id/test
Content-Type: application/json

{
  "prompt": "Explain quantum computing in simple terms",
  "temperature": 0.7,
  "maxTokens": 100
}
```

**Response:**
```json
{
  "id": "resp_123456",
  "model": "gpt-4",
  "response": "Quantum computing is like having a super-fast calculator that can try many answers at once. Regular computers use bits (0s and 1s), but quantum computers use 'qubits' that can be 0, 1, or both at the same time - like being in two places at once. This lets them solve certain problems much faster than regular computers.",
  "promptTokens": 8,
  "completionTokens": 62,
  "totalTokens": 70,
  "processingTime": 1250
}
```

## Troubleshooting

### Common Issues

#### Authentication Errors

- Ensure you're using an admin-level API key
- Check that the API key is active and not revoked
- Verify the API key is included in the `X-API-Key` header

#### Rate Limiting

Admin endpoints have rate limits to prevent abuse. If you receive a 429 Too Many Requests response, wait before making additional requests.

#### Maintenance Mode

When the system is in maintenance mode, some endpoints may be unavailable. Check the system configuration to see if maintenance mode is enabled.

### Error Responses

All error responses follow this format:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Detailed error message"
}
```

Common error codes:
- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Missing or invalid API key
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

### Getting Help

If you encounter issues not covered in this guide, contact support at support@example.com or open an issue on the GitHub repository.