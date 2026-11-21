# Frontend Dockerfile for Next.js App
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Set environment variables for build time
ENV NEXT_TELEMETRY_DISABLED 1
ENV BACKEND_URL http://backend-service.shree-pooja.svc.cluster.local:3001

RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["npm", "start"]
