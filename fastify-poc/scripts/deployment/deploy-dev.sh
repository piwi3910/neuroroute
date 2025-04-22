#!/bin/bash
set -e

# Development environment deployment script
echo "Deploying NeuroRoute Fastify to development environment..."

# Load environment variables
if [ -f .env.development ]; then
  export $(grep -v '^#' .env.development | xargs)
else
  echo "Warning: .env.development file not found. Using default values."
fi

# Set environment-specific variables
export NODE_ENV=development
export TAG=dev-$(date +%Y%m%d-%H%M%S)
export ENABLE_SWAGGER=true
export LOG_LEVEL=debug

# Build and start the application
echo "Building and starting containers..."
docker-compose -f docker-compose.yml build
docker-compose -f docker-compose.yml up -d

# Run database migrations
echo "Running database migrations..."
docker-compose -f docker-compose.yml exec app npx prisma migrate deploy

# Display container status
echo "Container status:"
docker-compose -f docker-compose.yml ps

echo "Development deployment completed successfully!"
echo "API is available at: http://localhost:${PORT:-3000}"
echo "Swagger documentation is available at: http://localhost:${PORT:-3000}/documentation"