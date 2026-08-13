# API 接口文档（契约）

> 前后端对齐的唯一真相源。任何 API 变更必须先改本文件，再改代码。
> 契约格式见 `项目规则.md` 第十二章 防线2。
> 全局前缀 `api`，统一响应信封 `{ code, msg, data, traceId }`，成功 `code:"0"`。

## B 账号矩阵（B-core）`/api/ops/accounts`

所有接口按请求头 `tenantId` 做租户隔离（多租户强隔离，见 `tenant.subscriber`）。
Token 以明文入参，服务端 AES-256-GCM 加密存储，接口响应**永不回传** token 密文。

### 枚举取值
- `platform`：`douyin` | `kuaishou` | `xiaohongshu` | `bilibili` | `wechat-channels`
- `identity`（身份）：`primary` | `secondary` | `matrix`
- `stage`（阶段）：`nurturing` | `growing` | `mature` | `declining`
- `status`（健康状态）：`normal` | `warning` | `risk` | `unsigned` | `banned`

### 1. 创建账号
`POST /api/ops/accounts`
```jsonc
// 请求体
{
  "platform": "douyin",            // 必填，枚举
  "platformAccountId": "string",   // 必填，平台侧账号唯一ID
  "nickname": "string?",           // 可选
  "avatarUrl": "string?",
  "identity": "matrix?",           // 可选，默认 matrix
  "track": "string?",              // 赛道
  "stage": "nurturing?",           // 可选，默认 nurturing
  "accessToken": "string?",        // 明文，服务端加密；传入则状态→normal
  "refreshToken": "string?",
  "tokenExpireAt": "2026-09-01T00:00:00Z?", // ISO8601
  "fansCount": 0, "followCount": 0, "likeCount": 0,
  "remark": "string?"
}
```
- 成功：`200 { code:"0", data: AccountView }`
- 重复 `(tenantId,platform,platformAccountId)`：`409 { code:"ACCOUNT_DUPLICATE" }`

### 2. 账号列表（分组筛选 + 分页）
`GET /api/ops/accounts?page=1&pageSize=20&platform=douyin&identity=matrix&stage=growing&status=normal&track=&keyword=`
- 成功：`200 { code:"0", data: { list: AccountView[], total, page, pageSize } }`
- 分页参数继承 `PaginationQueryDto`（`page`/`pageSize`，默认 1/20）

### 3. 矩阵健康看板
`GET /api/ops/accounts/health/summary`  ← 须声明在 `/:id` 之前
- 成功：`200 { code:"0", data: { total, byStatus:{}, byPlatform:{}, unsignedAccounts:[{id,nickname,platform}] } }`

### 4. 账号详情
`GET /api/ops/accounts/:id`
- 成功：`200 { code:"0", data: AccountView }`
- 不存在：`404 { code:"ACCOUNT_NOT_FOUND" }`

### 5. 更新账号
`PATCH /api/ops/accounts/:id`（全字段可选，局部更新）
```jsonc
{ "nickname":"新昵称", "status":"risk", "fansCount": 1234, "accessToken":"新的明文token" }
```
- 成功：`200 { code:"0", data: AccountView }`

### 6. 删除账号（软删）
`DELETE /api/ops/accounts/:id`
- 成功：`200 { code:"0", data: { id } }`

### 7. Token 续期 / 重新授权
`POST /api/ops/accounts/:id/refresh-token`
```jsonc
{ "accessToken":"新明文token", "refreshToken":"?", "tokenExpireAt":"2026-09-01T00:00:00Z?" }
```
- 成功：`200 { code:"0", data: AccountView }`，状态回正为 normal/unsigned

### AccountView（响应对象，已剥离 token 密文）
`{ id, tenantId, platform, platformAccountId, nickname, avatarUrl, identity, track, stage, status, tokenExpireAt, lastSyncAt, lastActiveAt, fansCount, followCount, likeCount, remark, createdAt, updatedAt }`

### 定时任务（服务端）
- `AccountService.reconcileHealth()` 每 10 分钟执行：Token 过期 → 标记 `unsigned`（掉签）；临期（≤3 天）且 normal → `warning`。事件写入 `ops_account_health_events`。

## C 情报采集（C-core）`/api/ops/intel`

所有接口按请求头 `tenantId` 做租户隔离。采集评论仅落库公开字段白名单（content/authorId/likes/platform/sourceRef/collectedAt），命中隐私（手机/地理/IMEI）一律剥离为 `[已脱敏]` 并记录 clean_result（合规边界①）。

### 枚举取值
- `platform`：复用 B-core（douyin / kuaishou / xiaohongshu / bilibili / wechat-channels）；开发联调用 `local`
- `collectTask.type`：`monitor` | `hot` | `comment` | `keyword`
- `collectTask.sourceLevel`（来源合规级别）：`L1`(开放API) | `L2`(授权公开页爬虫)；**禁止 L3 个体隐私**
- `collectTask.status`：`pending` | `running` | `done` | `failed`
- `hotType`：`video` | `live` | `topic` | `brand`

### 1. 创建竞品
`POST /api/ops/intel/competitors`
```jsonc
{ "platform": "douyin", "name": "竞品A", "url": "https://...?", "category": "美妆?" }
```
- 成功：`200 { code:"0", data: Competitor }`
- 不存在：`404 { code:"COMPETITOR_NOT_FOUND" }`（详情/更新/删除/监控开关同理）

### 2. 竞品列表
`GET /api/ops/intel/competitors` → `200 { code:"0", data: Competitor[] }`

### 3. 竞品详情
`GET /api/ops/intel/competitors/:id`

### 4. 更新竞品（含监控开关）
`PATCH /api/ops/intel/competitors/:id`
```jsonc
{ "name":"新名?", "url":"?", "category":"?", "monitorEnabled": true }
```

### 5. 监控开关（翻转）
`POST /api/ops/intel/competitors/:id/monitor` → `200 { code:"0", data: Competitor }`（monitorEnabled 翻转）

### 6. 删除竞品（软删）
`DELETE /api/ops/intel/competitors/:id` → `200 { code:"0", data: { id } }`

### 7. 发起采集任务
`POST /api/ops/intel/collect`
```jsonc
{ "type":"comment", "target":"vid-1001", "platform":"local",
  "sourceLevel":"L1", "scope":["comments"]?, "fieldsCollected":["content","authorId","likes","platform","sourceRef","collectedAt"]? }
```
- 成功：`200 { code:"0", data: { taskId, traceId } }`
- 频率超限：`429 { code:"COLLECT_RATE_LIMITED" }`（令牌桶，按 租户+平台，10次/分钟）
- 来源级别非法：`400 { code:"COLLECT_SOURCE_LEVEL_INVALID" }`

### 8. 采集任务进度
`GET /api/ops/intel/collect/:id` → `200 { code:"0", data: { status, progress, collectedCount } }`
（异步：create 落 pending → `@Cron` 每5秒工作器处理 → running → done/failed）

### 9. 采集评论（供 D 消费，分页/清洗过滤）
`GET /api/ops/intel/collected-comments?page=1&pageSize=20&isClean=true&platform=local`
→ `200 { code:"0", data: { list: CollectedComment[], total, page, pageSize } }`
- `isClean=true`：仅干净数据（D 人性分析消费）；`isClean=false`：仅未过清洗（含隐私/广告）

### 10. 关键词挖掘
`POST /api/ops/intel/keywords/mine` → `200 { code:"0", data: string[] }`
```jsonc
{ "platform":"local", "target":"口红" }
```

### 11. 热点榜
`GET /api/ops/intel/hot?platform=local&hotType=video` → `200 { code:"0", data: HotSnapshot[] }`

### CollectedComment（响应对象）
`{ id, tenantId, platform, sourceType, sourceRef, content, authorId, likes, isClean, cleanResult, contentHash, collectedAt, taskId, createdAt, updatedAt }`
- `cleanResult`：`{ piiRemoved: string[], ad: boolean }`（合规审计留痕）

### 定时任务（服务端）
- `IntelService.processPendingTasks()` 每 5 秒执行：扫描 pending 采集任务→running→调用采集网关拉取→清洗去重落库→done（回填 progress/collectedCount）；失败记 errorMsg→failed。
- 采集网关 `CollectorGateway.resolve(platform)`：真实平台返回 NotImplementedCollectorAdapter（独立模式待接入）；`local` 返回 LocalCollectorAdapter（开发联调样本）。生产替换为平台 API 适配器后业务管线不变。

## D 人性分析与洞察引擎（D-core）`/api/ops/analyze`

所有接口按请求头 `tenantId` 做租户隔离。消费 C 清洗后的干净评论（is_clean=true），经能力网关做 7×6 归因聚类，**仅输出/存储聚合统计与洞察结论，不留存任何单条个人信息**（合规边界②）。

### 枚举取值
- `analysisTask.source`：`comments` | `live` | `ad`
- `analysisTask.status`：`pending` | `running` | `done` | `failed`
- 人性 driver（7）：贪 / 懒 / 怕 / 虚荣 / 窥探 / 孤独爱 / 愤怒不公
- 情绪 emotion（6）：愤怒 / 共鸣 / 好奇 / 感动 / 焦虑 / 爽感

### 1. 发起人性分析任务
`POST /api/ops/analyze/analysis`
```jsonc
{ "source":"comments", "platform":"local"? , "inputRefs":["ref1"]?, "commentLimit":200? }
```
- 成功：`200 { code:"0", data: { taskId, traceId } }`
- 无可分析评论：`400 { code:"ANALYSIS_EMPTY_INPUT" }`（需先经 C 采集并清洗）
- 异步：create 落 pending → `@Cron` 每5秒 `processPendingAnalysis` → running → 调能力网关聚类 → done/failed

### 2. 分析任务进度/结果
`GET /api/ops/analyze/analysis/:id` → `200 { code:"0", data: AnalysisTask }`
- 不存在：`404 { code:"ANALYSIS_TASK_NOT_FOUND" }`
- AnalysisTask 含 driverCounts / emotionScores / topDrivers / topEmotions / insights / modelUsed / promptVersion / totalComments / status

### 3. 人性分析报告
`GET /api/ops/analyze/analysis/report` → `200 { code:"0", data: { topDrivers, topEmotions, driverCounts, emotionScores, insights, recentTaskId? } }`
- 取该租户最近一次 done 任务的聚合结果；无则全部空

### 4. 洞察知识库列表
`GET /api/ops/analyze/insights?page=1&pageSize=20&driver=贪&emotion=好奇&category=贪`
→ `200 { code:"0", data: { list: HumanInsight[], total, page, pageSize } }`
- 按 usageCount 降序（高频复用洞察靠前）

