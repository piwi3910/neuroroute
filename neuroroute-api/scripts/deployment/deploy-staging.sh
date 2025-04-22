#!/bin/bash
set -e

# Staging environment deployment script
echo "Deploying NeuroRoute Fastify to staging environment..."

# Load environment variables
if [ -f .env.staging ]; then
  export $(grep -v '^#' .env.staging | xargs)
else
  echo "Warning: .env.staging file not found. Using default values."
fi

# Set environment-specific variables
export NODE_ENV=staging
export TAG=staging-$(date +%Y%m%d-%H%M%S)
export ENABLE_SWAGGER=true
export LOG_LEVEL=info

# Build and start the application
echo "Building and starting containers..."
docker-compose -f docker-compose.yml build
docker-compose -f docker-compose.yml up -d

# Run database migrations
echo "Running database migrations..."
docker-compose -f docker-compose.yml exec app npx prisma migrate deploy

# Run database seed (if needed)
if [ "$RUN_SEED" = "true" ]; then
  echo "Running database seed..."
  docker-compose -f docker-compose.yml exec app npx prisma db seed
fi

# Display container status
echo "Container status:"
docker-compose -f docker-compose.yml ps

# Run basic health check
echo "Running health check..."
sleep 5
HEALTH_CHECK=$(curl -s http://localhost:${PORT:-3000}/health)
if [[ $HEALTH_CHECK == *"\"status\":\"ok\""* ]]; then
  echo "Health check passed!"
else
  echo "Health check failed! Response: $HEALTH_CHECK"
  echo "Check container logs for more details:"
  docker-compose -f docker-compose.yml logs app
  exit 1
fi

echo "Staging deployment completed successfully!"
echo "API is available at: http://localhost:${PORT:-3000}"
echo "Swagger documentation is available at: http://localhost:${PORT:-3000}/documentation"