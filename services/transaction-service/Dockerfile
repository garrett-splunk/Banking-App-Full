FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
COPY packages/shared/package.json packages/shared/
COPY services/transaction-service/package.json services/transaction-service/
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY services/transaction-service services/transaction-service
RUN npm install
RUN npm run build -w @banking/shared
RUN npm run prisma:generate -w @banking/transaction-service
RUN npm run build -w @banking/transaction-service

FROM node:20-alpine
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/services/transaction-service/dist ./services/transaction-service/dist
COPY --from=builder /app/services/transaction-service/package.json ./services/transaction-service/
COPY --from=builder /app/services/transaction-service/prisma ./services/transaction-service/prisma
USER nodejs
WORKDIR /app/services/transaction-service
ENV NODE_ENV=production
EXPOSE 3004
HEALTHCHECK CMD wget -qO- http://localhost:3004/health || exit 1
CMD ["sh", "-c", "npx prisma db push && node -r @banking/shared/instrumentation dist/index.js"]