### 5. 沉淀洞察（人工 / 自动）
`POST /api/ops/analyze/insights`
```jsonc
{ "category":"贪", "driver":"贪", "emotion":"好奇", "title":"...", "content":"...", "tags":["..."]? }
```
- 成功：`200 { code:"0", data: HumanInsight }`
- 人性非法：`400 { code:"HUMANITY_INVALID" }`；情绪非法：`400 { code:"EMOTION_INVALID" }`
- 去重：同租户 + title + driver 已存在则累加 usageCount 并更新，不新增行

### AnalysisTask（响应对象）
`{ id, tenantId, source, platform?, inputRefs?, status, progress, totalComments, driverCounts, emotionScores, topDrivers, topEmotions, insights, modelUsed, promptVersion, errorMsg?, finishedAt?, createdAt, updatedAt }`

### HumanInsight（响应对象）
`{ id, tenantId, category, driver, emotion, title, content, tags?, refAnalysisId?, usageCount, createdAt, updatedAt }`

### 定时任务（服务端）
- `AnalyzeService.processPendingAnalysis()` 每 5 秒执行：扫描 pending 分析任务→running→取 is_clean 评论→组装 7×6 聚类 prompt（§14 JSON Schema）→调 `SkillGateway.invoke(text-generate)`→解析聚合(JSON)→回填 driverCounts/emotionScores/topDrivers/topEmotions/insights→done；失败记 errorMsg→failed。
- 聚类产出洞察经 `seedInsights` 自动沉淀进 `ops_human_insights`（去重 + usageCount）。

### 洞察来源与下游消费
- 自动：聚类洞察沉淀进知识库；人工：`POST /insights` 沉淀。
- 下游 E 选题 检索 `ops_human_insights` 复用高频洞察（按 usageCount 排序）。

## E 选题引擎（E-core）`/api/ops/topic`

所有接口按请求头 `tenantId` 做租户隔离。消费 D 洞察库（`ops_human_insights`）或指定分析任务（`ops_analysis_tasks.insights`）聚合生成选题，**仅存聚合洞察结论与选题元数据，不留存个人信息**（合规边界②）。归因标识 `attribution_id` 由 `attr_<tenant>_content_<hash32>` 生成，沿选题→脚本→发布→回收链路只读透传。

### 枚举取值
- `topic.status`：`idea` → `todo` → `written` → `shot` → `published`，外加终态 `dead`
- 人性 driver（7）：贪 / 懒 / 怕 / 虚荣 / 窥探 / 孤独爱 / 愤怒不公
- 情绪 emotion（6）：愤怒 / 共鸣 / 好奇 / 感动 / 焦虑 / 爽感

### 1. 生成选题（聚合 D 洞察库）
`POST /api/ops/topic/generate`
```jsonc
{ "driver":"贪"?, "emotion":"好奇"?, "limit":20?, "analysisId":123? }
```
- 成功：`200 { code:"0", data: { topics: Topic[], traceId } }`（去重跳过已存在者；无可用洞察返回空列表 `{topics:[],traceId}`）
- 人性非法：`400 { code:"HUMANITY_INVALID" }`；情绪非法：`400 { code:"EMOTION_INVALID" }`
- 指定 `analysisId` 不存在：`404 { code:"ANALYSIS_TASK_NOT_FOUND" }`

### 2. 选题列表
`GET /api/ops/topic/topics?page=1&pageSize=20&driver=贪&emotion=好奇&status=idea`
→ `200 { code:"0", data: { list: Topic[], total, page, pageSize } }`
- 按 `score` 降序（综合评分高靠前）

### 3. 选题详情
`GET /api/ops/topic/topics/:id` → `200 { code:"0", data: Topic }`
- 不存在：`404 { code:"TOPIC_NOT_FOUND" }`

### 4. 更新选题（状态机 / 标签 / 评分）
`PATCH /api/ops/topic/topics/:id`
```jsonc
{ "title":"...", "humanDriver":"贪"?, "emotion":"好奇"?, "formulaTags":["..."]?, "status":"todo"?, "score":80?, "scheduledAt":"2026-09-01T00:00:00Z"?, "accountId":1? }
```
- 成功：`200 { code:"0", data: Topic }`
- 不存在：`404 { code:"TOPIC_NOT_FOUND" }`
- 非法状态流转（含原地流转）：`400 { code:"INVALID_STATUS_TRANSITION" }`
- 人性非法：`400 { code:"HUMANITY_INVALID" }`；情绪非法：`400 { code:"EMOTION_INVALID" }`

### 5. 创建 A/B 变体
`POST /api/ops/topic/topics/:id/ab`
```jsonc
{ "title":"...", "humanDriver":"贪"?, "emotion":"好奇"?, "formulaTags":["..."]?, "scheduledAt":"..."?, "accountId":1? }
```
- 成功：`200 { code:"0", data: Topic }`（新选题 `abVariantOf`=基准 id，继承未传字段）
- 基准选题不存在：`404 { code:"TOPIC_NOT_FOUND" }`
- 对变体再建变体（防环）：`400 { code:"INVALID_AB_VARIANT_CYCLE" }`

### 6. 选题排期
`POST /api/ops/topic/topics/:id/schedule`
```jsonc
{ "scheduledAt":"2026-09-01T00:00:00Z", "accountId":1? }
```
- 成功：`200 { code:"0", data: Topic }`（绑定 `scheduledAt` 与可选 `accountId`）
- 选题不存在：`404 { code:"TOPIC_NOT_FOUND" }`
- 终态（published/dead）不可排期：`400 { code:"INVALID_STATUS_TRANSITION" }`
- 绑定账号不存在：`404 { code:"SCHEDULE_ACCOUNT_NOT_FOUND" }`

### Topic（响应对象）
`{ id, tenantId, analysisId?, attributionId, title, humanDriver, emotion, formulaTags?, status, score, abVariantOf?, scheduledAt?, accountId?, promptVersion, modelUsed, createdAt, updatedAt }`

### 下游消费
- F 脚本：检索 `ops_topics`（按 status/humanDriver）生成脚本草稿。
- I 发布：按 `scheduledAt` + `accountId` 触发定时发布，透传 `attributionId`。

## F 脚本工坊（F-core）`/api/ops/script`

所有接口按请求头 `tenantId` 做租户隔离。消费 E 选题（`ops_topics`）生成脚本草稿，**`attributionId` 由 E 透传、禁止在 F 重新生成**（规划 §4 链路只读透传）。合规预检阶段1 内嵌违禁词种子（联动 P 阶段迁至违禁词库治理）。仅存脚本内容/口播/字幕/合规命中，无单条个人信息落库（合规边界②）。

### 枚举取值
- `script.status`：`draft` → `reviewing` → `approved` → `published`
  - 流转白名单：`draft→reviewing`、`reviewing→approved`、`reviewing→draft`、`approved→published`、`published→draft`（原地流转非法）
- 钩子情绪 `hookEmotion` ∈ 6 情绪（愤怒/共鸣/好奇/感动/焦虑/爽感，对齐 `analyze.types.EMOTION_TYPES`）
- 合规命中级别：`none` < `low` < `medium` < `high`（高危命中禁止发布）

### 1. 生成脚本（消费 E 选题）
`POST /api/ops/script/generate`
```jsonc
{ "topicId": 1, "templateId":"pain-hook"? }
```
- 成功：`200 { code:"0", data: { script: Script, traceId } }`（`attributionId` 继承 E 选题；`status=draft`；`hookEmotion`=选题 emotion；`complianceRisk` 由内嵌违禁词预检生成）
- 选题不存在：`404 { code:"TOPIC_NOT_FOUND" }`
- 钩子情绪非法（选题 emotion 不在 6 情绪）：`400 { code:"EMOTION_INVALID" }`

### 2. 脚本列表
`GET /api/ops/script/scripts?page=1&pageSize=20&topicId=1&status=draft`
→ `200 { code:"0", data: { list: Script[], total, page, pageSize } }`（按 `createdAt` 降序）

### 3. 脚本详情
`GET /api/ops/script/scripts/:id` → `200 { code:"0", data: Script }`
- 不存在：`404 { code:"SCRIPT_NOT_FOUND" }`

### 4. 更新脚本（双轨编辑 / 状态机）
`PUT /api/ops/script/scripts/:id`
```jsonc
{ "title":"...", "content":"...", "hook":"...", "hookEmotion":"好奇"?, "spokenTrack":[...]?, "subtitleTrack":[...]?, "status":"reviewing"? }
```
- 成功：`200 { code:"0", data: Script }`
- 不存在：`404 { code:"SCRIPT_NOT_FOUND" }`
- 非法状态流转（含原地流转、未知状态）：`400 { code:"SCRIPT_INVALID_TRANSITION" }`
- 钩子情绪非法：`400 { code:"EMOTION_INVALID" }`
- 发布（`status=published`）且当前 `complianceRisk.level=high`：`400 { code:"COMPLIANCE_BLOCKED" }`

### 5. 违禁词预检
`POST /api/ops/script/scripts/:id/check`
```jsonc
{ "content":"（可选，不传则对脚本当前 content 预检）" }
```
- 成功：`200 { code:"0", data: { complianceRisk: ComplianceRisk, traceId } }`（预检结果回写脚本 `complianceRisk`）
- 脚本不存在：`404 { code:"SCRIPT_NOT_FOUND" }`

### 6. 版本操作（存新版本 / 回滚）
`POST /api/ops/script/scripts/:id/version`
```jsonc
// 存新版本
{ "action":"save", "content":"...", "spokenTrack":[...]?, "subtitleTrack":[...]?, "title":"..."? }
// 回滚到历史版本
{ "action":"rollback", "sourceVersionId":2 }
```
- 成功：`200 { code:"0", data: { script: Script, traceId } }`
  - save：新脚本 `parentVersionId`=当前 id，`version`=当前+1，`status=draft`，其余继承
  - rollback：当前脚本内容被覆盖为 `sourceVersionId` 对应版本（须同选题同租户）
- 脚本不存在：`404 { code:"SCRIPT_NOT_FOUND" }`
- rollback 未指定 `sourceVersionId`：`400 { code:"SCRIPT_VERSION_REQUIRED" }`
- `sourceVersionId` 不存在（或跨选题/租户）：`404 { code:"SCRIPT_VERSION_NOT_FOUND" }`

