#!/bin/bash

# Test script for the flow architecture
# This script sends various curl commands to test the flow architecture implementation

# Set the base URL
BASE_URL="http://localhost:3000"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Testing NeuroRoute API Flow Architecture${NC}"
echo "=================================================="
echo ""

# Function to make a request and display the result
make_request() {
  local endpoint=$1
  local method=$2
  local data=$3
  local description=$4

  echo -e "${YELLOW}Test: ${description}${NC}"
  echo "Endpoint: ${endpoint}"
  echo "Method: ${method}"
  echo "Data: ${data}"
  echo ""
  
  # Make the request
  if [ "$method" == "GET" ]; then
    response=$(curl -s -X GET "${BASE_URL}${endpoint}")
  else
    response=$(curl -s -X ${method} "${BASE_URL}${endpoint}" \
      -H "Content-Type: application/json" \
      -d "${data}")
  fi
  
  # Display the response
  echo "Response:"
  echo "${response}" | jq '.' || echo "${response}"
  echo ""
  
  # Check if the response contains an error
  if echo "${response}" | grep -q "error"; then
    echo -e "${RED}Test failed!${NC}"
  else
    echo -e "${GREEN}Test passed!${NC}"
  fi
  echo "=================================================="
  echo ""
}

# Test 1: Health check
make_request "/health" "GET" "" "Health check"

# Test 2: Basic prompt with default settings
make_request "/prompt" "POST" '{
  "prompt": "What is the capital of France?"
}' "Basic prompt with default settings"

# Test 3: Prompt with model override
make_request "/prompt" "POST" '{
  "prompt": "Explain quantum computing in simple terms",
  "model_id": "gpt-4-turbo-latest"
}' "Prompt with model override"

# Test 4: Prompt with routing options
make_request "/prompt" "POST" '{
  "prompt": "Write a function to calculate Fibonacci numbers",
  "routingOptions": {
    "qualityOptimize": true,
    "costOptimize": false,
    "latencyOptimize": false
  }
}' "Prompt with routing options"

# Test 5: Prompt with classifier options
make_request "/prompt" "POST" '{
  "prompt": "Create a React component for a login form",
  "classifierOptions": {
    "detailed": true,
    "prioritizeFeatures": ["code-generation"]
  }
}' "Prompt with classifier options"

# Test 6: Complex prompt with all options
make_request "/prompt" "POST" '{
  "prompt": "Design a database schema for an e-commerce application",
  "model_id": "claude-3-opus-20240229",
  "max_tokens": 2000,
  "temperature": 0.8,
  "classifierOptions": {
    "detailed": true,
    "prioritizeFeatures": ["database-design"]
  },
  "routingOptions": {
    "qualityOptimize": true,
    "costOptimize": false,
    "latencyOptimize": false,
    "cacheStrategy": "minimal"
  },
  "normalizationOptions": {
    "formatForModel": true,
    "preserveFormatting": true
  }
}' "Complex prompt with all options"

echo -e "${GREEN}All tests completed!${NC}"