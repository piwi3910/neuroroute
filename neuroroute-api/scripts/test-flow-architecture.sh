#!/bin/bash

# Test script for the flow architecture
# This script will send test requests to the API to verify the flow architecture is working correctly

echo "Testing NeuroRoute API Flow Architecture"
echo "========================================"
echo

# Check if the API is running
if ! curl -s http://localhost:3000/health > /dev/null; then
  echo "Error: API is not running. Please start the API with 'npm run dev' first."
  exit 1
fi

echo "1. Testing health endpoint..."
curl -s http://localhost:3000/health | jq .
echo

echo "2. Testing prompt endpoint with basic prompt..."
curl -s -X POST http://localhost:3000/prompt \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Hello, how are you?",
    "temperature": 0.7,
    "max_tokens": 100
  }' | jq .
echo

echo "3. Testing prompt endpoint with complex prompt..."
curl -s -X POST http://localhost:3000/prompt \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Write a short poem about artificial intelligence and creativity.",
    "temperature": 0.8,
    "max_tokens": 200,
    "classifierOptions": {
      "detailed": true
    },
    "routingOptions": {
      "qualityOptimize": true
    }
  }' | jq .
echo

echo "4. Testing prompt endpoint with routing options..."
curl -s -X POST http://localhost:3000/prompt \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Explain quantum computing in simple terms.",
    "temperature": 0.5,
    "max_tokens": 300,
    "routingOptions": {
      "costOptimize": true,
      "fallbackEnabled": true
    }
  }' | jq .
echo

echo "Flow architecture testing complete!"