### 7. 模板库
`GET /api/ops/script/templates` → `200 { code:"0", data: { templates: ScriptTemplate[] } }`
（当前内置 4 套：痛点开场型 / 悬念钩子型 / 对比测评型 / 情感共鸣型）

### Script（响应对象）
`{ id, tenantId, topicId, attributionId, title, content, hook, hookEmotion, spokenTrack?, subtitleTrack?, templateId?, version, parentVersionId?, status, complianceRisk?, promptVersion, modelUsed, createdAt, updatedAt }`

### 下游消费
- I 发布：按 E 的 `scheduledAt` + `accountId` 读取 F 已 `approved/published` 脚本，透传 `attributionId` 发布。

## I 发布与分发（I-core）`/api/ops/publish`

所有接口按请求头 `tenantId` 做租户隔离。消费 F 脚本（`ops_scripts`）+ B 账号（`ops_accounts`）多账号一键分发；**`attribution_id` 由 F 脚本透传、禁止在 I 重新生成**（规划 §4 链路只读透传）。发布前合规校验复用 F 脚本已算好的 `complianceRisk`（高危 level=high 禁止发布；阶段1 不另开 P 模块）。阶段1 独立运行模拟回执（`ext_post_id` 幂等去重），连接模式走 integration 适配层真实发布。

### 枚举取值
- `publish.status`：`queued` / `running` / `done` / `failed` / `published` / `retry`
- 可发布脚本状态：`approved` 或 `published`
- `ext_post_id`：平台回执幂等键（阶段1 形如 `pub_<tenant>_<scriptId>_<accountId>`）

### 1. 发起发布（一键分发）
`POST /api/ops/publish`
```jsonc
{ "scriptId": 1, "accountIds": [1,2], "platform":"douyin"?, "scheduledAt":"2026-09-01T00:00:00Z"?, "cartProductId":"p_123"? }
```
- 成功：`200 { code:"0", data: { taskIds: number[], traceId } }`（每账号一条任务，已发布）
- 脚本不存在：`404 { code:"SCRIPT_NOT_FOUND" }`
- 脚本未达可发布状态（非 approved/published）：`400 { code:"SCRIPT_NOT_PUBLISHABLE" }`
- 高危合规命中（脚本 complianceRisk.level=high）：`400 { code:"COMPLIANCE_BLOCKED" }`
- 发布账号不存在：`404 { code:"PUBLISH_ACCOUNT_NOT_FOUND" }`
- 指定平台与账号 platform 不一致：`400 { code:"PUBLISH_PLATFORM_MISMATCH" }`
- 幂等：同租户+scriptId+accountId 已存在 published 任务则直接返回原 task 不重复发

### 2. 批量分发
`POST /api/ops/publish/batch`
```jsonc
{ "tasks": [ { "scriptId":1, "accountIds":[1,2] }, { "scriptId":2, "accountIds":[3] } ] }
```
- 成功：`200 { code:"0", data: { taskIds: number[], traceId } }`（所有脚本×账号展开为多条任务）

### 3. 发布详情
`GET /api/ops/publish/:id` → `200 { code:"0", data: PublishTask }`
- 不存在：`404 { code:"PUBLISH_NOT_FOUND" }`

### 4. 挂车转化漏斗
`GET /api/ops/publish/:id/funnel` → `200 { code:"0", data: { cartClicks, orderConv, conversionRate } }`
（阶段1 cartClicks/orderConv 为 0，conversionRate=0；经 Y 订单回写 orderConv）

### PublishTask（响应对象）
`{ id, tenantId, scriptId, accountId, platform, attributionId, videoId?, scheduledAt?, status, retryCount, errorMsg?, extPostId?, cartProductId?, cartClicks, orderConv, publishedAt?, createdAt, updatedAt }`

### 下游消费
- J 回收：published → 拉取播放/完播/互动/涨粉 → 评论回流 D 再分析；`attributionId` 贯通效果归因
- Y 订单：I 挂车转化写入 `attributionId` → 订单来源追溯 → 佣金归因 W

## L 工作流编排（L-core）`/api/ops/workflows` + `/api/ops/workflow-runs`

所有接口按请求头 `tenantId` 做租户隔离。将阶段1 模块串联为 pipeline：**collect(C) → analyze(D) → ideate(E) → script(F) → publish(I)**（recycle=J 阶段1 占位），单节点失败隔离、DAG 保存校验、SSE 实时进度。

### 枚举取值
- 节点类型 `nodes[].type`：`collect` / `analyze` / `ideate` / `script` / `publish` / `recycle`
- 触发 `trigger`：`manual` / `cron` / `event`（cron 须带 `cronExpr`）
- 运行整体状态 `workflow_runs.status`：`queued` / `running` / `success` / `failed` / `partial`
- 节点日志状态 `workflow_run_logs.status`：`running` / `done` / `failed` / `skipped`

### 1. 新建编排
`POST /api/ops/workflows`
```jsonc
{ "name":"日更闭环", "trigger":"manual",
  "nodes":[
    {"id":"c1","type":"collect"},
    {"id":"d1","type":"analyze"},
    {"id":"e1","type":"ideate","config":{"driver":"贪"}},
    {"id":"f1","type":"script"},
    {"id":"i1","type":"publish","config":{"accountIds":[1],"platform":"douyin"}}
  ],
  "edges":[{"from":"c1","to":"d1"},{"from":"d1","to":"e1"},{"from":"e1","to":"f1"},{"from":"f1","to":"i1"}]
}
```
- 成功：`200 { code:"0", data: WorkflowDef }`
- 节点 id 重复：`400 { code:"WORKFLOW_NODE_DUP" }`
- 边引用不存在节点：`400 { code:"WORKFLOW_EDGE_INVALID" }`
- 存在环（DAG 校验）：`400 { code:"WORKFLOW_DAG_CYCLE" }`
- trigger=cron 缺 cronExpr：`400 { code:"WORKFLOW_CRON_REQUIRED" }`

### 2. 编排列表
`GET /api/ops/workflows?page=1&pageSize=20` → `200 { code:"0", data: { list, total, page, pageSize } }`

### 3. 启停/更新编排
`POST /api/ops/workflows/:id`
```jsonc
{ "enabled":false }  // 或更新 nodes/edges/trigger/cronExpr（更新时同样做 DAG 校验）
```
- 成功：`200 { code:"0", data: WorkflowDef }`；不存在：`404 { code:"WORKFLOW_NOT_FOUND" }`

### 4. 触发运行
`POST /api/ops/workflows/:id/run` → `200 { code:"0", data: { runId, traceId } }`
- 不存在：`404 { code:"WORKFLOW_NOT_FOUND" }`
- 运行逻辑：拓扑排序按 edges 顺序执行节点，串联 C→D→E→F→I；单节点失败隔离（整 run=partial 而非全败）；`attribution_id` 沿链透传
- 节点缺上游产出（如 script 节点无 topicId）：该节点 `failed`，`output={error}`，不阻断其余节点

### 5. SSE 实时进度
`GET /api/ops/workflow-runs/:id/stream` → `text/event-stream`（每 ~500ms 推送 `{ run, logs }`，终态后结束）
- 事件：`data: {"run":WorkflowRun,"logs":WorkflowRunLog[]}\n\n`

### 下游消费
- 串联 C/D/E/F/I 全链路；recycle(J) 阶段1 已承接反馈回路（见 §4-J）

## J 数据监控与回收（J-core）`/api/ops/recycle` + `/api/ops/dashboard` + `/api/ops/feedback` + `/api/ops/analysis`

阶段1 MVP 最后一环，回收 I 发布表现回流 D 再分析、反哺 E 选题权重，形成 C→D→E→F→I→J→(D) 闭环。所有接口按请求头 `tenantId` 做租户隔离。**仅存聚合表现与回收评论文本（已脱敏），不留存任何单条个人信息**（合规边界②）。`attribution_id` 由 I 透传（F→I→J 只读，禁止在 J 重新生成），贯通效果归因。

### 枚举取值
- `recycle.scope`：`video`（单视频）| `account`（账号）| `all`（全量）
- `recycle.status`：`pending` | `running` | `done` | `failed`
- 五维指标 `metrics`：`play`(播放) / `completeRate`(完播率) / `interact`(互动) / `fanInc`(涨粉) / `commission`(佣金)
- 四率：`completeRate`(完播率) / `interactRate`(互动率=互动/播放) / `fanRate`(涨粉率=涨粉/播放) / `conversionRate`(转化率=佣金/播放)

### 1. 发起回收（消费 I 发布数据）
`POST /api/ops/recycle`
```jsonc
{ "scope":"all", "targetRef":"", "metrics"?{}, "comments"?"" }
```
- 成功：`200 { code:"0", data: { taskId, traceId } }`（`status=running` 同步执行回收→反馈落库→计算人性效能→反哺 E 权重→`status=done`）
- 无可回收数据（需先经 I 发布内容）：`400 { code:"RECYCLE_NO_DATA" }`
- 单视频模式 `targetRef` 非法（无法解析为发布任务 id 或 extPostId）：`400 { code:"RECYCLE_TARGET_INVALID" }`

### 2. 回收任务进度
`GET /api/ops/recycle/:id` → `200 { code:"0", data: RecycleTask }`
- 不存在：`404 { code:"RECYCLE_TASK_NOT_FOUND" }`

### 3. 看板概览（五维四率）
`GET /api/ops/dashboard/overview` → `200 { code:"0", data: { totalPlay, avgCompleteRate, totalInteract, totalFanInc, totalCommission, completeRate, interactRate, fanRate, conversionRate, videoCount } }`
- 无数据：`400 { code:"RECYCLE_NO_DATA" }`
- 注：该路由已于 **M 决策仪表盘**（§4-M）统一提供（避免路由冲突），J(recycle) 控制器不再暴露，聚合逻辑由 RecycleService 复用。

### 4. 人性效能（7×6 反哺 E 权重）
`GET /api/ops/dashboard/driver-efficiency` → `200 { code:"0", data: DriverEfficiency[] }`
（按 `avgPlay` 降序；若尚未跑回收任务则按当前反馈实时兜底计算）
- 注：该路由已于 **M 决策仪表盘**（§4-M，`/dashboard/human-hook`）统一提供（避免路由冲突），J(recycle) 控制器不再暴露，聚合逻辑由 RecycleService 复用。

### 5. 单视频回收明细（含回流再分析状态）
`GET /api/ops/feedback/:video_id` → `200 { code:"0", data: { feedback: Feedback, reanalysisStatus? } }`
- `feedback.videoId` = I 发布任务 id；`reanalysisStatus` 为回流 D 再分析任务状态（pending/running/done/failed），未回流则为空
- 不存在：`404 { code:"FEEDBACK_NOT_FOUND" }`

