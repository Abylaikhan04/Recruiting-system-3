#!/bin/sh
set -e

# ── From here the process runs as root until php-fpm takes over ───────────
# php-fpm will drop to 'www' for worker processes via pool config.
cd /var/www

# Ensure .env exists
if [ ! -f .env ]; then
    [ -f .env.example ] || { echo "ERROR: .env.example not found" >&2; exit 1; }
    cp .env.example .env
fi

# Dev fallback: install Composer dependencies if vendor is absent
if [ ! -d vendor ]; then
    echo "Installing composer dependencies..."
    composer install --no-interaction --prefer-dist --optimize-autoloader
fi

# Generate application key on first boot
if ! grep -qE "^APP_KEY=base64:" .env; then
    echo "Generating application key..."
    php artisan key:generate --force
fi

# ── Wait for PostgreSQL ────────────────────────────────────────────────────
echo "Waiting for database..."
MAX_TRIES=30
i=0
until php -r "
    \$h = getenv('DB_HOST')     ?: 'db';
    \$p = getenv('DB_PORT')     ?: 5432;
    \$d = getenv('DB_DATABASE') ?: 'recruitflow';
    \$u = getenv('DB_USERNAME') ?: 'recruitflow';
    \$w = getenv('DB_PASSWORD') ?: '';
    try { new PDO(\"pgsql:host=\$h;port=\$p;dbname=\$d\", \$u, \$w); }
    catch (Exception \$e) { exit(1); }
" 2>/dev/null; do
    i=$((i + 1))
    [ "$i" -ge "$MAX_TRIES" ] && {
        echo "ERROR: database unavailable after ${MAX_TRIES} attempts." >&2
        exit 1
    }
    echo "  DB not ready (${i}/${MAX_TRIES}), retrying in 2s..."
    sleep 2
done
echo "Database ready."

# ── Migrations ────────────────────────────────────────────────────────────
echo "Running migrations..."
php artisan migrate --force

# Seed only if this is the first boot (errors are non-fatal)
php artisan db:seed --force 2>/dev/null || true

# Fix storage permissions for www worker
chown -R www:www storage bootstrap/cache 2>/dev/null || true

exec "$@"
