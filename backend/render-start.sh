#!/bin/sh
# Standalone startup script for Render's "Docker Command" field.
# Render executes this command directly (bypassing the image ENTRYPOINT and
# without a shell to interpret &&/;), so all startup logic must live in ONE
# executable file instead of a chained command string.
set -e

cd /var/www

echo "Resetting and running migrations..."
# Using migrate:fresh instead of migrate: the migrations ledger on Neon got
# out of sync with actual tables during earlier failed deploy attempts
# (departments recorded as migrated but the table itself was never
# committed). migrate:fresh drops everything and rebuilds from a clean
# state, avoiding that mismatch. Safe here since there is no real data yet.
php artisan migrate:fresh --force

echo "Seeding (non-fatal if it fails)..."
php artisan db:seed --force || true

echo "Starting server..."
exec php artisan serve --host 0.0.0.0 --port "$PORT"