### 6. 回收评论回流 D 再分析（闭环）
`POST /api/ops/analysis/rerun` → `200 { code:"0", data: { analysisId, traceId, feedbackCount } }`
- 将所有回收评论以 is_clean 形态注入 `ops_collected_comments`，按 `attribution_id` 分组各建一条异步分析任务，并回写 `feedback.re_analysis_id` 形成闭环
- 无回收数据：`400 { code:"RECYCLE_NO_DATA" }`

### RecycleTask（响应对象）
`{ id, tenantId, scope, targetRef, status, progress, lastCollectedAt?, createdAt, updatedAt }`

### Feedback（响应对象）
`{ id, tenantId, topicId?, videoId?, platform?, attributionId, metrics?, comments?, reAnalysisId?, collectedAt?, createdAt, updatedAt }`

### DriverEfficiency（响应对象）
`{ id, tenantId, driver, emotion, sampleCount, avgPlay, avgCompleteRate, avgInteractRate, avgConversion, window, statDate, createdAt, updatedAt }`

### 闭环与反哺
- I → J：回收 I 已发布任务的表现（五维）与评论；`attributionId` 贯通效果归因（只读透传）
- J → D：`POST /analysis/rerun` 将评论注入 `collected_comments` 回流再分析，`feedback.re_analysis_id` 记录闭环
- J → E：回收后计算 `driver_efficiency`（按人性×情绪聚合），将转化率最高的人性维度对命中选题 `score+8`（封顶100），使高转化人性在下一轮 E 生成自然上浮
- 合规：仅存聚合表现与已脱敏评论，无单条个人信息落库（合规边界②）

## N 团队与权限（N-core）`/api/ops/roles` + `/api/ops/audit`

阶段1 MVP 登录体系尚未就绪，与既有模块保持一致——鉴权守卫（JwtAuthGuard + 权限点校验）待登录体系就绪后统一加装。本模块落地 RBAC 角色/权限管理与操作审计（规划「N 团队与权限」详细设计）：`ops_roles` / `ops_role_user` / `ops_audit_logs`，全部按 `tenant_id` 强隔离。`AuditService.record` 已导出供各业务模块注入调用，落地"操作审计：全局记录"。

### 实体
- `ops_roles`（角色：name/description/permissions(JSON string[])/isSystem）
- `ops_role_user`（用户-角色绑定：userId/roleId；同一租户 (tenantId,userId,roleId) 唯一；userId 来自管理系统 SSO 透传，运营系统不持有用户表）
- `ops_audit_logs`（审计：userId/action/module/resource/traceId/ts）

### 权限点
- 权限点为 `module:action` 形式字符串（如 `account:read`、`role:manage`、`audit:read`）；各模块自定义，常用清单见 `src/modules/n/n.types.ts` 的 `COMMON_PERMISSIONS`。

### 1. 创建角色
`POST /api/ops/roles`
```jsonc
{ "name":"运营", "description"?:"...", "permissions":["account:read","role:manage"] }
```
- 成功：`200 { code:"0", data: RoleView }`
- 同租户重名：`409 { code:"ROLE_DUPLICATE" }`

### 2. 角色列表（分页）
`GET /api/ops/roles?page=1&pageSize=20` → `200 { code:"0", data: { list, total, page, pageSize } }`

### 3. 角色详情
`GET /api/ops/roles/:id` → `200 { code:"0", data: RoleView }`；不存在：`404 { code:"ROLE_NOT_FOUND" }`

### 4. 更新角色（局部更新）
`PATCH /api/ops/roles/:id` → `200 { code:"0", data: RoleView }`；不存在：`404 { code:"ROLE_NOT_FOUND" }`

### 5. 删除角色（软删，级联移除绑定）
`DELETE /api/ops/roles/:id` → `200 { code:"0", data: { id } }`
- 不存在：`404 { code:"ROLE_NOT_FOUND" }`；系统内置角色：`403 { code:"ROLE_SYSTEM_PROTECTED" }`

### 6. 给用户分配角色
`POST /api/ops/roles/:id/assign`
```jsonc
{ "userId": 100 }
```
- 成功：`200 { code:"0", data: { roleId, userId } }`；角色不存在：`404 { code:"ROLE_NOT_FOUND" }`；已绑定：`409 { code:"ROLE_ASSIGN_DUP" }`

### 7. 移除用户角色
`DELETE /api/ops/roles/:id/assign/:userId` → `200 { code:"0", data: { roleId, userId } }`
- 绑定不存在：`404 { code:"ROLE_USER_NOT_FOUND" }`

### 8. 用户角色与权限
`GET /api/ops/roles/user/:userId` → `200 { code:"0", data: { userId, roles: RoleView[], permissions: string[] } }`（permissions 为所有角色合并去重）

### 9. 操作审计查询
`GET /api/ops/audit?page=1&pageSize=20&module=role&action=create_role&userId=100` → `200 { code:"0", data: { list, total, page, pageSize } }`（按 ts 降序；module/action/userId 可选过滤）
- 审计写入由 `AuditService.record` 供各模块内部调用，不暴露 HTTP 写入口。

### RoleView（响应对象）
`{ id, name, description?, permissions: string[], isSystem, createdAt, updatedAt }`

### 跨租户隔离
- 所有角色/绑定/审计查询 where 均携带 `tenant_id`；`ops_roles(name)`、`ops_role_user(userId,roleId)` 唯一约束均含 `tenant_id`。

## T 选品中心（T-core）`/api/ops/selection`

阶段1 MVP 登录体系未就绪，与既有模块一致——鉴权守卫待登录体系就绪后统一加装。本模块落地选品中心（规划「T 选品中心」详细设计）：`ops_selection_products` / `ops_selection_lists`，全部按 `tenant_id` 强隔离；`human_driver` 映射 D 字典（7 人性），供选品→内容 R 联动。`AuditService.record` 已注入（TModule import NModule），关键写操作落审计。

### 实体
- `ops_selection_products`（选品：source/platform/externalProductId/title/commissionRate(DECIMAL %)/reputationScore(口碑分)/sales30d/price/category/humanDriver(人性)/metrics(JSON)/collectedAt）
- `ops_selection_lists`（选品清单：name/items(JSON number[])）

### 数据来源
- 导入优先 `products` 本地录入（standalone 友好）；传 `ids` 需 connected 模式经适配层 `ProductAdapter.getProductsByIds` 批量拉取（R10 已扩展适配层接口）。
- standalone 下仅传 `ids` 会抛 `SELECTION_IMPORT_MODE_UNSUPPORTED`（提示直接传 products）。

### 1. 导入选品
`POST /api/ops/selection/import`
```jsonc
{ "source":"manual", "platform"?: "douyin", "ids"?: ["p1"], "products"?: [{ "title":"...", "commissionRate":20, "humanDriver":"贪" }] }
```
- 成功：`200 { code:"0", data: SelectionProductView[] }`（落审计 action=import_selection）
- products/ids 均空：`400 { code:"SELECTION_IMPORT_EMPTY" }`
- standalone 仅传 ids：`400 { code:"SELECTION_IMPORT_MODE_UNSUPPORTED" }`
- humanDriver 非法（非 D 字典 7 人性）：`400 { code:"SELECTION_INVALID_HUMAN_DRIVER" }`

### 2. 选品库筛选
`GET /api/ops/selection?commissionRateMin=20&reputationMin=4.6&salesMin=100&category=美妆&humanDriver=贪&keyword=xxx&page=1&pageSize=20` → `200 { code:"0", data: { list, total, page, pageSize } }`（按 sales30d 降序）

### 3. 榜单（飙升/黑马预警）
`GET /api/ops/selection/hot` → `200 { code:"0", data: { surging: HotItem[], darkHorse: HotItem[] } }`（surging 销量 top；darkHorse 口碑≥4.6 且销量低 top）

### 4. 蓝海词 / 黑马预警
`GET /api/ops/selection/blue-ocean` → `200 { code:"0", data: BlueOceanItem[] }`（按 category 聚合，score=avgCommission*100/(avgSales+1) 降序）

### 5. 新建选品清单
`POST /api/ops/selection/lists`
```jsonc
{ "name":"618主推", "items"?: [1,2,3] }
```
- 成功：`200 { code:"0", data: SelectionListView }`（落审计 action=create_selection_list）
- items 引用不存在选品：`404 { code:"SELECTION_PRODUCT_NOT_FOUND" }`

### 6. 选品清单列表
`GET /api/ops/selection/lists` → `200 { code:"0", data: SelectionListView[] }`

### 7. 选品清单详情（展开选品）
`GET /api/ops/selection/lists/:id` → `200 { code:"0", data: { ...SelectionListView, products: SelectionProductView[] } }`；不存在：`404 { code:"SELECTION_LIST_NOT_FOUND" }`

### 8. 删除选品清单
`DELETE /api/ops/selection/lists/:id` → `200 { code:"0", data: { id } }`（软删，落审计）；不存在：`404 { code:"SELECTION_LIST_NOT_FOUND" }`

### 视图对象
- `SelectionProductView`：`{ id, source, platform, externalProductId, title, commissionRate, reputationScore, sales30d, price, category, humanDriver, metrics, collectedAt, createdAt, updatedAt }`
- `SelectionListView`：`{ id, name, items:number[], itemCount, createdAt, updatedAt }`
- `HotItem`：`{ id, title, commissionRate, reputationScore, sales30d, humanDriver }`
- `BlueOceanItem`：`{ category, avgCommissionRate, avgSales30d, score }`

### 与 R 联动
- `human_driver` 字段为 D 字典 7 人性之一（贪/懒/怕/虚荣/窥探/孤独爱/愤怒不公），R 商品内容生成时按选品人性驱动选题方向。

### 跨租户隔离
- 所有选品/清单查询 where 均携带 `tenant_id`；导入落库 tenantId 取自 `TenantContext`。

## R 商品内容中心（R-core）`/api/ops/products`
阶段1 MVP 登录体系未就绪，与既有模块一致——鉴权守卫待登录体系就绪后统一加装。落地商品内容中心（规划「R 商品内容中心」详细设计）：`ops_products` / `ops_product_contents` / `ops_product_detail_pages`，全部按 `tenant_id` 强隔离；`human_driver` 映射 D 字典（7 人性），与 T 选品联动；AI 内容生成经 SkillGateway（本地 Ollama）生成标题/卖点/详情/话术/种草；合规校验为 P 内嵌兜底（基础违禁词，P 模块阶段补完）。`AuditService.record` 已注入（RModule import NModule），关键写操作落审计。

