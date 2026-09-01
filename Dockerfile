# CineAgent Studio - Production Dockerfile for Render Free Web Service & Cloud Run
# Single-Service Container (Node.js Express Gateway + Built React Frontend + Python mcp-clickhouse)

# Stage 1: Build React Frontend
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: Runtime Container
FROM node:20-slim

# Install Python 3, pip, and system runtime utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt-get/lists/*

# Create python symlink
RUN ln -s /usr/bin/python3 /usr/bin/python

# Install official mcp-clickhouse PyPI package for StdioClientTransport
RUN pip3 install --no-cache-dir --break-system-packages mcp-clickhouse

WORKDIR /app

# Copy backend dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy backend source code and compiled React frontend dist
COPY server/ ./server/
COPY docs/ ./docs/
COPY --from=client-builder /app/client/dist ./client/dist

# Production Environment Defaults
ENV NODE_ENV=production
ENV PORT=8080
ENV CINEAGENT_DEMO_MODE=false
ENV GEMINI_MODEL=gemini-3.1-flash-lite

EXPOSE 8080

CMD ["node", "server/index.js"]
