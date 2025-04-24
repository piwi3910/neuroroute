#!/bin/bash

# Test script for NeuroRoute API flow architecture
# This script tests various endpoints to verify the flow architecture is working correctly

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

# Test 1: Health check endpoint
echo -e "${YELLOW}Test 1: Health check endpoint${NC}"
HEALTH_RESPONSE=$(curl -s "${BASE_URL}/health")
if [[ $HEALTH_RESPONSE == *"status"* && $HEALTH_RESPONSE == *"ok"* ]]; then
  echo -e "${GREEN}✓ Health check endpoint is working${NC}"
else
  echo -e "${RED}✗ Health check endpoint failed${NC}"
  echo "Response: $HEALTH_RESPONSE"
fi
echo ""

# Test 2: Simple prompt classification
echo -e "${YELLOW}Test 2: Simple prompt classification${NC}"
PROMPT_RESPONSE=$(curl -s -X POST "${BASE_URL}/prompt" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is the capital of France?", "model": "gpt-3.5-turbo"}')

if [[ $PROMPT_RESPONSE == *"classification"* ]]; then
  echo -e "${GREEN}✓ Prompt classification is working${NC}"
  echo "Classification: $(echo $PROMPT_RESPONSE | grep -o '"type":"[^"]*"' | cut -d'"' -f4)"
else
  echo -e "${RED}✗ Prompt classification failed${NC}"
  echo "Response: $PROMPT_RESPONSE"
fi
echo ""

# Test 3: Code-related prompt classification
echo -e "${YELLOW}Test 3: Code-related prompt classification${NC}"
PROMPT_RESPONSE=$(curl -s -X POST "${BASE_URL}/prompt" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Write a function in JavaScript to calculate the Fibonacci sequence", "model": "gpt-3.5-turbo"}')

if [[ $PROMPT_RESPONSE == *"classification"* ]]; then
  echo -e "${GREEN}✓ Code prompt classification is working${NC}"
  echo "Classification: $(echo $PROMPT_RESPONSE | grep -o '"type":"[^"]*"' | cut -d'"' -f4)"
else
  echo -e "${RED}✗ Code prompt classification failed${NC}"
  echo "Response: $PROMPT_RESPONSE"
fi
echo ""

# Test 4: Creative prompt classification
echo -e "${YELLOW}Test 4: Creative prompt classification${NC}"
PROMPT_RESPONSE=$(curl -s -X POST "${BASE_URL}/prompt" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Write a poem about the sunset over the ocean", "model": "gpt-3.5-turbo"}')

if [[ $PROMPT_RESPONSE == *"classification"* ]]; then
  echo -e "${GREEN}✓ Creative prompt classification is working${NC}"
  echo "Classification: $(echo $PROMPT_RESPONSE | grep -o '"type":"[^"]*"' | cut -d'"' -f4)"
else
  echo -e "${RED}✗ Creative prompt classification failed${NC}"
  echo "Response: $PROMPT_RESPONSE"
fi
echo ""

# Test 5: Model adapter registry access
echo -e "${YELLOW}Test 5: Model adapter registry access${NC}"
MODELS_RESPONSE=$(curl -s "${BASE_URL}/models")
if [[ $MODELS_RESPONSE == *"models"* ]]; then
  echo -e "${GREEN}✓ Model adapter registry is accessible${NC}"
  echo "Available models: $(echo $MODELS_RESPONSE | grep -o '"models":\[[^]]*\]' | cut -d'[' -f2 | cut -d']' -f1)"
else
  echo -e "${RED}✗ Model adapter registry access failed${NC}"
  echo "Response: $MODELS_RESPONSE"
fi
echo ""

echo -e "${YELLOW}Flow Architecture Testing Complete${NC}"
echo "=================================================="