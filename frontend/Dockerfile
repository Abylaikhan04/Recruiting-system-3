# =============================================================
# Stage 1 – Build the React application
# =============================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (maximises layer-cache reuse)
COPY package.json package-lock.json* ./
RUN npm install --ignore-scripts

COPY . .

# VITE_API_URL is baked into the bundle at build time.
# Override via docker-compose build args or --build-arg.
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

# =============================================================
# Stage 2 – Serve the static bundle with nginx
# =============================================================
FROM nginx:1.27-alpine AS production

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
