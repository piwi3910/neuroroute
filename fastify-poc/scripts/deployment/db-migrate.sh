#!/bin/bash
set -e

# Database migration automation script
# Usage: ./db-migrate.sh [environment] [options]
# Example: ./db-migrate.sh production --create --name add_user_roles

# Default values
ENV="development"
ACTION="deploy"
NAME=""

# Parse arguments
if [ $# -ge 1 ]; then
  ENV=$1
  shift
fi

while [ $# -gt 0 ]; do
  case "$1" in
    --create)
      ACTION="create"
      shift
      ;;
    --deploy)
      ACTION="deploy"
      shift
      ;;
    --reset)
      ACTION="reset"
      shift
      ;;
    --name)
      NAME=$2
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Load environment variables
if [ -f .env.$ENV ]; then
  export $(grep -v '^#' .env.$ENV | xargs)
  echo "Loaded environment variables from .env.$ENV"
else
  echo "Warning: .env.$ENV file not found. Using default values."
fi

# Set environment-specific variables
export NODE_ENV=$ENV

echo "Running database migration for $ENV environment..."

case "$ACTION" in
  create)
    if [ -z "$NAME" ]; then
      echo "Error: Migration name is required for create action."
      echo "Usage: ./db-migrate.sh $ENV --create --name <migration_name>"
      exit 1
    fi
    echo "Creating migration: $NAME"
    npx prisma migrate dev --name $NAME
    ;;
  deploy)
    echo "Deploying pending migrations"
    npx prisma migrate deploy
    ;;
  reset)
    echo "WARNING: This will reset the database and lose all data!"
    read -p "Are you sure you want to continue? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      echo "Database reset cancelled."
      exit 1
    fi
    
    if [ "$ENV" = "production" ]; then
      echo "ERROR: Database reset is not allowed in production environment!"
      exit 1
    fi
    
    echo "Resetting database..."
    npx prisma migrate reset --force
    ;;
  *)
    echo "Unknown action: $ACTION"
    exit 1
    ;;
esac

# Generate Prisma client if needed
if [ "$GENERATE_CLIENT" = "true" ] || [ "$ACTION" = "create" ]; then
  echo "Generating Prisma client..."
  npx prisma generate
fi

echo "Database migration completed successfully!"

# Display database status
echo "Current database schema status:"
npx prisma migrate status