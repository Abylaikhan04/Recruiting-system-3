#!/bin/sh
set -e

cd /var/www

# Ensure .env exists
if [ ! -f .env ]; then
    cp .env.example .env
fi

# Install deps if vendor missing
if [ ! -d vendor ]; then
    composer install --no-interaction --prefer-dist --optimize-autoloader
fi

# Generate app key if missing
if ! grep -q "^APP_KEY=base64" .env; then
    php artisan key:generate --force
fi

# Wait for the database
echo "Waiting for database..."
until php artisan migrate:status >/dev/null 2>&1; do
    php artisan migrate --force >/dev/null 2>&1 || true
    sleep 3
done

# Run migrations + seed
php artisan migrate --force
php artisan db:seed --force || true

exec "$@"
