FROM node:20-alpine AS backend-builder
WORKDIR /app/apps/backend
RUN apk add --no-cache python3 make g++
COPY apps/backend/package*.json ./
RUN npm ci
COPY apps/backend ./
RUN npm run build

FROM node:20-alpine AS frontend-builder
WORKDIR /app/apps/frontend
COPY apps/frontend/package*.json ./
RUN npm ci
COPY apps/frontend ./
RUN npx vite build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=10000 \
    FRONTEND_DIST_DIR=/app/public
COPY --from=backend-builder /app/apps/backend/node_modules ./node_modules
COPY --from=backend-builder /app/apps/backend/dist ./dist
COPY --from=backend-builder /app/apps/backend/package.json ./package.json
COPY --from=frontend-builder /app/apps/frontend/dist ./public
USER node
EXPOSE 10000
CMD ["sh", "-c", "if [ -f dist/main.js ]; then exec node dist/main.js; else exec node dist/src/main.js; fi"]