### 实体
- `ops_products`（商品：sourceType(system/manual/competitor/t_selection)/externalProductId/selectionProductId(→T)/title/stock(库存单一真源)/price/category/humanDriver(人性)）
- `ops_product_contents`（AI 内容：productId/humanDriver/titleAi/sellingPoint(映射人性)/content(JSON sections)/script(口播话术)/xhsCopy(种草)/version/complianceRisk/status）
- `ops_product_detail_pages`（详情页：productId/sections(JSON)）

### 数据接入（三源）
- `manual`/`competitor`：直接录入（`title` 必填）；standalone 友好
- `system`：需 connected 模式经适配层 `ProductAdapter.getProduct(externalProductId)` 拉取；standalone 仅传该源→`PRODUCT_SOURCE_UNSUPPORTED_IN_STANDALONE`
- `t_selection`：传 `selectionProductId`，从 T 选品库继承 `humanDriver`/`title`/`price`/`category`（与 T 联动）；缺失→`PRODUCT_SELECTION_REQUIRED`，不存在→`PRODUCT_SELECTION_NOT_FOUND`

### 1. 商品接入
`POST /api/ops/products`
```jsonc
{ "sourceType":"manual", "title":"...", "stock":10, "category":"美妆", "humanDriver":"贪" }
```
- 成功：`200 { code:"0", data: ProductView }`（落审计 action=import_product）
- manual/competitor 缺 title：`400 { code:"PRODUCT_TITLE_REQUIRED" }`
- system + standalone：`400 { code:"PRODUCT_SOURCE_UNSUPPORTED_IN_STANDALONE" }`
- 非法 humanDriver：`400 { code:"PRODUCT_INVALID_HUMAN_DRIVER" }`

### 2. 商品库
`GET /api/ops/products?category=美妆` → `200 { code:"0", data: ProductView[] }`

### 3. AI 生成内容
`POST /api/ops/products/:id/content/generate`
```jsonc
{ "humanDriver"?: "贪", "platform"?: "douyin|wechat|xhs|kuaishou" }
```
- 成功：`200 { code:"0", data: ProductContentView }`（调 SkillGateway 生成 标题/卖点/详情/话术/种草，version 自增，落审计 action=generate_product_content）
- 商品不存在：`404 { code:"PRODUCT_NOT_FOUND" }`

### 4. 商品内容（最新版本）
`GET /api/ops/products/:id/content` → `200 { code:"0", data: ProductContentView }`；无内容：`404 { code:"PRODUCT_CONTENT_NOT_FOUND" }`

### 5. 合规校验（P 内嵌兜底）
`POST /api/ops/products/:id/content/check` → `200 { code:"0", data: { risk: "none"|"low"|"high", hits: string[] } }`（扫描标题/AI标题/卖点/话术/种草/详情，命中基础违禁词；落审计 action=check_product_compliance）

### 6. 生成详情页
`POST /api/ops/products/:id/detail-page`
```jsonc
{ "sections"?: [{ "title":"区块1", "body":"内容" }] }
```
- 成功：`200 { code:"0", data: ProductDetailPageView }`（落审计 action=create_product_detail_page）

### 7. 库存扣减/回写（Y 联动）
`PATCH /api/ops/products/:id/stock`
```jsonc
{ "delta": -3, "reason"?: "订单扣减" }  // 负=扣减，正=回写/入库
```
- 成功：`200 { code:"0", data: ProductView }`（stock 单一真源在运营系统 standalone，落审计 action=update_product_stock）
- 扣减后为负：`400 { code:"PRODUCT_STOCK_INSUFFICIENT" }`

### 视图对象
- `ProductView`：`{ id, sourceType, externalProductId, selectionProductId, title, stock, price, category, humanDriver, createdAt, updatedAt }`
- `ProductContentView`：`{ id, productId, humanDriver, titleAi, sellingPoint, content, script, xhsCopy, version, complianceRisk, status, createdAt, updatedAt }`
- `ProductDetailPageView`：`{ id, productId, sections, createdAt, updatedAt }`

### 与 T/K/S/Y 联动
- `human_driver` 同 T 选品映射 D 字典（选品→内容驱动选题方向）；`t_selection` 接入直接继承 T 选品人性。
- → I/S 挂车（商品作挂车，经 ProductAdapter.bindCart）；→ K 直播（商品挂载）；→ Y 库存联动（stock 扣减/回写）。

### 跨租户隔离
- 所有商品/内容/详情页查询 where 均携带 `tenant_id`；接入落库 tenantId 取自 `TenantContext.requireTenantId()`。

## K 直播中心（K-core）`/api/ops/live`
阶段1 MVP 登录体系未就绪，与既有模块一致——鉴权守卫待登录体系就绪后统一加装。落地直播中心（规划「K 直播中心」详细设计）：`ops_live_rooms` / `ops_digital_humans` / `ops_live_danmu` / `ops_live_ai_replies` / `ops_live_stats`，全部按 `tenant_id` 强隔离；直播间关联 B 账号矩阵（`account_id`）、挂载 R 商品（`product_ids` JSON）、建 room 时生成 live 类 `attribution_id`（§12）；数字人弹幕 AI 应答经 `SkillGateway`；`AuditService.record` 已注入（KModule import NModule），关键写操作落审计。

### 实体
- `ops_live_rooms`（直播间：type(real/digital)/platform/account_id(→B)/rtmp_url/status(created/live/ended)/title/product_ids(→R JSON)/attribution_id(live)/started_at/ended_at）
- `ops_digital_humans`（数字人：name/avatar/voice/status）
- `ops_live_danmu`（弹幕：room_id/content/is_ai_reply/ai_reply/ts）
- `ops_live_ai_replies`（弹幕AI应答：room_id/question/answer/status(auto/pending)）
- `ops_live_stats`（实时统计：room_id/online_count/gmv/attribution_id/ts）

### 与 B/R 联动
- `account_id` → B 账号矩阵（`ops_accounts`，校验存在且属本租户）；`product_ids` → R 商品（`ops_products`，校验全部属本租户）。
- `attribution_id` 在建 room 时生成（`generateAttributionId(tenantId,'live',seed)`），stats 上报透传，供 J 复盘贯通。

### 1. 建直播间（生成 attribution_id + 绑定 B + 挂载 R）
`POST /api/ops/live/rooms`
```jsonc
{ "type":"real", "platform":"douyin", "accountId":10, "title":"测试直播", "productIds":[1,2] }
```
- 成功：`200 { code:"0", data: LiveRoomView }`（attribution_id 形如 `attr_<tenant>_live_<hash32>`，落审计 action=create_live_room）
- B 账号不存在：`404 { code:"LIVE_ACCOUNT_NOT_FOUND" }`
- 挂载 R 商品缺失/越租户：`404 { code:"LIVE_PRODUCT_NOT_FOUND" }`

### 2. 开播（created→live）
`POST /api/ops/live/rooms/:id/start` → `200 { code:"0", data: LiveRoomView }`（落审计 action=start_live_room）；非 created：`400 { code:"LIVE_ROOM_NOT_CREATED" }`；不存在：`404 { code:"LIVE_ROOM_NOT_FOUND" }`

### 3. 结束（live→ended）
`POST /api/ops/live/rooms/:id/end` → `200 { code:"0", data: LiveRoomView }`（落审计 action=end_live_room）；非 live：`400 { code:"LIVE_ROOM_NOT_LIVE" }`

### 4. 推流（中控）
`POST /api/ops/live/rooms/:id/push` `{"rtmpUrl":"rtmp://..."}` → `200 { code:"0", data: LiveRoomView }`；缺 rtmpUrl：`400 { code:"LIVE_RTMP_URL_REQUIRED" }`

### 5. 直播间详情
`GET /api/ops/live/rooms/:id` → `200 { code:"0", data: LiveRoomView }`

### 6. 实时监控
`GET /api/ops/live/rooms/:id/stats` → `200 { code:"0", data: LiveStatView|null }`（最新一条 live_stats）

### 7. 上报统计（透传 attribution_id）
`POST /api/ops/live/rooms/:id/stats` `{"onlineCount":100,"gmv":500}` → `200 { code:"0", data: LiveStatView }`（attribution_id 取自直播间）

### 8. 数字人管理
`POST /api/ops/live/digital-humans` `{"name":"小智","voice":"女声"}` → `200 { code:"0", data: DigitalHumanView }`

### 9. 弹幕 AI 应答闭环
`POST /api/ops/live/danmu/ai-reply` `{"roomId":5,"question":"多少钱","status":"auto"}`
- `auto`：调 `SkillGateway.generateText` 生成回复并落 `ops_live_danmu`（is_ai_reply=true），落审计 action=live_danmu_ai_reply → `200 { code:"0", data: LiveAiReplyView }`
- `pending`：仅落待确认记录，不调 SkillGateway → `200 { code:"0", data: LiveAiReplyView }`（answer=null）

### 视图对象
- `LiveRoomView`：`{ id, type, platform, accountId, rtmpUrl, status, title, productIds, attributionId, startedAt, endedAt, createdAt, updatedAt }`
- `DigitalHumanView`：`{ id, name, avatar, voice, status, createdAt, updatedAt }`
- `LiveAiReplyView`：`{ id, roomId, question, answer, status }`
- `LiveStatView`：`{ id, roomId, onlineCount, gmv, attributionId, ts }`

### 跨租户隔离
- 所有直播间/弹幕/应答/统计查询 where 均携带 `tenant_id`；落库 tenantId 取自 `TenantContext.requireTenantId()`。

## S 投流管理（S-core）`/api/ops/ad`
阶段1 MVP 登录体系未就绪，与既有模块一致——鉴权守卫待登录体系就绪后统一加装。落地投流管理（规划「S 投流」详细设计）：`ops_ad_accounts` / `ops_ad_campaigns` / `ops_ad_metrics`，全部按 `tenant_id` 强隔离；建计划时生成 ad 类 `attribution_id`（§12）；智能出价经 `SkillGateway`；`AuditService.record` 已注入（SModule import NModule），关键写操作落审计。

### 实体
- `ops_ad_accounts`（投放账户：platform/douyin|wechat|kuaishou、type(千川/ADQ/小店通)/auth_enc(加密)/status(active/expired/banned)）
- `ops_ad_campaigns`（计划：account_id/name/plan_type(standard|full_domain|crowd|bid)/audience(JSON)/budget/spend/roi/attribution_id(ad)/status(draft|running|paused|ended)）
- `ops_ad_metrics`（指标：campaign_id/date/impressions/clicks/conversions/cost/roi）

