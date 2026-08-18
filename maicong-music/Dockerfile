# 后端已迁到仓库根目录的 Node 22 镜像。
# 请在仓库根执行：docker compose up
# 本目录 docker-compose.yml 也会把构建上下文指向上一级 Dockerfile。
FROM node:22-alpine
WORKDIR /app
CMD ["sh", "-c", "echo 'Build from repo root: docker compose up' && exit 1"]
