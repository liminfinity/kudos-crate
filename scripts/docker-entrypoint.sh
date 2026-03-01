#!/bin/sh
set -e

echo "⏳ Waiting for database..."
until pg_isready -h "${DB_HOST:-db}" -p "${DB_PORT:-5432}" -U "${DB_USER:-postgres}" 2>/dev/null; do
  sleep 1
done
echo "✅ Database is ready"

# Run migrations if available
if [ -d "/app/supabase/migrations" ]; then
  echo "🔄 Running migrations..."
  for f in /app/supabase/migrations/*.sql; do
    echo "  → $(basename "$f")"
    PGPASSWORD="${DB_PASSWORD:-postgres}" psql -h "${DB_HOST:-db}" -U "${DB_USER:-postgres}" -d "${DB_NAME:-mira}" -f "$f" 2>/dev/null || true
  done
  echo "✅ Migrations complete"
fi

# Seed in dev mode
if [ "$NODE_ENV" = "development" ] && [ -f "/app/scripts/seed.sql" ]; then
  echo "🌱 Seeding database..."
  PGPASSWORD="${DB_PASSWORD:-postgres}" psql -h "${DB_HOST:-db}" -U "${DB_USER:-postgres}" -d "${DB_NAME:-mira}" -f /app/scripts/seed.sql || true
fi

echo "🚀 Starting application..."
exec "$@"
