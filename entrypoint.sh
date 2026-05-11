#!/bin/sh
echo "Migrating database..."
cd /app/packages/db
npx prisma db push
echo "Starting application..."
exec "$@"