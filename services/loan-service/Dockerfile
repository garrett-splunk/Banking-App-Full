FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
COPY packages/shared/package.json packages/shared/
COPY services/loan-service/package.json services/loan-service/
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY services/loan-service services/loan-service
RUN npm install
RUN npm run build -w @banking/shared
RUN npm run prisma:generate -w @banking/loan-service
RUN npm run build -w @banking/loan-service

FROM node:20-alpine
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/services/loan-service/dist ./services/loan-service/dist
COPY --from=builder /app/services/loan-service/package.json ./services/loan-service/
COPY --from=builder /app/services/loan-service/prisma ./services/loan-service/prisma
USER nodejs
WORKDIR /app/services/loan-service
ENV NODE_ENV=production
EXPOSE 3006
HEALTHCHECK CMD wget -qO- http://localhost:3006/health || exit 1
CMD ["sh", "-c", "npx prisma db push && node -r @banking/shared/instrumentation dist/index.js"]