### 与 J/W 联动
- `attribution_id` 在建计划时生成（`generateAttributionId(tenantId,'ad',seed)`），复盘透传，供 J 归因/ W 对账（消耗/ROI）贯通。
- 素材关联 G/H 在阶段3（MVP 预留 audience 定向字段）；智能出价 MVP 产出建议不实际改平台出价。

### 1. 投放账户绑定
`POST /api/ops/ad/accounts` `{"platform":"douyin","type":"qianchuan","authEnc":"..."}` → `200 { code:"0", data: AdAccountView }`（落审计 action=bind_ad_account）

### 2. 建计划（生成 attribution_id(ad)）
`POST /api/ops/ad/campaigns` `{"accountId":3,"name":"618大促","planType":"standard","budget":1000,"audience":{...}}`
- 成功：`200 { code:"0", data: AdCampaignView }`（attribution_id 形如 `attr_<tenant>_ad_<hash32>`，落审计 action=create_ad_campaign）
- 投放账户不存在：`404 { code:"AD_ACCOUNT_NOT_FOUND" }`

### 3. 实时监控
`GET /api/ops/ad/campaigns/:id/metrics` → `200 { code:"0", data: AdMetricView|null }`（最新一条 ad_metrics）；不存在：`404 { code:"AD_CAMPAIGN_NOT_FOUND" }`

### 4. 智能出价
`POST /api/ops/ad/campaigns/:id/smart-bid` `{"targetRoi":3}` → `200 { code:"0", data: { suggestion } }`（调 SkillGateway 给建议，落审计 action=ad_smart_bid）

### 5. 复盘（五维四率/撬自然流）
`GET /api/ops/ad/campaigns/:id/review` → `200 { code:"0", data: AdReviewView }`（聚合指标 + 透传 attribution_id + 算 ROI）；不存在：`404 { code:"AD_CAMPAIGN_NOT_FOUND" }`

### 6. 指标上报（回写 spend/roi）
`POST /api/ops/ad/campaigns/:id/metrics` `{"cost":100,"conversions":2}` → `200 { code:"0", data: AdMetricView }`（累加 campaign.spend）

### 视图对象
- `AdAccountView`：`{ id, platform, type, status, createdAt, updatedAt }`
- `AdCampaignView`：`{ id, accountId, name, planType, audience, budget, spend, roi, attributionId, status, createdAt, updatedAt }`
- `AdMetricView`：`{ id, campaignId, date, impressions, clicks, conversions, cost, roi }`
- `AdReviewView`：`{ campaignId, attributionId, totalSpend, totalCost, totalConversions, roi, metricsCount }`

### 跨租户隔离
- 所有账户/计划/指标查询 where 均携带 `tenant_id`；落库 tenantId 取自 `TenantContext.requireTenantId()`。

## U 粉丝与私域运营（U-core）`/api/ops`
阶段1 MVP 登录体系未就绪，与既有模块一致——鉴权守卫待登录体系就绪后统一加装。落地私域运营（规划「U 私域」详细设计）：`ops_fans_profiles` / `ops_private_groups`，全部按 `tenant_id` 强隔离。

### 合规边界（§11②，硬性）
- 仅经平台开放 API / 用户授权；仅存**聚合分布**与**公开字段**（public_id）；**禁止**未授权个体精准地理位置与个体隐私画像。
- `fans_profiles` 仅含 platform/public_id/level/interact_agg(聚合)/tags(分层)/source；`private_groups.members` 仅存粉丝公开ID。
- DTO 不接受任何个体隐私字段（geoLocation/realName 等）；service 不做个体画像落库。

### 实体
- `ops_fans_profiles`（粉丝画像：platform/public_id(公开ID)/level/interact_agg(JSON 聚合)/tags(JSON 分层)/source(aggregate/authorized/public)）
- `ops_private_groups`（私域群：name/members(JSON 公开ID)/type(wecom/wechat)）

### 与 I/K/J/W 联动
- ← I/K 账号（多账号私域承接）；→ J 用户侧归因（attribution 贯通 content/ad/user）；→ W 复购佣金（分销/复购仅公开ID + 金额/佣金比例）。

### 1. 粉丝画像 upsert（仅聚合/公开字段）
`POST /api/ops/fans` `{"platform":"douyin","publicId":"pub_123","level":"vip","interactAgg":{"avgWatchSec":30},"tags":["高活跃"],"source":"public"}` → `200 { code:"0", data: FansProfileView }`（落审计 action=upsert_fans_profile）

### 2. 粉丝画像（聚合分布列表）
`GET /api/ops/fans?platform=douyin` → `200 { code:"0", data: FansProfileView[] }`

### 3. 分层打标
`POST /api/ops/fans/tags` `{"id":7,"tags":["高价值"]}` → `200 { code:"0", data: FansProfileView }`；不存在：`404 { code:"FANS_PROFILE_NOT_FOUND" }`

### 4. 建私域群（合规：members 仅公开ID）
`POST /api/ops/private-groups` `{"name":"VIP群","type":"wecom","members":["pub_1","pub_2"]}` → `200 { code:"0", data: PrivateGroupView }`（落审计 action=create_private_group）

### 5. 私域触达（企微/微信，合规）
`POST /api/ops/private-groups/:id/push` → `200 { code:"0", data: { pushed: number } }`（仅向群内已授权公开ID触达）；不存在：`404 { code:"PRIVATE_GROUP_NOT_FOUND" }`

### 6. 推客分销（分级佣金 → W）
`POST /api/ops/fans/distribute` `{"publicIds":["a","b"],"planName":"618分销","tierCommission":0.1}` → `200 { code:"0", data: { planName, tiers, commission } }`（落审计 action=fans_distribute）

### 7. 复购 CRM（→ W）
`POST /api/ops/fans/repurchase` `{"publicId":"pub_1","amount":199}` → `200 { code:"0", data: { publicId, amount } }`（落审计 action=fans_repurchase）

### 视图对象
- `FansProfileView`：`{ id, platform, publicId, level, interactAgg, tags, source, createdAt, updatedAt }`
- `PrivateGroupView`：`{ id, name, members, type, createdAt, updatedAt }`

### 跨租户隔离
- 所有粉丝/群查询 where 均携带 `tenant_id`；落库 tenantId 取自 `TenantContext.requireTenantId()`。

## W 收益与对账（W-core）`/api/ops`
阶段2 商业化闭环（规划 §4-W）。收益登记、对账、分账、开票、利润统计；全部按 `tenant_id` 强隔离。前置未就绪登录体系，与既有模块一致——鉴权守卫待登录体系就绪后统一加装。落地 `ops_revenue_records` / `ops_reconciliations` / `ops_settlements`（迁移 `015_w_revenue.sql`）。

### 实体
- `ops_revenue_records`（收益记录：source(commission/tip/product)/platform/amount/commission/status(pending/settled)/period(YYYY-MM)/bizDate）
- `ops_reconciliations`（对账：period/orderAmount/commissionAmount/settledAmount/diff/status(matched/diff_found)）
- `ops_settlements`（分账：type(org_talent_advertiser)/amount/parties(JSON 各方{role,name,amount})/status(pending/invoiced)/invoiceNo）

### 与 K/S/R/U 联动
- ← K 直播带货成交、S 投流消耗、R 商品成交、U 复购分销佣金；→ 利润与对账为商业化结算总出口。

### 1. 录入收益
`POST /api/ops/revenue` `{"source":"commission","platform":"douyin","amount":100,"commission":20}` → `200 { code:"0", data: RevenueView(status:"pending") }`（落审计 action=record_revenue）

### 2. 收益列表（按 source 汇总）
`GET /api/ops/revenue` → `200 { code:"0", data: { summary:[{source,total,count}], items: RevenueView[] } }`
`GET /api/ops/revenue?source=commission` → 仅该 source 汇总与明细。

### 3. 生成对账（按 period 仅取当月收益）
`POST /api/ops/reconciliation` `{"period":"2026-08"}` → `200 { code:"0", data: ReconciliationView }`；orderAmount=应收总额、settledAmount=已结算、diff=差额、status=`matched`(diff=0)/`diff_found`(diff≠0)（落审计 action=reconcile）

### 4. 对账明细
`GET /api/ops/reconciliation/:id` → `200 { code:"0", data: ReconciliationView }`；不存在：`404 { code:"RECONCILIATION_NOT_FOUND" }`

### 5. 分账（各方金额合计须==总额）
`POST /api/ops/settlement` `{"type":"org_talent_advertiser","amount":100,"parties":[{"role":"org","name":"MCN","amount":30},{"role":"talent","name":"达人A","amount":60},{"role":"ad_operator","name":"投手B","amount":10}]}` → `200 { code:"0", data: SettlementView(status:"pending") }`
各方合计≠总额：`400 { code:"SETTLEMENT_PARTIES_MISMATCH" }`

### 6. 开票（分账→已开票）
`POST /api/ops/settlement/:id/invoice` → `200 { code:"0", data: SettlementView(status:"invoiced", invoiceNo:"INV-<id>-<timestamp>") }`；不存在：`404 { code:"SETTLEMENT_NOT_FOUND" }`

### 7. 利润统计（收入-投流消耗-佣金）
`GET /api/ops/profit` → `200 { code:"0", data: { totalRevenue, totalCommission, totalAdCost, netProfit } }`（投流消耗取自 S 模块 `ad_metrics.cost`）

### 视图对象
- `RevenueView`：`{ id, source, platform, amount, commission, status, period, bizDate, createdAt, updatedAt }`
- `ReconciliationView`：`{ id, period, orderAmount, commissionAmount, settledAmount, diff, status, createdAt, updatedAt }`
- `SettlementView`：`{ id, type, amount, parties, status, invoiceNo, createdAt, updatedAt }`

### 跨租户隔离
- 所有收益/对账/分账查询 where 均携带 `tenant_id`；落库 tenantId 取自 `TenantContext.requireTenantId()`。

## Y 订单与物流（Y-core）`/api/ops`
阶段2 商业化收口（规划 §4-Y）。订单与物流中心：双源接入（管理系统适配层 management / 平台开放订单 platform）、幂等去重、库存联动（扣减/回写 R 库存单一真源）、物流轨迹、电子面单、仓储库存回传、库存预警、attribution 贯通、收货信息 AES 加密 + 展示脱敏。全部按 `tenant_id` 强隔离。落地 `ops_orders` / `ops_logistics_tracks` / `ops_waybills`（迁移 `016_y_order.sql`）。

