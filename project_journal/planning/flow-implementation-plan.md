# NeuroRoute Flow Architecture Implementation Plan

## Overview

This plan outlines the steps to implement the new flow architecture for the NeuroRoute API. The architecture follows a pipeline approach:

1. Frontend API → 2. Preprocessor → 3. Classifier → 4. Routing Engine → 5. Normalization Engine → 6. Backend API

## Current State Analysis

Based on code review, the current flow is:
- Prompt arrives at Frontend API (prompt.ts route)
- Goes directly to the router service (router.ts)
- Router service uses the classifier service to classify the prompt
- Router service selects a model based on the classification and routing options
- Router service sends the prompt to the selected model

## Implementation Tasks

### Phase 1: Core Architecture Setup

1. **Create Preprocessor Service**
   - Implement basic structure with placeholder functionality
   - Create interfaces for preprocessor plugins
   - Implement sanitization as the first preprocessor

2. **Enhance Classifier Service**
   - Refactor to support pluggable classifier implementations
   - Keep current rules-based classifier as default
   - Add interface for future ML-based classifiers

3. **Refactor Router Service**
   - Split into routing engine and normalization engine
   - Implement pluggable routing strategies
   - Implement model-specific normalization

4. **Update Prompt Route**
   - Modify to use the new flow architecture
   - Add appropriate error handling and logging

### Phase 2: Testing and Documentation

1. **Create Unit Tests**
   - Test each component in isolation
   - Test the integration between components

2. **Update Integration Tests**
   - Modify existing tests to work with the new architecture
   - Add new tests for the complete flow

3. **Update Documentation**
   - Document the new architecture
   - Provide examples of how to extend each component

## Detailed Implementation Plan

### 1. Create Preprocessor Service

#### 1.1 Create Base Structure
- Create `src/services/preprocessor/index.ts` as the main entry point
- Define interfaces for preprocessor plugins
- Implement preprocessor registry

#### 1.2 Implement Basic Preprocessors
- Create sanitization preprocessor
- Add placeholder for prompt compression
- Add placeholder for prompt replacement

### 2. Enhance Classifier Service

#### 2.1 Refactor Classifier Interface
- Update `src/services/classifier.ts` to support pluggable classifiers
- Extract current rules-based logic into a separate implementation

#### 2.2 Prepare for Future Classifiers
- Add interface for ML-based classifiers
- Implement classifier registry

### 3. Refactor Router Service

#### 3.1 Split Router Functionality
- Create routing engine component
- Create normalization engine component
- Update router service to use these components

#### 3.2 Implement Routing Strategies
- Extract current routing logic into a rules-based strategy
- Add interfaces for future strategies (latency, cost, etc.)

#### 3.3 Implement Normalization
- Create model-specific normalizers
- Implement format conversion logic

### 4. Update Prompt Route

#### 4.1 Modify Route Handler
- Update to use the new flow architecture
- Add appropriate error handling

#### 4.2 Add Logging and Monitoring
- Add detailed logging throughout the flow
- Add performance metrics

### 5. Testing

#### 5.1 Unit Tests
- Create tests for each component
- Test edge cases and error handling

#### 5.2 Integration Tests
- Update existing tests
- Add new tests for the complete flow

### 6. Documentation

#### 6.1 Update API Documentation
- Document the new architecture
- Provide examples

#### 6.2 Create Developer Guide
- Document how to extend each component
- Provide examples of custom implementations