# ADR: Migration from FastAPI to Fastify

**Status:** Proposed  
**Date:** 2025-04-22  
**Deciders:** Roo Commander, Technical Architect  

## Context

NeuroRoute is currently built with FastAPI, a Python web framework for building APIs. The application serves as an intelligent LLM routing layer that forwards prompts to the best-suited LLM backend based on intent, complexity, and required features.

We are considering migrating from FastAPI to Fastify, a Node.js web framework, to potentially improve performance and leverage the Node.js ecosystem.

## Decision Drivers

* Performance requirements for prompt routing
* Maintainability of the codebase
* Development velocity
* Team expertise and learning curve
* Ecosystem compatibility
* Future scalability needs

## Technical Assessment

The Technical Architect has provided a comprehensive assessment of the migration feasibility:

1. **Technical Feasibility**: The migration is technically feasible with moderate effort. The core functionality of both frameworks is compatible, and NeuroRoute's modular design makes it well-suited for migration.

2. **Performance Comparison**: Fastify offers superior performance (2-3x faster in benchmarks) compared to FastAPI, which could reduce latency in prompt routing, especially under high load.

3. **Migration Approach**: An incremental migration approach is recommended, starting with a proof of concept, then migrating core components, and finally completing the migration with optimization.

4. **Key Architectural Considerations**:
   - Restructuring to leverage Fastify's plugin system
   - Replacing Pydantic models with JSON Schema validation
   - Adapting lifecycle management and error handling
   - Implementing request ID tracking using Fastify hooks

5. **Potential Challenges**:
   - Language transition from Python to JavaScript/TypeScript
   - Finding equivalent Node.js libraries for Python dependencies
   - Adapting to differences in async/await implementation
   - Rebuilding the test suite with JavaScript testing tools
   - Translating complex Pydantic validation logic to JSON Schema
   - Adapting deployment pipelines for Node.js applications

6. **Suggested Tech Stack**:
   - Fastify (latest version)
   - TypeScript for type safety (confirmed priority)
   - Node.js (LTS version)
   - Prisma ORM with PostgreSQL for database access (confirmed preference)
   - Jest for testing (confirmed preference)
   - axios for HTTP requests (confirmed preference due to team familiarity)
   - pino for logging (Fastify's default)
   - Minimal essential plugins (only for functionality not in Fastify core):
     - @fastify/env - Environment variable loading and validation
     - @fastify/cors - CORS support
     - @fastify/redis - Redis integration for caching
     - @fastify/swagger - API documentation

## Decision

Based on the Technical Architect's assessment and team preferences, we have decided to proceed with the migration from FastAPI to Fastify using the following tech stack:

- **Language**: TypeScript (priority for type safety and maintainability)
- **Runtime**: Node.js (LTS version)
- **Web Framework**: Fastify (latest version)
- **ORM**: Prisma with PostgreSQL (for type-safe database access)
- **Testing**: Jest (for comprehensive test coverage)
- **HTTP Client**: axios (team familiarity is prioritized)
- **Logging**: pino (Fastify's default logger)
- **Minimal Essential Plugins**:
  - @fastify/env (environment variables)
  - @fastify/cors (CORS support)
  - @fastify/redis (caching)
  - @fastify/swagger (API documentation)

We will follow a lightweight MVP approach for the migration, leveraging Fastify's built-in functionality wherever possible and minimizing the use of plugins. We'll only use plugins for functionality that is essential and not provided by Fastify core. Additional plugins can be added later as needed after the core migration is complete and requirements evolve.

## Future Considerations

A Vite + React web application will be connected to this API in the future. While not part of the current migration scope, the following considerations should be kept in mind during the migration:

1. **CORS Configuration**: Ensure proper CORS setup to allow requests from the React frontend
2. **API Design**: Design endpoints and response formats that work well with React's data fetching patterns
3. **Real-time Capabilities**: Consider WebSocket support for potential real-time features
4. **Authentication Flow**: Implement authentication that works seamlessly with React applications
5. **Error Handling**: Provide consistent error responses that are easy to consume from React
6. **Documentation**: Ensure comprehensive API documentation for frontend developers

These considerations will influence architectural decisions during the migration, even though the React frontend implementation is not part of the current scope.

We will follow the incremental migration approach recommended by the Technical Architect, starting with a proof of concept implementation of core functionality.

Based on the Technical Architect's assessment, we need to decide whether to:

1. **Proceed with Migration**: Commit to migrating from FastAPI to Fastify
2. **Partial Migration**: Implement specific components in Fastify while maintaining the FastAPI core
3. **Maintain Current Stack**: Continue with FastAPI and focus on optimizing the current implementation

## Consequences

### If we proceed with migration:

**Positive:**
- Potential performance improvements, especially under high load
- Access to the Node.js ecosystem and its libraries
- Opportunity to refactor and improve the codebase

**Negative:**
- Significant development effort required
- Learning curve for team members not familiar with Node.js/TypeScript
- Potential for introducing new bugs during migration
- Temporary maintenance of two codebases during incremental migration

### If we maintain the current stack:

**Positive:**
- No disruption to current development
- Continued use of familiar tools and libraries
- Focus on feature development rather than migration

**Negative:**
- Miss potential performance improvements
- Continue with any existing limitations of the current stack

## Implementation Plan

If the decision is to proceed with migration, we will follow the incremental approach recommended by the Technical Architect:

1. **Phase 1: Preparation and Proof of Concept**
   - Create a parallel Fastify implementation of a subset of endpoints
   - Establish core architecture patterns
   - Develop a compatibility layer for shared business logic
   - Set up testing infrastructure

2. **Phase 2: Core Components Migration**
   - Migrate the main prompt routing endpoint
   - Implement schema validation using Fastify's JSON Schema
   - Create Fastify plugins for core functionality
   - Implement equivalent middleware functionality

3. **Phase 3: Complete Migration and Optimization**
   - Migrate remaining endpoints and functionality
   - Optimize for Fastify-specific performance improvements
   - Enhance error handling and logging
   - Complete test coverage and documentation

## References

- [Technical Architect Assessment](../tasks/TASK-CMD-20250422-173700.md)
- [Fastify Documentation](https://fastify.dev/docs/latest/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)