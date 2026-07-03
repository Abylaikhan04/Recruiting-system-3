#!/bin/sh
# Standalone startup script for Render's "Docker Command" field.
# Render executes this command directly (bypassing the image ENTRYPOINT and
# without a shell to interpret &&/;), so all startup logic must live in ONE
# executable file instead of a chained command string.
set -e

cd /var/www

echo "Running migrations..."
php artisan migrate --force

echo "Seeding (non-fatal if it fails)..."
php artisan db:seed --force || true

echo "Starting server..."
exec php artisan serve --host 0.0.0.0 --port "$PORT"
