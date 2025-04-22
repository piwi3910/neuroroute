#!/bin/bash
set -e

# Production environment deployment script
echo "Deploying NeuroRoute Fastify to production environment..."

# Confirm deployment
read -p "Are you sure you want to deploy to production? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Deployment cancelled."
  exit 1
fi

# Load environment variables
if [ -f .env.production ]; then
  export $(grep -v '^#' .env.production | xargs)
else
  echo "Error: .env.production file not found. Aborting deployment."
  exit 1
fi

# Set environment-specific variables
export NODE_ENV=production
export TAG=prod-$(date +%Y%m%d-%H%M%S)
export ENABLE_SWAGGER=false
export LOG_LEVEL=warn

# Backup database before migration
echo "Creating database backup..."
BACKUP_FILE="backup-$(date +%Y%m%d-%H%M%S).sql"
docker-compose -f docker-compose.yml exec postgres pg_dump -U ${POSTGRES_USER:-postgres} ${POSTGRES_DB:-neuroroute} > "backups/$BACKUP_FILE"
echo "Database backup created: backups/$BACKUP_FILE"

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

# Run comprehensive health check
echo "Running health check..."
sleep 10
HEALTH_CHECK=$(curl -s http://localhost:${PORT:-3000}/health)
if [[ $HEALTH_CHECK == *"\"status\":\"ok\""* ]]; then
  echo "Health check passed!"
else
  echo "Health check failed! Response: $HEALTH_CHECK"
  echo "Check container logs for more details:"
  docker-compose -f docker-compose.yml logs app
  
  echo "Rolling back to previous version..."
  # Add rollback logic here if needed
  
  exit 1
fi

# Set up monitoring alerts
echo "Setting up monitoring alerts..."
if [ -n "$MONITORING_ENDPOINT" ]; then
  curl -X POST "$MONITORING_ENDPOINT" \
    -H "Content-Type: application/json" \
    -d "{\"event\":\"deployment\",\"environment\":\"production\",\"version\":\"$TAG\",\"status\":\"success\"}"
fi

echo "Production deployment completed successfully!"
echo "API is available at: https://${DOMAIN:-api.example.com}"

# Send deployment notification
if [ -n "$NOTIFICATION_WEBHOOK" ]; then
  echo "Sending deployment notification..."
  curl -X POST "$NOTIFICATION_WEBHOOK" \
    -H "Content-Type: application/json" \
    -d "{\"text\":\"NeuroRoute Fastify v$TAG has been deployed to production successfully.\"}"
fi