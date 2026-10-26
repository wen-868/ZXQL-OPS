# 变更日志（CHANGELOG）

本仓库遵循 [语义化版本](https://semver.org/lang/zh-CN/)。
格式：`## [版本号] - 日期`，变更类型：`新增` / `修复` / `重构` / `文档` / `测试` / `安全` / `运维`。

发布产物版本以根目录 `智享全链运营系统_*_vX.Y.Z.exe` 与 `package.json version` 为准。

## [0.2.1] - 2026-10-13

### 前端首屏体积治理（专项）
- **主包 1.28MB → 168KB（gzip 420KB → 64KB）**，构建无 500KB 超包告警，首屏显著提速。
- 图标：`main.ts` 由 `import * as ElementPlusIconsVue` 全量注册（1000+ 图标进主包）改为**白名单注册 7 个**（Fold/Lock/Key/MagicStick/Plus/User/Warning）。已核查全仓用法均为「先 import 再变量绑定」（`:icon="Plus"` / `<Fold />`），无依赖全局注册的动态图标，改造安全。
- 组件：接入 `unplugin-vue-components` + `ElementPlusResolver` 做**自动按需**，组件 JS 与 CSS 均按需引入；全量 CSS 386KB → 36KB（-90.6%）。
- 本地化：全量注册移除后，locale 改由 `App.vue` 的 `<el-config-provider :locale="zhCn">` 下发，避免 date-picker 等组件文案回退英文。
- **踩坑留档（勿复踩）**：`manualChunks` 里把 `element-plus` 整体归为一个 chunk，会把按需引入的组件重新合并成大包（实测仍 927KB，按需完全失效）。已移除该项，改由 Rollup 依组件依赖自然拆分（el-table-column / el-date-picker 等各自独立、按需加载）。

### 复杂度收敛（专项）
- 圈复杂度告警 **95 → 0（全部清零）**，0 error 维持；后端告警总数 182 → 3（剩余 3 条为非复杂度类的既有 warn）。
- 手法：指令解析器表化（parseInstruction 26→≤8）、异常描述抽助手（filter/adapter 的 catch 链）、状态机转移表（intel.controlCollectTask）、字段清单驱动（updateSource/updateRule/applyScriptFields/updateTalent/upsertFans/findAll 等 ??/if 堆叠）、默认值+展开覆盖（spec 工厂 make* 21→1）、聚合逻辑抽纯函数（recycle/analyze/llm/account/v/u）。
- 覆盖 40+ 文件：playwright 全目录、auth/csrf、publish/script/y/intel/topic/recycle/account/ad/ecommerce/workflow/dashboard/llm/auto-chain/ms-client/integration/skill providers/system-config/compliance/aa/v/u/r/h/ffmpeg.util，以及 6 个 spec 工厂。
- 全流程等价重构：未改动任何错误码、异常文案、字段默认值语义（`??` 与 spread 的 null 语义差异已逐项校验，一律保持原 `??` 行为）。

### 修复（P0：阻断构建）
- 前端 `AiChatWidget`：补实现缺失的 `tryInlineView`（`@查看 xx` 类指令直连页面快照、不走 LLM），恢复 `npm run build`（此前 `vue-tsc` TS2304 阻断构建，AI 对话发送必然抛 ReferenceError）。
- 前端 lint 门禁恢复：`AiChatWidget.summaryLine` 重构降复杂度（12→达标）、`BrowserTab.handleMessage` 拆分为 `applyStatus/applyTaskResult`（19→达标）、case 内词法声明加块作用域、清理未用变量与无效 eslint-disable。

### 修复（第二批：资源/数据口径）
- **浏览器实例池资源泄漏**：`BrowserPool` 新增 `destroy()`（清理空闲清理定时器 + 关闭全部实例），`BrowserGateway.onModuleDestroy` 改为委托它；定时器 `unref()` 不再持有事件循环（此前 Jest 反复告警 "Cannot log after tests are done"）。
- **H 成片素材路径穿越**：新增 `isSafeMaterialPath`（上传目录/成片目录包含性校验），过滤后才拼入 FFmpeg concat，`/etc/passwd` 等越界路径被拒绝（此前素材 url 可经上传接口写入并直接交给 FFmpeg 读取）。
- **模拟发布可区分**（数据口径）：`ops_publish_tasks` 新增 `simulated` / `simulated_reason` 两列（迁移 030 + 回退脚本），凭证缺失/平台未接入时的降级回执统一标记，不再与真实平台回执混淆；新增 3 个用例断言（模拟降级/未接入/真实发布不落标记）。

### 类型安全（no-unsafe 收敛）
- `no-unsafe-*` 告警 **78 → 1**（lint warning 182 → 101，剩余全为复杂度门禁）：
  - `instruction-executor` 的 `page: any` → Playwright `Page` 类型（此前成员拼写错误无法在编译期发现，占 24 处告警）；
  - 三个平台 adapter + executor + gateway + pool + retry-strategy 的 `catch (err: any)` → `catch (err: unknown)` + `errMessage()` 类型守卫（新增 `playwright/err-msg.ts`，兼容 throw 非 Error 的情况）；
  - `health-checker` 的 `require('package.json')` → 带类型 `readFileSync` + `JSON.parse`；
  - `health.controller` 的 `(err as any).degraded` → 交叉类型 `Error & { degraded?: boolean }`；
  - WS 消息 `JSON.parse` 显式标注返回类型，`raw.toString()` → 按 `ws` 的 data 联合类型安全转换；
  - `BrowserGateway` 审计调用补 `void` 标记（显式忽略，消除 floating-promise）。
- `eslint.config.mjs` 注释同步更新：策略由"存量不可落地降 warn"改为"已收敛，新增按 unknown+守卫编写"。

### 安全（P1）
- **浏览器工作台 WebSocket 鉴权**：`browser-ws.gateway` 在 upgrade 阶段强制 JWT 验签（Authorization / Sec-WebSocket-Protocol / query token 三通道），未通过返回 401 并断开；**租户一律取自 token，不再信任 `?tenant=` 参数**（此前匿名可驱动服务端 Chromium，构成 SSRF + 任意页面读取）。前端 `BrowserTab` 连接时携带 token。
- **移除 Chromium `--disable-web-security` 启动参数**：同源策略关停会把服务端浏览器变成任意站点可读的代理；反检测经 UA 与 AutomationControlled 移除已足够，`.env.example` 同步警示勿配置该参数。
- **开放注册开关**：新增 `OPS_ALLOW_REGISTER`（默认 true 兼容演示流），关闭时 `/ops/auth/register` 返回 403 `REGISTER_DISABLED` 且不触达用户仓库（防绕过）；生产建议关闭、走管理员邀请/员工管理。
- **管理系统 SSO 验签密钥解耦**：新增 `OPS_MS_JWT_SECRET`（缺省回退 JWT_SECRET 兼容既有部署），配置独立密钥后两系统凭据任一泄露不再能双向伪造 token；配套 5 个验签测试（含密钥解耦与篡改拒绝）。
- **SSRF 出站守卫**：新增 `shared/url-guard.ts`（协议白名单 + 内网域名/IPv4 私有段/IPv6 本地段/云元数据拦截 + DNS 解析 fail-closed），接入：
  - WS `navigate` 指令（接入此前从未被调用的 `input-validator`，selector/payload 危险模式一并拦截）；
  - 情报采集 `target`（任务发起、采集源创建/更新三处入口，新增错误码 `COLLECT_TARGET_BLOCKED`）。
- **素材上传外链白名单**：`UploadMaterialDto.url` 由裸 `@IsString` 收紧为 `@IsUrl`（http/https），消除存储型 XSS 面。
- **配置中心敏感键不回明文**：`GET /ops/system-configs/:key` 改走 `getMasked()`（敏感值仅返回 `******`，明文仅供服务内部消费）。
- **CORS 收敛**：生产环境 `CORS_ORIGINS` 未配置时禁用跨域（此前 `origin: true + credentials: true` 等价对任意站点开放带凭据访问），开发环境保持放行。
- **`.env.example` 重写**：修复换行符损坏（多处键值被挤成一行，直接复制会产出错误配置）；`OPS_DEMO_MODE` 示例值改为 `false` 并警示生产勿开启；补齐 `OPS_MS_JWT_SECRET` / `OPS_ALLOW_REGISTER` 说明。

### 修复（缺陷）
- `playwright/directive-parser`：修复 `wait 3s` 被解析成 100ms 的正则缺陷（单位分支顺序 + 中文单位支持 + 非法数值回落）；裸命令（`navigate`/`click` 无参数）给出针对性错误；`smartComplete` 仅对「正好打到前缀」的半截输入补全。
- `tenant/tenant.subscriber`：修复 `beforeInsert` 对「tenantId 为 undefined 的实体」直接跳过、与注释语义（空值自动注入）矛盾的问题，现为缺键才跳过。
- 移除 `ops-automation` / `video-automation` 两处重复的 `ScheduleModule.forRoot()`（AppModule 已全局注册）。

### 测试（覆盖率门禁恢复）
- 分支覆盖率 59.85% → **65%+（门禁通过）**：新增 url-guard（SSRF 全分支）、directive-parser（重写为行为测试）、instruction-executor（17 用例，mock Page 驱动真实执行路径）、browser-pool（14 用例，含 destroy）、BrowserGateway（9 用例，含熔断开路）、browser-ws.gateway（鉴权与安全守卫）、三个平台 adapter、tenant.subscriber、collector.gateway、base.entity、multer.config、human-adjustment、ms-token（SSO 密钥解耦）、H 素材路径安全、publish 模拟标记等 19 个 spec，累计 +204 用例（1208 → 1412）。- 顺带修复测试暴露的源码缺陷（wait 单位解析、Subscriber 注入语义、smartComplete 误判）。

### 运维 / 文档
- `eslint.config.mjs`：`no-unsafe-*` 等 type-checked 系列由 error 降为 warn（存量 57 文件 100+ 处 `any` 传播，与复杂度门禁同一治理策略——warn 收敛，不阻断合并）；**未用变量/导入仍为 error 硬门禁**，本轮清零。
- 清理垃圾文件：删除 UTF-16 编码的空壳 `REPORT.md` 与运行时 `dump.rdb`；`.gitignore` 补 `*.rdb/*.aof` 与 `.mimosa/`。
- `docs/architecture.md` 模块边界规则按实际依赖校准：废除「禁止跨模块 import」的不实声明，改为「基建/N 审计可依赖 + 内容主链单向无环 + 聚合模块白名单 + 跨域实体只读约定」。

## [0.2.0] - 2026-08-25

### 安全（P0）
- 登录防爆破 Redis 化：连续失败计数与锁定窗口从进程内存迁到 Redis（`ops:login:fail:<ip>:<username>`），覆盖 login/register/sso/demo-login，增加 IP 维度；Redis 不可用时降级内存兜底。
- CSRF 令牌校验：登录/SSO 响应下发无状态 HMAC 签名 `csrfToken`，全局 `CsrfGuard` 校验写接口，新增 `CSRF_INVALID` 错误码；前端 `request.ts` 自动注入 `x-csrf-token`。
- 依赖漏洞扫描与 SAST：接入 `npm audit`（记录报告与每周计划）与 `eslint-plugin-security`。

### 工程质量
- 后端单测覆盖率冲至 ≥70%，新增各业务模块 controller 用例与 ai-chat/dashboard/video-automation 模块用例，jest 覆盖率阈值提升并纳入 CI 门禁。
- 前端接入 Vitest + @vue/test-utils，核心工具/组件单测 ≥60%。
- 新增 GitHub Actions CI（lint / typecheck / 覆盖率门禁 / 前端构建与单测）。
- 复杂度与重复代码治理（cyclomatic complexity ≤8、jscpd 报告）。

### 文档与运维
- 新增架构/模块边界文档、ER 图与索引设计文档、staging 环境配置、压测报告、备份策略与脚本、事务补偿说明、无障碍与错误提示走查记录、兼容矩阵。
- 迁移脚本支持 `--rollback` 回退模式。

## [0.1.0] - 2026-08-17（已发布）

### 新增
- 智享全链运营系统 stage-1 全量代码：NestJS 后端（27 域） + Vue3 运营后台前端（§10 UI 层2 全部闭合）。
- 原生桌面版客户端（WinForms + WebView2）与一键启动器。
- NSIS 完整安装版（安装向导 / 开始菜单 / 控制面板卸载）。
- 免密演示登录（`OPS_DEMO_MODE=true`），演示租户 `t_demo` 与正式租户物理隔离。
- 双模式接入地基：`OPS_INTEGRATION_MODE` standalone/connected + 适配层（Product/Order/Commission/Auth）+ 管理系统 SSO 与主数据同步契约。

### 修复
- 看板接口鉴权与打包脚本兼容性。
- 发布前端默认租户改为 `t_demo`（演示登录/注册可用）。
