FROM node:22-alpine

WORKDIR /app

COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm ci || npm install

COPY server ./server
COPY web-root ./web-root

RUN cd server && npm run build

ENV PORT=80
ENV RYANMUSIC_LISTEN=0.0.0.0
ENV RYANMUSIC_WEB_ROOT=/app/web-root
ENV RYANMUSIC_CACHE_DIR=/app/web-root/core/cache

EXPOSE 80
CMD ["node", "/app/server/dist/server.mjs", "--listen", "0.0.0.0", "--port", "80", "--web-root", "/app/web-root"]
