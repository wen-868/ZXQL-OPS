# 智享全链运营系统 (zhixiang-ops)

短视频 + 直播带货运营系统。**独立部署 / 独立库 / 独立进程**，工程约定与「智享全链管理系统（ZXQL-MS）」100% 对齐。

## 技术栈（对齐管理系统）

- NestJS 11 + TypeScript（底座参考 `ZXQL-MS/.../ai-base`）
- TypeORM + MySQL（多租户：`tenantId` 列 + `TenantContext`）
- 统一响应信封 `{ code, msg, data, traceId }`（对齐 `src/shared/response.ts` 的 `ok/err`）
- 字符串错误码 + `AppError` + `AllExceptionsFilter`
- JWT 鉴权（`AuthUser{id,tenantId,role,type}`），三档 auth 模式
- 集中 `env.ts`（复用 `DB_*`/`REDIS_*`/`JWT_SECRET`/`CSRF_SECRET`/`LOG_LEVEL`/`FEISHU_*`；运营专属加 `OPS_` 前缀）
- pino 日志 + 飞书 5xx 告警
- Redis（ioredis，全局单例，缓存/队列/限流地基）

## 目录

```
src/
  config/env.ts           集中配置（dotenv）
  shared/                 response / app-error / error-code / logger / pagination
  common/                 response.interceptor / all-exceptions.filter
  tenant/                 TenantContext / TenantMiddleware / TenantModule
  auth/                   AuthUser / JWT / JwtAuthGuard / @CurrentUser
  database/               DatabaseModule(连池) / BaseEntity(tenantId + 软删)
  cache/                  RedisModule / RedisService
  core/                   核心资产：attribution_id + 7人性×6情绪字典
  modules/               业务模块（A~Z 字母域）
```

## 地基约定（务必遵守）

### 1. 统一响应信封
所有控制器返回值由 `ResponseInterceptor` 自动包成：
```json
{ "code": "0", "msg": "成功", "data": {}, "traceId": "..." }
```
- 成功 `code:"0"`；业务异常用 `throw new AppError('错误码')`。
- 手动构造：`ok(data)` / `err('错误码', '文案')`（均位于 `src/shared/response.ts`）。

### 2. 一次请求一个 traceId
- 由 `TenantMiddleware` 在请求入口生成（支持上游透传 `x-trace-id`）。
- `ResponseInterceptor` / `AllExceptionsFilter` / `traceLogger(traceId)` 共用同一 traceId，
  保证正常响应、错误响应、日志可串联追踪。**不要在业务代码里自行 `uuid()` 造 traceId。**

### 3. 多租户
- 实体继承 `BaseEntity`，自带 `tenantId` 列。
- 读租户：`TenantContext.getTenantId()`；强制读取（缺失即抛 `TENANT_REQUIRED`）：`TenantContext.requireTenantId()`。
- 请求头：`tenantId` / `x-tenant-id`；登录态优先取 JWT 解析出的租户。

### 4. 分页标准
列表接口统一使用 `PaginationQueryDto`（page/pageSize）与 `buildPage(list,total,page,pageSize)`，
返回结构固定为 `{ list, total, page, pageSize }`（位于 `src/shared/pagination.ts`）。
SQL 偏移用 `pageOffset(page,pageSize)` 计算，已做越界保护。

### 5. Redis
注入 `RedisService` 即可：`get/set/setJson/getJson/del/exists/expire/incr`。
复用管理系统的 `REDIS_*` 配置。

### 6. 鉴权
- 受保护接口加 `@UseGuards(JwtAuthGuard)`，登录用户用 `@CurrentUser() user: AuthUser` 获取。
- Token 由 `signToken(AuthUser)` 签发，校验 `verifyToken`。

## 运行

```bash
cp .env.example .env   # 填写 JWT_SECRET / 数据库 / Redis 等
npm install
npm run start:dev
```

健康检查：`GET /api/ops/health`（返回 traceId / tenantId / 示例 attribution_id）
租户校验演示：`GET /api/ops/health/strict`（不带租户头则抛 `TENANT_REQUIRED`）

校验/lint：`npm run typecheck` / `npm run lint`
