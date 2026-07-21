FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
COPY packages/shared/package.json packages/shared/
COPY services/user-service/package.json services/user-service/
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY services/user-service services/user-service
RUN npm install
RUN npm run build -w @banking/shared
RUN npm run prisma:generate -w @banking/user-service
RUN npm run build -w @banking/user-service

FROM node:20-alpine
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/services/user-service/dist ./services/user-service/dist
COPY --from=builder /app/services/user-service/package.json ./services/user-service/
COPY --from=builder /app/services/user-service/prisma ./services/user-service/prisma
USER nodejs
WORKDIR /app/services/user-service
ENV NODE_ENV=production
EXPOSE 3002
HEALTHCHECK CMD wget -qO- http://localhost:3002/health || exit 1
CMD ["sh", "-c", "npx prisma db push && node -r @banking/shared/instrumentation dist/index.js"]
