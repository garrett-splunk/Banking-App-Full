FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
COPY packages/shared/package.json packages/shared/
COPY services/credit-card-service/package.json services/credit-card-service/
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY services/credit-card-service services/credit-card-service
RUN npm install
RUN npm run build -w @banking/shared
RUN npm run prisma:generate -w @banking/credit-card-service
RUN npm run build -w @banking/credit-card-service

FROM node:20-alpine
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/services/credit-card-service/dist ./services/credit-card-service/dist
COPY --from=builder /app/services/credit-card-service/package.json ./services/credit-card-service/
COPY --from=builder /app/services/credit-card-service/prisma ./services/credit-card-service/prisma
USER nodejs
WORKDIR /app/services/credit-card-service
ENV NODE_ENV=production
EXPOSE 3005
HEALTHCHECK CMD wget -qO- http://localhost:3005/health || exit 1
CMD ["sh", "-c", "npx prisma db push && node -r @banking/shared/instrumentation dist/index.js"]
