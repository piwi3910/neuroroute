#!/bin/bash

# Run Tests and Generate Summary Report
# This script runs all tests and generates a summary report

# Set colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create results directory if it doesn't exist
mkdir -p test-results

echo -e "${BLUE}=== NeuroRoute Fastify PoC Test Runner ===${NC}"
echo -e "${BLUE}Running all tests and generating summary report...${NC}"
echo ""

# Function to run tests and capture results
run_test() {
  local test_type=$1
  local command=$2
  local output_file="test-results/${test_type}-results.txt"
  
  echo -e "${YELLOW}Running ${test_type} tests...${NC}"
  
  # Run the test command and capture output
  npm run $command > $output_file 2>&1
  
  # Check if tests passed
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ ${test_type} tests passed${NC}"
    return 0
  else
    echo -e "${RED}✗ ${test_type} tests failed${NC}"
    return 1
  fi
}

# Run unit tests
unit_result=0
run_test "Unit" "test:unit"
unit_result=$?

# Run integration tests
integration_result=0
run_test "Integration" "test:integration"
integration_result=$?

# Run performance tests if both unit and integration tests pass
performance_result=0
if [ $unit_result -eq 0 ] && [ $integration_result -eq 0 ]; then
  echo -e "${YELLOW}Running performance tests...${NC}"
  echo -e "${YELLOW}Note: This requires both FastAPI and Fastify servers to be running${NC}"
  
  # Check if servers are running
  fastify_running=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health || echo "0")
  fastapi_running=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health || echo "0")
  
  if [ "$fastify_running" = "200" ] && [ "$fastapi_running" = "200" ]; then
    # Run performance tests
    npm run test:performance > test-results/performance-results.txt 2>&1
    if [ $? -eq 0 ]; then
      echo -e "${GREEN}✓ Performance tests completed${NC}"
      performance_result=0
    else
      echo -e "${RED}✗ Performance tests failed${NC}"
      performance_result=1
    fi
  else
    echo -e "${RED}✗ Cannot run performance tests - servers not running${NC}"
    echo -e "${YELLOW}  - Fastify server (localhost:3000): $([ "$fastify_running" = "200" ] && echo "Running" || echo "Not running")${NC}"
    echo -e "${YELLOW}  - FastAPI server (localhost:8000): $([ "$fastapi_running" = "200" ] && echo "Running" || echo "Not running")${NC}"
    echo -e "${YELLOW}  - Start servers and run 'npm run test:performance' manually${NC}"
    performance_result=1
  fi
else
  echo -e "${YELLOW}Skipping performance tests due to test failures${NC}"
  performance_result=1
fi

# Generate coverage report
echo -e "${YELLOW}Generating coverage report...${NC}"
npm run test:coverage > test-results/coverage-results.txt 2>&1
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Coverage report generated${NC}"
  coverage_result=0
else
  echo -e "${RED}✗ Coverage report generation failed${NC}"
  coverage_result=1
fi

# Generate summary report
echo ""
echo -e "${BLUE}=== Test Summary ===${NC}"
echo -e "Unit Tests: $([ $unit_result -eq 0 ] && echo "${GREEN}PASSED${NC}" || echo "${RED}FAILED${NC}")"
echo -e "Integration Tests: $([ $integration_result -eq 0 ] && echo "${GREEN}PASSED${NC}" || echo "${RED}FAILED${NC}")"
echo -e "Performance Tests: $([ $performance_result -eq 0 ] && echo "${GREEN}COMPLETED${NC}" || echo "${YELLOW}SKIPPED/FAILED${NC}")"
echo -e "Coverage Report: $([ $coverage_result -eq 0 ] && echo "${GREEN}GENERATED${NC}" || echo "${RED}FAILED${NC}")"
echo ""

# Show test result locations
echo -e "${BLUE}Test results saved to:${NC}"
echo -e "- Unit Tests: ${YELLOW}test-results/unit-results.txt${NC}"
echo -e "- Integration Tests: ${YELLOW}test-results/integration-results.txt${NC}"
echo -e "- Performance Tests: ${YELLOW}test-results/performance-results.txt${NC}"
echo -e "- Coverage Report: ${YELLOW}test-results/coverage-results.txt${NC}"
echo ""

# Show coverage report location if generated
if [ $coverage_result -eq 0 ]; then
  echo -e "${BLUE}Coverage report available at:${NC} ${YELLOW}coverage/lcov-report/index.html${NC}"
  echo ""
fi

# Overall result
if [ $unit_result -eq 0 ] && [ $integration_result -eq 0 ]; then
  echo -e "${GREEN}All critical tests passed!${NC}"
  exit 0
else
  echo -e "${RED}Some tests failed. Check the reports for details.${NC}"
  exit 1
fi