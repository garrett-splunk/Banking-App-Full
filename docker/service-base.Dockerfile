# Shared service Dockerfile pattern - copy to each service
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
RUN npm install -w @banking/shared
RUN npm run build -w @banking/shared
