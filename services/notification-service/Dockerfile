FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
COPY packages/shared/package.json packages/shared/
COPY services/notification-service/package.json services/notification-service/
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY services/notification-service services/notification-service
RUN npm install
RUN npm run build -w @banking/shared
RUN npm run prisma:generate -w @banking/notification-service
RUN npm run build -w @banking/notification-service

FROM node:20-alpine
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/services/notification-service/dist ./services/notification-service/dist
COPY --from=builder /app/services/notification-service/package.json ./services/notification-service/
COPY --from=builder /app/services/notification-service/prisma ./services/notification-service/prisma
USER nodejs
WORKDIR /app/services/notification-service
ENV NODE_ENV=production
EXPOSE 3008
HEALTHCHECK CMD wget -qO- http://localhost:3008/health || exit 1
CMD ["sh", "-c", "npx prisma db push && node -r @banking/shared/instrumentation dist/index.js"]
