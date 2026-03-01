# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json bun.lockb package-lock.json* ./
RUN npm ci --ignore-scripts

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
RUN npm run build

# Stage 3: Production — serve with lightweight static server
FROM node:20-alpine AS runner
WORKDIR /app
RUN npm i -g serve@14
COPY --from=builder /app/dist ./dist

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["serve", "-s", "dist", "-l", "3000"]
