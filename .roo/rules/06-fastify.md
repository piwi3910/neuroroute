🏗 Project Setup
	•	Always use the latest Fastify version (unless project constraints specify otherwise).
	•	Organize the project modularly using folders like:

├── plugins/
├── routes/
├── schemas/
├── controllers/
├── services/
└── utils/


	•	Initialize with fastify-cli if scaffolding a full app, but code should work standalone too:

npm init fastify



⸻

📄 Route Definition Rules
	•	Use .register() to load routes modularly:

fastify.register(import('./routes/userRoutes'), { prefix: '/users' })


	•	Always define routes in separate files:
	•	File: routes/userRoutes.ts
	•	Route handler: controllers/userController.ts
	•	Use schema-based validation (via Zod, JSON Schema, or TypeBox) for request body, params, query, and headers.

⸻

🧪 Validation & Serialization
	•	Define and apply input/output schemas:

const userSchema = {
  body: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string' },
    },
  },
}

fastify.post('/users', { schema: userSchema }, handler)


	•	Use Fastify’s built-in schema validation, not manual checks.
	•	Avoid disabling validation unless explicitly necessary.

⸻

🔐 Security Rules
	•	Do not use eval, new Function, or other dynamic code constructs.
	•	Use fastify-helmet for HTTP headers hardening.
	•	Use fastify-jwt or fastify-auth for authentication, never write your own token logic.
	•	Rate limit sensitive routes with fastify-rate-limit.

⸻

🧰 Plugin Management
	•	Write reusable logic as Fastify plugins (e.g., DB connectors, auth handlers).
	•	Register them in the plugins/ folder using .decorate and .decorateRequest for context.
Example:

fastify.decorate('someUtility', () => { ... })



⸻

🗃 Database Access
	•	Use async/await, never .then() chaining.
	•	Wrap DB access in a service/ layer, not in route handlers directly.
	•	Decorate the Fastify instance with the DB client using .decorate.

⸻

📜 Logging
	•	Use Fastify’s native logger (fastify.log).
	•	Avoid console.log unless debugging in development.
	•	Log request/response data in a structured format for observability.

⸻

🧼 Error Handling
	•	Always use fastify.setErrorHandler() for custom error responses.
	•	Use http-errors or standard Boom errors, not custom objects.
Example:

import createError from 'http-errors'
throw new createError.BadRequest('Missing user ID')



⸻

🔄 Request Lifecycle
	•	Prefer hooks like onRequest, preHandler, and onSend for:
	•	Auth
	•	Logging
	•	Input transformation
	•	Avoid bloating the route handler logic.

⸻

🔍 Testing
	•	Use tap, vitest, or jest for route and plugin testing.
	•	Write tests for:
	•	Schema validation
	•	Auth flows
	•	Error scenarios
	•	Plugin behavior

⸻

🧠 AI-Specific Tips
	•	Always include schemas for validation.
	•	Never write routes without a clear prefix and file/module separation.
	•	Automatically register routes and plugins using autoLoad if requested.
	•	Use named async functions, not anonymous ones.
	•	Apply proper typing with @fastify/typescript where applicable.