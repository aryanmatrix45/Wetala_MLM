# ==============================================================================
# Production Dockerfile for Frontend (React + Vite + TypeScript)
# ==============================================================================

# --- Stage 1: Build Static Assets ---
FROM node:20-alpine AS builder

WORKDIR /app

# Build arguments for Vite environment variables
ARG VITE_API_BASE_URL=http://localhost:5000/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

ARG VITE_APP_TITLE="Wetala - MLM Admin Portal"
ENV VITE_APP_TITLE=$VITE_APP_TITLE

# Copy dependency definition
COPY package.json ./

# Install dependencies
RUN npm install

# Copy source and configuration files
COPY tsconfig*.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src

# Build static production assets into /app/dist
RUN npm run build

# --- Stage 2: Serve via Nginx ---
FROM nginx:alpine AS runner

# Remove default nginx welcome page
RUN rm -rf /usr/share/nginx/html/*

# Copy custom nginx configuration for SPA routing & caching
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose web server port
EXPOSE 80

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:80/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]

