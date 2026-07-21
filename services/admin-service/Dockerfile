FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
COPY packages/shared/package.json packages/shared/
COPY services/admin-service/package.json services/admin-service/
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY services/admin-service services/admin-service
RUN npm install
RUN npm run build -w @banking/shared
RUN npm run prisma:generate -w @banking/admin-service
RUN npm run build -w @banking/admin-service

FROM node:20-alpine
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/services/admin-service/dist ./services/admin-service/dist
COPY --from=builder /app/services/admin-service/package.json ./services/admin-service/
COPY --from=builder /app/services/admin-service/prisma ./services/admin-service/prisma
USER nodejs
WORKDIR /app/services/admin-service
ENV NODE_ENV=production
EXPOSE 3009
HEALTHCHECK CMD wget -qO- http://localhost:3009/health || exit 1
CMD ["sh", "-c", "npx prisma db push && node -r @banking/shared/instrumentation dist/index.js"]
