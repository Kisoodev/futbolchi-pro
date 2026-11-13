# API server (Fastify + Telegram bot) for a host that keeps it running and
# gives it a disk: Railway, Render, Fly.io or any VPS with Docker.
# The game page itself is deployed on Vercel (see vercel.json).
FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/engine/package.json packages/engine/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci --no-audit --no-fund

COPY tsconfig.base.json ./
COPY packages/engine packages/engine
COPY apps/server apps/server

# Mount a persistent volume at /data: players, payments and receipt images live there.
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8787 DATA_DIR=/data
EXPOSE 8787
CMD ["npm", "-w", "@futbolchi/server", "run", "start"]
