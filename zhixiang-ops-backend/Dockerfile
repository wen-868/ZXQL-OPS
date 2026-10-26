FROM node:20-alpine AS builder

WORKDIR /app

# 复制依赖文件
package.json package-lock.json tsconfig.json .env* .nvmrc* ./
    
# 生产环境依赖
RUN npm ci --omit=dev

# 编译 TypeScript
RUN npm run build

# 生产阶段
FROM node:20-alpine AS production

WORKDIR /app

# 仅复制必需文件
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

# 环境变量 (通过 docker-compose .env 传递)
ENV NODE_ENV=production
ENV PORT=3000

# 非 root 用户
RUN addgroup -S nodegroup && adduser -S nodeuser -G nodegroup
USER nodeuser

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# 启动命令
CMD ["npm", "start:prod"]