### 实体
- `ops_orders`（订单：source(management/platform)/platform/order_id(幂等去重)/product_id(→R)/quantity/amount(DECIMAL 12,2)/commission/status(pending_payment/paid/shipped/completed/refunded)/logistics_status(pending/in_transit/delivered)/attribution_id/buyer_info(加密)）
- `ops_logistics_tracks`（物流轨迹：order_id/carrier/tracking_no/status/node/ts）
- `ops_waybills`（电子面单：order_id/carrier/tracking_no/print_status(pending/printed)/printed_at）

### 与 R/S/W 联动
- ← K 直播成交 / R 商品成交 / S 投流 / U 复购分销；库存扣减回写 R `products.stock`（单一真源，防超卖应用层顺序写兜底）；→ W 对账（订单→佣金结算）。

### 1. 同步订单（双源 + 幂等）
`POST /api/ops/orders/sync` `{"source":"platform","orders":[{"orderId":"P-1","platform":"douyin","amount":100,"productId":1,"quantity":2,"status":"paid","attributionId":"attr_x","buyer":{"name":"张三","phone":"13800001111","address":"...","buyerRef":"u-99"}}]}` → `200 { code:"0", data: { total, created, updated } }`（重复同步同 orderId 不再创建；已支付/发货/完成订单联动扣减 R 库存；落审计 action=sync_orders）；orders 为空：`400 { code:"ORDER_SYNC_EMPTY" }`

### 2. 订单列表（按 status/platform 过滤）
`GET /api/ops/orders` → `200 { code:"0", data: OrderView[] }`（按 createdAt 倒序）；`GET /api/ops/orders?status=paid&platform=douyin` 过滤。

### 3. 订单详情（收货信息脱敏）
`GET /api/ops/orders/:id` → `200 { code:"0", data: OrderView }`（buyer.phone 脱敏 `138****1111`、name `张*`、address 截断+`***`）；不存在：`404 { code:"ORDER_NOT_FOUND" }`

### 4. 退款（回写库存）
`POST /api/ops/orders/:id/refund` → `200 { code:"0", data: OrderView(status:"refunded") }`（若有 productId 回写 R 库存 +quantity）；不存在：`404 { code:"ORDER_NOT_FOUND" }`

### 5. 物流轨迹
`GET /api/ops/logistics/:orderId/track` → `200 { code:"0", data: LogisticsTrackView[] }`（按 ts 正序；空返回 `[]`）

### 6. 生成电子面单
`POST /api/ops/orders/:id/waybill` `{"carrier":"sf"}` → `200 { code:"0", data: WaybillView(printStatus:"pending", trackingNo:"WB-<id>-<ts>") }`；订单不存在：`404 { code:"ORDER_NOT_FOUND" }`

### 7. 批量生成面单
`POST /api/ops/orders/batch-waybill` `{"orderIds":[1,2,3],"carrier":"yt"}` → `200 { code:"0", data: { count } }`（跳过不存在订单）

### 8. 仓储库存回传
`POST /api/ops/inventory/sync` `{"productId":1,"delta":-5,"reason":"出库"}` → `200 { code:"0", data: { productId, stock } }`（经 R 库存单一真源回写；delta 为负即扣减）

### 9. 库存预警
`GET /api/ops/inventory/warn?threshold=10` → `200 { code:"0", data: [{ id, title, stock }] }`（列出 stock≤threshold 的商品）

### 视图对象
- `OrderView`：`{ id, source, platform, orderId, productId, quantity, amount, commission, status, logisticsStatus, attributionId, buyer:{name,phone,address,buyerRef}, createdAt, updatedAt }`
- `LogisticsTrackView`：`{ id, orderId, carrier, trackingNo, status, node, ts }`
- `WaybillView`：`{ id, orderId, carrier, trackingNo, printStatus, printedAt, createdAt, updatedAt }`

### 合规与安全（§11②）
- 收货信息（name/phone/address）授权交易数据最小化存储，AES-256-CBC 加密落库（`buyer_info` 不可读明文）；展示层强制脱敏。
- 所有订单/物流/面单查询 where 携带 `tenant_id`；落库 tenantId 取自 `TenantContext.requireTenantId()`。

### 跨租户隔离
- 所有订单/轨迹/面单查询 where 均携带 `tenant_id`；落库 tenantId 取自 `TenantContext.requireTenantId()`。

## AA 智能客服中心（AA-core）`/api/ops/cs`
阶段2 商业化收口（规划 §4-AA）。多渠道接入的 AI 智能客服：直播评论 / 私域 DM / 短视频评论 / 订单留言（经 I/K/U 事件驱动创建会话）；AI 自动回复（意图识别 + 知识库命中 + 订单/物流/商品结构化查询兜底 + 能力网关 text-generate 生成，源透明）；低置信度/高风险/显式请求转人工工单；知识库管理；客服设置。全部按 `tenant_id` 强隔离。落地 `ops_customer_sessions` / `ops_customer_messages` / `ops_support_tickets` / `ops_knowledge_base` / `ops_cs_settings`（迁移 `017_aa_customer_service.sql`）。

### 实体
- `ops_customer_sessions`（会话：channel(live_comment/private_dm/short_video_comment/order_message)/buyer_ref(匿名引用,非 PII,明文)/related_order_id/related_product_id/status(open/transferred/closed)/last_message/message_count）
- `ops_customer_messages`（消息：session_id/role(user/ai/agent)/content/intent/confidence）
- `ops_support_tickets`（工单：session_id/buyer_ref/issue/status(open/pending/resolved/closed)/priority(low/medium/high/urgent)/assigned_to）
- `ops_knowledge_base`（知识库：category(product/order/logistics/faq)/question/answer/source(manual/sync_r/sync_y)）
- `ops_cs_settings`（客服设置：enabled_channels(JSON 数组)/transfer_threshold(默认 0.5)/auto_reply_enabled(默认 true)/greeting/working_hours，每租户单条）

### 与 I/K/U/R/Y 联动
- ← I 情报 / K 直播评论 / U 私域 DM / 短视频评论 / Y 订单留言（多渠道事件驱动创建会话）；AI 回复读 Y 订单/物流（`OrderService.getOrder`/`getLogisticsTrack`）+ R 商品（`ProductService.list`）；AI 生成经能力网关 `SkillGateway.generateText`（源透明）。

### 1. 创建/复用客服会话（多渠道接入）
`POST /api/ops/cs/sessions` `{"channel":"private_dm","buyerRef":"u-99","relatedOrderId":42}` → `200 { code:"0", data: CustomerSessionView }`（同租户同渠道同 buyerRef 复用 open 会话，不重复创建）

### 2. 会话列表（按 channel/status 过滤）
`GET /api/ops/cs/sessions` → `200 { code:"0", data: CustomerSessionView[] }`（按 createdAt 倒序）；`GET /api/ops/cs/sessions?channel=live_comment` 过滤。

### 3. 会话详情（含消息）
`GET /api/ops/cs/sessions/:id` → `200 { code:"0", data: { session, messages: CustomerMessageView[] } }`（消息按 createdAt 升序）；不存在：`404 { code:"CS_SESSION_NOT_FOUND" }`

### 4. 用户消息 + AI 自动回复
`POST /api/ops/cs/sessions/:id/messages` `{"content":"你们家发货快吗"}` → `200 { code:"0", data: { session, userMessage, aiReply: AiReplyView|null } }`。AI 回复优先级：知识库命中（confidence 0.95）→ 订单/物流/商品结构化查询（0.9）→ 能力网关生成（0.6）；命中人工意图或 confidence<transferThreshold 自动转人工（创建工单，session.status=transferred）。

### 5. 显式转人工
`POST /api/ops/cs/sessions/:id/transfer` `{"issue":"投诉","priority":"high"}` → `200 { code:"0", data: SupportTicketView }`（创建工单 + 会话标记 transferred）

### 6. 工单列表（按 status/priority 过滤）
`GET /api/ops/cs/tickets` → `200 { code:"0", data: SupportTicketView[] }`；`GET /api/ops/cs/tickets?status=open`

### 7. 工单详情
`GET /api/ops/cs/tickets/:id` → `200 { code:"0", data: SupportTicketView }`；不存在：`404 { code:"CS_TICKET_NOT_FOUND" }`

### 8. 解决工单
`POST /api/ops/cs/tickets/:id/resolve` → `200 { code:"0", data: SupportTicketView(status:"resolved") }`

### 9. 新增知识
`POST /api/ops/cs/knowledge` `{"category":"faq","question":"退款政策","answer":"7天无理由"}` → `200 { code:"0", data: KnowledgeView(source:"manual") }`

### 10. 知识列表（可选 category 过滤）
`GET /api/ops/cs/knowledge` → `200 { code:"0", data: KnowledgeView[] }`；`GET /api/ops/cs/knowledge?category=product`

### 11. 更新/删除知识
`PUT /api/ops/cs/knowledge/:id` `{"answer":"..."}` → `200 { code:"0", data: KnowledgeView }`；`DELETE /api/ops/cs/knowledge/:id` → `200 { code:"0", data: { id } }`（软删）；不存在：`404 { code:"CS_KNOWLEDGE_NOT_FOUND" }`

### 12. 客服设置（每租户单条 upsert）
`GET /api/ops/cs/settings` → `200 { code:"0", data: CsSettingsView }`（无配置返回默认值）；`PUT /api/ops/cs/settings` `{"transferThreshold":0.9,"enabledChannels":["live_comment","private_dm"]}` → `200 { code:"0", data: CsSettingsView }`

### 13. 同步 R 商品 / Y 订单 知识
`POST /api/ops/cs/knowledge/sync` → `200 { code:"0", data: { added } }`（从 R 商品 + Y 订单生成 FAQ，按 question 去重，source=sync_r/sync_y）

### 视图对象
- `CustomerSessionView`：`{ id, channel, buyerRef, relatedOrderId, relatedProductId, status, lastMessage, messageCount, createdAt, updatedAt }`
- `CustomerMessageView`：`{ id, sessionId, role, content, intent, confidence, createdAt }`
- `SupportTicketView`：`{ id, sessionId, buyerRef, issue, status, priority, assignedTo, createdAt, updatedAt }`
- `KnowledgeView`：`{ id, category, question, answer, source, createdAt, updatedAt }`
- `CsSettingsView`：`{ id, enabledChannels[], transferThreshold, autoReplyEnabled, greeting, workingHours, createdAt, updatedAt }`
- `AiReplyView`：`{ reply, intent, confidence, transferred, ticketId }`

