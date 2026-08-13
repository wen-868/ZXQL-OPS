# 智享全链运营系统 · 工作文件夹

统一存放**规划设计文档**与**管理系统（ZXQL-MS）权威项目规则**，作为运营系统（`zhixiang-ops-backend`）开发的单一参考源。

## 目录结构

```
zhixiang-ops-workspace/
├── README.md                     # 本文件
├── 设计文档/                      # 运营系统规划设计（已从原目录移入）
│   ├── 总体规划.md
│   ├── 开发顺序设计.md
│   ├── 一致性规范.md
│   ├── 竞品分析与功能打磨.md
│   ├── 精细对比与遗漏排查.md
│   └── workflow.py
└── 项目规则/                      # 管理系统权威规则（复制，不可在此直接改）
    ├── 标准对照与统一规范.md       # ← 统一标准总纲，先看这个
    ├── eslint.config.mjs          # NestJS ESLint flat config（来源 ai-base）
    ├── .prettierrc                # 代码风格（来源 ai-base）
    ├── tsconfig.json              # 严格 tsconfig（来源 ai-base）
    ├── nest-cli.json              # Nest 构建配置（来源 ai-base）
    ├── shared/                    # 共享内核（来源 src/shared）
    │   ├── response.ts            # 响应信封 ok/fail
    │   ├── app-error.ts           # AppError
    │   ├── pagination.ts          # 分页 buildPage
    │   └── logger.ts              # pino + 飞书告警
    ├── config/                    # 配置与缓存（来源 src/config）
    │   ├── env.ts                 # 环境变量集中入口
    │   └── redis.ts               # Redis 缓存工具
    ├── middleware/                # Express 侧参考（来源 src/middleware）
    │   ├── tenant.ts              # 租户隔离中间件
    │   └── error-handler.ts       # 统一错误处理器
    └── nestjs-tenant/             # NestJS 侧参考（来源 ai-base/src）
        ├── tenant-context.ts      # AsyncLocalStorage 上下文
        ├── tenant.middleware.ts   # JWT 租户解析
        └── request-logging.middleware.ts
```

## 使用约定

1. 任何业务模块（A~Z）开发前，先读 `项目规则/标准对照与统一规范.md`，并对照「模块开发自检清单」。
2. `项目规则/` 下文件是**只读基线**，修改应回到管理系统源头，再重新复制，不要在此直接编辑。
3. 设计文档的最新版以 `设计文档/` 为准；原目录 `zhixiang-quanlian-yunying-sheji-20260806/` 已清空。

## 与管理系统对齐的核心结论

- 响应信封 `{code,msg,data,traceId}`，成功 `code:"0"`；业务异常用字符串错误码。
- 一次请求一个 `traceId`，贯穿 interceptor/filter/logger。
- 多租户 `tenantId` 隔离 + `TenantContext.requireTenantId()`。
- 分页 `{list,total,page,pageSize}`；配置复用 `DB_*`/`REDIS_*`/`JWT_SECRET` 等；运营专属 `OPS_*`。
- 代码风格：Prettier `singleQuote/semi/trailingComma:all/printWidth:100`；tsconfig `strict`。

详见 `项目规则/标准对照与统一规范.md`。
