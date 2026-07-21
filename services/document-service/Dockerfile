FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
COPY packages/shared/package.json packages/shared/
COPY services/document-service/package.json services/document-service/
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY services/document-service services/document-service
RUN npm install
RUN npm run build -w @banking/shared
RUN npm run prisma:generate -w @banking/document-service
RUN npm run build -w @banking/document-service

FROM node:20-alpine
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
RUN mkdir -p /app/uploads && chown nodejs:nodejs /app/uploads
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/services/document-service/dist ./services/document-service/dist
COPY --from=builder /app/services/document-service/package.json ./services/document-service/
COPY --from=builder /app/services/document-service/prisma ./services/document-service/prisma
USER nodejs
WORKDIR /app/services/document-service
ENV NODE_ENV=production
ENV UPLOAD_DIR=/app/uploads
EXPOSE 3007
HEALTHCHECK CMD wget -qO- http://localhost:3007/health || exit 1
CMD ["sh", "-c", "npx prisma db push && node -r @banking/shared/instrumentation dist/index.js"]
