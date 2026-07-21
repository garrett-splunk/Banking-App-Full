FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
COPY packages/shared/package.json packages/shared/
COPY services/api-gateway/package.json services/api-gateway/
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY services/api-gateway services/api-gateway
RUN npm install
RUN npm run build -w @banking/shared
RUN npm run build -w @banking/api-gateway

FROM node:20-alpine
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/services/api-gateway/dist ./services/api-gateway/dist
COPY --from=builder /app/services/api-gateway/package.json ./services/api-gateway/
USER nodejs
WORKDIR /app/services/api-gateway
ENV NODE_ENV=production
EXPOSE 8080
HEALTHCHECK CMD wget -qO- http://localhost:8080/health || exit 1
CMD ["node", "-r", "@banking/shared/instrumentation", "dist/index.js"]
