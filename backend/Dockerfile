# =============================================================
# Stage 1 – PHP dependencies (Composer)
# =============================================================
FROM composer:2.7 AS deps

WORKDIR /app

COPY composer.json composer.lock* ./

RUN composer install \
    --no-dev \
    --no-interaction \
    --prefer-dist \
    --optimize-autoloader \
    --no-scripts

# =============================================================
# Stage 2 – Production runtime
# =============================================================
FROM php:8.3-fpm AS production

# Install all extensions via apt — pre-compiled binaries, no source compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq-dev \
        libzip-dev \
        libonig-dev \
        unzip \
    && docker-php-ext-install \
        pdo_pgsql pgsql mbstring pcntl bcmath zip \
    && rm -rf /var/lib/apt/lists/*

# Unprivileged application user
RUN groupadd -g 1001 www && useradd -u 1001 -g www -s /bin/sh -M www

# Composer binary (needed in dev: volume mount wipes the build-stage vendor)
COPY --from=deps /usr/bin/composer /usr/bin/composer

# Align php-fpm worker pool with our app user
RUN sed -i \
        -e 's/^user = .*/user = www/' \
        -e 's/^group = .*/group = www/' \
        /usr/local/etc/php-fpm.d/www.conf

WORKDIR /var/www

# Copy vendor from the deps stage
COPY --from=deps --chown=www:www /app/vendor ./vendor

# Copy application source
COPY --chown=www:www . .

# Ensure writable directories exist with correct permissions
RUN mkdir -p \
        storage/logs \
        storage/app/public \
        storage/framework/cache/data \
        storage/framework/sessions \
        storage/framework/testing \
        storage/framework/views \
        bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache \
    && chown -R www:www storage bootstrap/cache

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh \
    && chmod +x /usr/local/bin/docker-entrypoint.sh

# Standalone start script for hosts (e.g. Render) whose "Docker Command"
# field bypasses ENTRYPOINT and doesn't run the command through a shell.
COPY render-start.sh /usr/local/bin/render-start.sh
RUN sed -i 's/\r$//' /usr/local/bin/render-start.sh \
    && chmod +x /usr/local/bin/render-start.sh

EXPOSE 9000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["php-fpm"]