### 合规与安全（§11②）
- **仅采集匿名 buyer_ref 关联会话**（明文存储，非 PII），不采集姓名/电话/地址等个体隐私；真实 PII 加密在 Y 的 `buyer_info`（AES-256-CBC）。
- AI 回复经能力网关 `SkillGateway.generateText` 生成（源透明，标注为 AI 生成）；高风险/投诉意图自动转人工。
- 所有会话/消息/工单/知识/设置查询 where 携带 `tenant_id`；落库 tenantId 取自 `TenantContext.requireTenantId()`。

### 跨租户隔离
- 所有客服查询 where 均携带 `tenant_id`；落库 tenantId 取自 `TenantContext.requireTenantId()`。

## M 决策仪表盘与 BI（M-core）`/api/ops/dashboard` + `/api/ops/dashboards`
阶段2 商业化收口（规划 §4-M / Should 级 BI 聚合层）。作为统一 BI 聚合层：复用 J(RecycleService) 的五维四率核心指标卡与 7×6 人性效能，并跨域轻量聚合（内容生产率→分发覆盖→触达→互动→转化→收益 全链路漏斗、账号对比、选题效能榜、人性钩子分析）。所有查询 where 携带 `tenant_id` 强隔离。落地 `ops_dashboards`（迁移 `018_dashboard.sql`）；其余看板为跨域聚合查询，不新增业务表。

### 与 J 联动（路由迁移）
- 原 J(recycle) 控制器的 `/dashboard/overview`、`/dashboard/driver-efficiency` 已迁至本模块（统一 BI 聚合层，避免路由冲突）；J 保留 `/recycle`、`/recycle/:id`、`/feedback/:video_id`、`/analysis/rerun`。

### 1. 核心指标卡 + 趋势
`GET /api/ops/dashboard/overview` → `200 { code:"0", data: OverviewView }`。`cards` 复用 J 五维四率（totalPlay/avgCompleteRate/totalInteract/totalFanInc/totalCommission/completeRate/interactRate/fanRate/conversionRate/videoCount）；`trend` 为近 7 日 `{date,play,interact}`（BI 层优雅降级：J 无数据时 cards 全 0、trend 空桶）。

### 2. 全链路漏斗
`GET /api/ops/dashboard/funnel` → `200 { code:"0", data: FunnelView }`。`stages`：内容生产率(topic+script 数) → 分发覆盖(publish 数) → 触达播放(feedback 聚合 play) → 互动(feedback 聚合 interact) → 转化(publish 聚合 orderConv) → 收益(feedback commission + W 收益 amount)；`spend`=S 投流(campaign.spend + metric.cost)；`roi`=收益/spend。

### 3. 账号对比
`GET /api/ops/dashboard/account-compare` → `200 { code:"0", data: AccountCompareView }`（`accounts`：每账号 fansCount/publishCount/playShare；`totals`：fansCount/publishCount/play）。

### 4. 选题效能榜
`GET /api/ops/dashboard/topic-efficiency` → `200 { code:"0", data: TopicEfficiencyView }`（按 (driver,emotion) 聚合 topic 数/avgScore，并 join J 人性效能 avgPlay/avgConversion，按 avgScore 降序）。

### 5. 人性钩子分析（7×6）
`GET /api/ops/dashboard/human-hook` → `200 { code:"0", data: HumanHookView }`（复用 J 人性效能：driver/emotion/sampleCount/avgPlay/avgInteractRate/avgConversion）。

### 6. 仪表盘配置 CRUD（ops_dashboards）
`GET /api/ops/dashboards` → 列表；`POST /api/ops/dashboards` `{"name":"经营看板","widgets":[{"type":"line"}]}` → 创建；`GET /api/ops/dashboards/:id` → 详情（不存在：`404 { code:"DASHBOARD_NOT_FOUND" }`）；`PUT /api/ops/dashboards/:id` `{"name?":...,"widgets?":...}` → 更新；`DELETE /api/ops/dashboards/:id` → 软删 `{ id }`。

### 视图对象
- `OverviewView`：`{ cards: OverviewCards, trend: { date, play, interact }[] }`
- `FunnelView`：`{ stages: { name, value }[], spend, roi }`
- `AccountCompareView`：`{ accounts: { accountId, nickname?, platform?, fansCount, publishCount, playShare }[], totals: { fansCount, publishCount, play } }`
- `TopicEfficiencyView`：`{ items: { driver, emotion, topicCount, avgScore, avgPlay, avgConversion }[] }`
- `HumanHookView`：`{ items: { driver, emotion, sampleCount, avgPlay, avgInteractRate, avgConversion }[] }`
- `DashboardView`：`{ id, name, widgets, createdAt, updatedAt }`

### 合规与安全（§11②）
- M 仅聚合业务指标，不采集/留存任何单条个人信息；跨域查询 where 携带 `tenant_id` 强隔离。

### 跨租户隔离
- 所有看板查询 where 均携带 `tenant_id`；落库 tenantId 取自 `TenantContext.requireTenantId()`。

## G 素材中心（G-core）`/api/ops/materials`
阶段3 增强（规划 §4-G）。统一素材资产：AI 画面/视频生成（经 Skill Gateway，源透明）、实拍上传、数字人、音乐音效、字幕贴纸，标签检索，与 F 脚本(related_script_id)、H 成片联动。所有查询 where 携带 `tenant_id` 强隔离。落地 `ops_materials`（迁移 `019_materials.sql`）。

### 实体
- `ops_materials`（素材：type(image/video/music/subtitle/sticker/avatar)/source(jimeng/keling/local/upload)/url(MinIO 地址)/ratio(比例)/tags(JSON 标签数组)/related_script_id(→F scripts)/status(pending/generated/uploaded/failed)/meta(JSON AI 生成详情: prompt/生成文本/provider 源透明)）

### 与 F/H 联动
- ← F 脚本（related_script_id 关联）；→ H 成片（素材输入）；→ K 直播 / → S 投流（素材关联）

### 1. AI 画面/视频生成（经 Skill Gateway，源透明）
`POST /api/ops/materials/generate` `{"type":"image","prompt":"一只猫","provider":"jimeng","ratio":"9:16","relatedScriptId":7}` → `200 { code:"0", data: MaterialView }`（source=provider，status=generated，meta 含 prompt/生成文本/provider；当前 Provider 仅支持 text-generate，生成「画面分镜/提示词描述」占位，真实 Media Provider 即梦/可灵集成留阶段3 增强，url 由 Provider 回写）

### 2. 实拍上传
`POST /api/ops/materials/upload` `{"type":"video","url":"minio://x.mp4","ratio":"9:16","tags":["live"],"relatedScriptId":7}` → `200 { code:"0", data: MaterialView }`（source=upload，status=uploaded）

### 3. 素材库（标签/类型检索）
`GET /api/ops/materials` → `200 { code:"0", data: MaterialView[] }`（按 createdAt 倒序）；`GET /api/ops/materials?type=image` 类型过滤；`GET /api/ops/materials?tag=hot` 标签过滤（tags 包含）

### 4. 追加标签
`POST /api/ops/materials/:id/tag` `{"tags":["a","b"]}` → `200 { code:"0", data: MaterialView }`（标签去重追加）

### 视图对象
- `MaterialView`：`{ id, type, source, url, ratio, tags[], relatedScriptId, status, meta, createdAt, updatedAt }`

### 合规与安全（§11②）
- 不采集隐私；AI 生成经 Skill Gateway，来源对 UX 透明（provider 记录于 meta，不向 UX 暴露本地/外部差异）；url 存 MinIO（§16）

### 跨租户隔离
- 所有素材查询 where 均携带 `tenant_id`；落库 tenantId 取自 `TenantContext.requireTenantId()`。

## H 智能成片（H-core）`/api/ops/videos`
阶段3 增强（规划 §4-H）。本地 FFmpeg 自研剪辑（不依赖第三方）：脚本转分镜+成片、AI 自动剪辑/模板化、多比例适配、预览送审、合规预检。与 F 脚本(script_id)、G 素材(material_ids)、K 拆条(直播回放)联动。所有查询 where 携带 `tenant_id` 强隔离。落地 `ops_videos`（迁移 `020_videos.sql`）。

### 实体
- `ops_videos`（成片：script_id(→F)/material_ids(JSON→G)/ratio/duration/url(MinIO)/review_status(pending/reviewing/passed/rejected)/status(draft/editing/done)/title/meta(JSON 分镜/剪辑命令/合规命中)）

### 与 F/G/K 联动
- ← F 脚本（from-script 读脚本分镜）；← G 素材（material_ids）；← K 拆条（直播回放 → 批量短视频，留增强）；→ I 发布（成片消费）

### 1. 脚本转分镜+成片
`POST /api/ops/videos/from-script` `{"scriptId":1,"materialIds":[10,20],"ratio":"9:16","title":"..."}` → `200 { code:"0", data: VideoView }`（读 F 脚本；FFmpeg best-effort 合成，成功 status=done 并回写 url=minio://videos/:id.mp4，失败 status 仍 draft，meta.composed=false；当前占位命令，真实分镜/转场/字幕/配音/多比例留阶段3 增强细化）；脚本不存在：`404 { code:"VIDEO_SCRIPT_NOT_FOUND" }`

### 2. 成片编辑（AI 自动剪辑/模板化）
`POST /api/ops/videos/:id/edit` `{"materialIds":[10],"ratio":"1:1"}` → `200 { code:"0", data: VideoView }`（更新素材/比例；未 done 标记 editing）

### 3. 送审 + 合规预检
`POST /api/ops/videos/:id/review` → `200 { code:"0", data: VideoView }`（内嵌基础违禁/极限词预检；命中 review_status=rejected，否则 passed；meta.compliance={hit,words}）

### 4. 视频库
`GET /api/ops/videos` → `200 { code:"0", data: VideoView[] }`（按 createdAt 倒序）

### 视图对象
- `VideoView`：`{ id, scriptId, materialIds[], ratio, duration, url, reviewStatus, status, title, meta, createdAt, updatedAt }`

### 合规与安全（§11②）
- 不采集隐私；成片内容源自自有脚本/素材；本地 FFmpeg 自研剪辑，不依赖第三方；合规预检内嵌基础词表（P 违禁词库阶段补完）

### 跨租户隔离
- 所有成片查询 where 均携带 `tenant_id`；落库 tenantId 取自 `TenantContext.requireTenantId()`。
