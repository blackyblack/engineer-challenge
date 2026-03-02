FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --production=false

COPY tsconfig.json ./
COPY proto/ ./proto/
COPY src/ ./src/

RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

COPY package.json package-lock.json ./
RUN npm ci --production && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY proto/ ./proto/
COPY migrations/ ./migrations/

USER appuser

EXPOSE 50051 9090

CMD ["node", "dist/src/index.js"]
