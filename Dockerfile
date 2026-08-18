FROM node:22-alpine

WORKDIR /app

COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm ci || npm install

COPY server ./server
COPY maicong-music ./maicong-music

RUN cd server && npm run build

ENV PORT=80
ENV RYANMUSIC_LISTEN=0.0.0.0
ENV RYANMUSIC_WEB_ROOT=/app/maicong-music
ENV RYANMUSIC_CACHE_DIR=/app/maicong-music/core/cache

EXPOSE 80
CMD ["node", "/app/server/dist/server.mjs", "--listen", "0.0.0.0", "--port", "80", "--web-root", "/app/maicong-music"]
