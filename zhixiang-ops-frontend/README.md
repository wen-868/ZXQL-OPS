# 智享全链运营系统 · 运营后台前端

运营系统 Web 前端（Vue3 + Vite + Element Plus + Vue Router + Pinia + axios）。
当前增量实现：工程基座 + 导航骨架（层1 UI 基座）+ **B 账号矩阵**功能页（作为其余模块的模板）。

## 技术栈

- Vue 3.5 + Vite 5 + TypeScript
- Element Plus（admin 组件库，中文语言包）
- Vue Router 4（经典 admin 布局：左侧菜单 + 顶部栏 + 内容区）
- Pinia（状态管理）
- axios（统一请求/响应拦截）

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器（默认 5173，代理 /api → http://127.0.0.1:3100）
npm run dev

# 3. 构建（类型检查 + 打包）
npm run build

# 4. 预览构建产物
npm run preview
```

> 后端服务需在 `http://127.0.0.1:3100` 运行（`GET /api/ops/health` 返回 200）。
> dev 下所有 `/api` 请求由 Vite 代理转发到该地址，避免跨域。

## tenantId 注入方式（多租户隔离）

后端按请求头 `tenantId` 做多租户强隔离（缺省返回 `TENANT_REQUIRED`）。
前端在 **axios 请求拦截器**（`src/utils/request.ts`）中为每个请求注入 `tenantId`：

- 默认从运行环境变量 `VITE_TENANT_ID` 读取，缺省值为 `t_dev`。
- 变量定义在 `.env`（dev）：`VITE_TENANT_ID=t_dev`。
- 业务调用也可在单次请求里显式传 `headers: { tenantId: 'xxx' }` 覆盖默认值。
- 全局当前租户在 Pinia `src/stores/app.ts` 维护，顶部栏展示。

## 目录结构

```
zhixiang-ops-frontend/
├── index.html
├── vite.config.ts        # /api 代理到 3100
├── tsconfig.json
├── .env                  # VITE_TENANT_ID / VITE_API_BASE
├── src/
│   ├── main.ts           # 入口（挂载 Pinia/Router/ElementPlus）
│   ├── App.vue
│   ├── api/
│   │   └── accounts.ts   # B 账号矩阵接口（对齐 API接口文档.md）
│   ├── config/menu.ts    # 全链路主线菜单分组配置
│   ├── layouts/
│   │   └── BasicLayout.vue  # 左侧菜单 + 顶部栏 + 内容区
│   ├── router/
│   │   ├── index.ts
│   │   └── routes.ts     # 布局容器 + B 真实页 + 其余占位页
│   ├── stores/app.ts     # 租户/侧边栏状态
│   ├── utils/
│   │   ├── request.ts    # axios：tenantId 注入 + 信封拆包
│   │   └── format.ts     # 时间戳/金额/计数格式化
│   └── views/
│       ├── PlaceholderView.vue       # 模块建设中空状态
│       └── account/
│           ├── AccountMatrixView.vue # B 账号矩阵（真实页）
│           ├── AccountFormDrawer.vue # 新建/编辑抽屉
│           └── accountMaps.ts        # 枚举中文/标签色映射
```

## API 契约对齐

- 全局前缀 `/api`（axios `baseURL = /api`）。
- 统一响应信封 `{ code, msg, data, traceId }`，成功 `code === "0"`；
  拦截器拆信封：成功取 `data` 返回，失败弹 `msg` 并 reject（保留 `traceId`）。
- B 账号矩阵接口（`src/api/accounts.ts`）严格对齐 `docs/API接口文档.md`：
  - `GET /ops/accounts`（分页 + 筛选，默认 1/20）
  - `POST /ops/accounts`（新建，含明文 token，提示服务端加密、响应不回传）
  - `PATCH /ops/accounts/:id`（局部更新）
  - `DELETE /ops/accounts/:id`（软删）
  - `GET /ops/accounts/health/summary`（矩阵健康看板，路由声明在 `/:id` 之前）
- 路由顺序注意：`health/summary` 必须在 `/:id` 之前，否则会被 `:id` 捕获。

## 状态与下一步

- ✅ 工程基座 + 导航骨架完成
- ✅ B 账号矩阵功能页完成（健康看板 / 筛选 / 表格 / 新建-编辑抽屉 / 删除二次确认 / 详情 / 空-加载-错误态）

下一候选模块（建议）：
- **C 情报采集**（创作主线第二步，竞品/采集任务/评论清洗）
- 或 **M 决策看板**正式化（复用后端 `/api/ops/dashboard` 聚合层，做图表化 BI）
