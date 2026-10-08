# ==============================================================================
# Production Dockerfile for Backend (Node.js + Express + TypeScript)
# ==============================================================================

# --- Stage 1: Build TypeScript Application ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency definition
COPY package.json ./

# Install all dependencies (including devDependencies required for tsc build)
RUN npm install

# Copy configuration and TypeScript source
COPY tsconfig.json ./
COPY src ./src

# Compile TypeScript to JavaScript in /app/dist
RUN npm run build

# --- Stage 2: Production Runtime ---
FROM node:20-alpine AS runner

# Install dumb-init for proper signal handling and PID 1 management
RUN apk add --no-cache dumb-init

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=5000

# Copy package definition
COPY package.json ./

# Install only production dependencies
RUN npm install --omit=dev && npm cache clean --force

# Copy compiled JavaScript output from builder stage
COPY --from=builder /app/dist ./dist

# Create uploads directory structure and set proper permissions
RUN mkdir -p /app/uploads/products && chown -R node:node /app

# Switch to unprivileged user for security
USER node

# Expose backend port
EXPOSE 5000

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:${PORT}/api/health || exit 1

# Start server using dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]

