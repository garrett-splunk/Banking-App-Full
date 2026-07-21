FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
COPY packages/shared/package.json packages/shared/
COPY services/account-service/package.json services/account-service/
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY services/account-service services/account-service
RUN npm install
RUN npm run build -w @banking/shared
RUN npm run prisma:generate -w @banking/account-service
RUN npm run build -w @banking/account-service

FROM node:20-alpine
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/services/account-service/dist ./services/account-service/dist
COPY --from=builder /app/services/account-service/package.json ./services/account-service/
COPY --from=builder /app/services/account-service/prisma ./services/account-service/prisma
USER nodejs
WORKDIR /app/services/account-service
ENV NODE_ENV=production
EXPOSE 3003
HEALTHCHECK CMD wget -qO- http://localhost:3003/health || exit 1
CMD ["sh", "-c", "npx prisma db push && node -r @banking/shared/instrumentation dist/index.js"]
