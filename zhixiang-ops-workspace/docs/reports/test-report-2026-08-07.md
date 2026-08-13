# 测试报告 · 2026-08-07

> 运营系统后端阶段1 MVP 测试验收（舟行总协调，苏晴执行）。
> 全量 `npx jest --forceExit`：12 套件 / 166 passed / 0 failed（基线 36 → R1 +14 → R2 +18 → R3 +17 → R4 +24 → R5 +25 → R6 +15 → R7 +17）。

## 一、R3 D 人性分析与洞察引擎（core）验收

- 业务实现：阿砚（后端），`src/modules/analyze/**`
- 测试：苏晴（测试），`src/modules/analyze/analyze.service.spec.ts`（17 用例）
- 结果：**17 passed / 17**，覆盖验收点 1–14，无业务 bug

### 覆盖矩阵
| 验收点 | 内容 | 结果 |
|--------|------|------|
| 1 | createAnalysisTask 空输入（无 clean 评论）→ ANALYSIS_EMPTY_INPUT | ✅ |
| 2 | createAnalysisTask 正常 → 落 pending，返回 {taskId, traceId} | ✅ |
| 3 | getAnalysisTask 不存在→ANALYSIS_TASK_NOT_FOUND；存在返回 | ✅ |
| 4 | processPendingAnalysis 成功：skill.invoke 返回 7×6 JSON → 任务 done、driverCounts/emotionScores/topDrivers/topEmotions/insights 回填、modelUsed 记录、seedInsights 沉淀 | ✅ |
| 5 | JSON 容错：返回带 ```json 围栏也能解析成功 | ✅ |
| 6 | 失败路径：skill.invoke 抛错 → 任务 failed + errorMsg | ✅ |
| 7 | 合规边界②：仅聚合统计，无单条评论原文落库 task；insightRepo 仅存结论 | ✅ |
| 8 | 洞察去重：同租户+title+driver 已存在 → usageCount 累加、不新增行 | ✅ |
| 9 | 洞察新建：不存在 → create+save、usageCount=1 | ✅ |
| 10 | 校验：driver 非法→HUMANITY_INVALID；emotion 非法→EMOTION_INVALID | ✅ |
| 11 | listInsights：createQueryBuilder.where 带正确 tenantId，返回分页结构 | ✅ |
| 12 | getReport 无 done 任务 → 返回空结构（无 recentTaskId） | ✅ |
| 13 | getReport 有 done 任务 → 返回聚合（含 recentTaskId） | ✅ |
| 14 | 跨租户隔离（createAnalysisTask/listInsights/getReport 的 where 带正确 tenantId） | ✅ |

## 二、R7 L 工作流编排（core）验收（同日）

- 业务实现：阿砚（后端），`src/modules/workflow/**`
- 测试：苏晴（测试），`src/modules/workflow/workflow.service.spec.ts`（17 用例）
- 结果：**17 passed / 17**，覆盖验收点 1–14 + 跨租户隔离防护，无业务 bug
- 说明：苏晴曾标记 streamRun「管道写法语义错位」为疑似 Bug，舟行研判为**误报**——`switchMapToRun(...)` 返回即 `switchMap(...)` 的 `OperatorFunction`，`pipe(take(30), switchMapToRun(...))` 等价于标准 `pipe(take(30), switchMap(...))`，测试已验证 subscribe 可取 data，无需改动

### 覆盖矩阵
| 验收点 | 内容 | 结果 |
|--------|------|------|
| 1 | createDef 正常：保存 def（nodes/edges/trigger 正确） | ✅ |
| 2 | 节点 id 重复 → WORKFLOW_NODE_DUP（save 未调用） | ✅ |
| 3 | 边引用不存在节点 → WORKFLOW_EDGE_INVALID | ✅ |
| 4 | 存在环 → WORKFLOW_DAG_CYCLE | ✅ |
| 5 | trigger=cron 缺 cronExpr → WORKFLOW_CRON_REQUIRED | ✅ |
| 6 | listDefs：where 带 tenant_id、orderBy created_at DESC、buildPage | ✅ |
| 7 | getDef 不存在→WORKFLOW_NOT_FOUND；存在返回 | ✅ |
| 8 | updateDef 不存在→WORKFLOW_NOT_FOUND；{enabled:false} 生效 | ✅ |
| 9 | run 正常串联 C→D→E→F→I：run=success、progress=100、5 节点 done、topicId/scriptId 透传、publish 收到 accountIds | ✅ |
| 10 | 单节点失败隔离：analyze 报错→run=partial、该节点 failed、其余 done 仍执行 | ✅ |
| 11 | 缺上游产出：script 无 topicId→failed、run=partial | ✅ |
| 12 | run 编排不存在 → WORKFLOW_NOT_FOUND | ✅ |
| 13 | 跨租户隔离（def/run/log 的 where 带正确 tenantId） | ✅ |
| 14 | streamRun 返回 Observable 可取 data（可选） | ✅ |

## 三、R6 I 发布与分发（core）验收（同日）

- 业务实现：阿砚（后端），`src/modules/publish/**`
- 测试：苏晴（测试），`src/modules/publish/publish.service.spec.ts`（15 用例）
- 结果：**15 passed / 15**，覆盖验收点 1–11 + 跨租户隔离防护，无业务 bug

### 覆盖矩阵
| 验收点 | 内容 | 结果 |
|--------|------|------|
| 1 | publish 正常分发（多账号）：每账号一条 published 任务；attributionId 透传 F、extPostId=`pub_<tenant>_<scriptId>_<accountId>`、publishedAt 写入 | ✅ |
| 2 | 脚本不存在 → SCRIPT_NOT_FOUND（account 未查） | ✅ |
| 3 | 未达可发布状态（draft/reviewing）→ SCRIPT_NOT_PUBLISHABLE | ✅ |
| 4 | 高危合规命中（level=high）→ COMPLIANCE_BLOCKED（account/save 未调用） | ✅ |
| 5 | 发布账号不存在 → PUBLISH_ACCOUNT_NOT_FOUND | ✅ |
| 6 | platform 与账号不一致 → PUBLISH_PLATFORM_MISMATCH | ✅ |
| 7 | 幂等：同 tenant+scriptId+accountId 已 published 再发布返回原任务、不新增 | ✅ |
| 8 | batchPublish：多组脚本×账号展开多条任务，taskIds 正确 | ✅ |
| 9 | getPublish 不存在→PUBLISH_NOT_FOUND；存在返回 | ✅ |
| 10 | getFunnel：(0,0)→0；(10,4)→0.4 | ✅ |
| 11 | 跨租户隔离（publish/getPublish/createTask 的 where 带正确 tenantId） | ✅ |
| 附 | 未包裹 TenantContext.run → TENANT_REQUIRED | ✅ |

## 三、R5 F 脚本工坊（core）验收（同日）

- 业务实现：阿砚（后端），`src/modules/script/**`
- 测试：苏晴（测试），`src/modules/script/script.service.spec.ts`（25 用例）
- 结果：**25 passed / 25**，覆盖验收点 1–23 + 跨租户隔离防护，无业务 bug
- 缺陷闭环：苏晴发现 Bug1（`generateScript` 在 `EMOTION_INVALID` 校验后才调 `SkillGateway.invoke`，情绪非法时浪费算力）→ 舟行已将情绪校验前置到 invoke 之前，并补断言验证「invoke 未被调用」

### 覆盖矩阵
| 验收点 | 内容 | 结果 |
|--------|------|------|
| 1 | generateScript 消费 E 选题 → 调 SkillGateway.invoke 生成 content；attributionId/title 继承、hookEmotion=选题 emotion、status=draft、complianceRisk 内嵌预检、modelUsed 取自 SkillResult | ✅ |
| 2 | 选题不存在 → TOPIC_NOT_FOUND（invoke 未调用） | ✅ |
| 3 | 钩子情绪非法（选题 emotion 不在 6 情绪）→ EMOTION_INVALID（invoke 未调用） | ✅ |
| 4 | listScripts：createdAt 降序 + 过滤(topicId/status) + 分页（where 带 tenantId） | ✅ |
| 5 | getScript 不存在→SCRIPT_NOT_FOUND；存在返回 | ✅ |
| 6 | updateScript 状态机合法：draft→reviewing 成功 | ✅ |
| 7 | 状态机非法：draft→draft 原地 → SCRIPT_INVALID_TRANSITION | ✅ |
| 8 | 状态机非法：draft→published 越级 → SCRIPT_INVALID_TRANSITION | ✅ |
| 9 | 未知状态 → SCRIPT_INVALID_TRANSITION | ✅ |
| 10 | hookEmotion 非法 → EMOTION_INVALID（先于状态机校验） | ✅ |
| 11 | 双轨编辑：content/hookEmotion/spokenTrack 更新，hook 重算 | ✅ |
| 12 | 发布门禁：approved→published 且 complianceRisk.level=high → COMPLIANCE_BLOCKED | ✅ |
| 13 | 发布门禁：approved→published 且合规 level=none → 成功 | ✅ |
| 14 | checkCompliance 对当前 content 预检回写（含 high 词命中） | ✅ |
| 15 | checkCompliance 对传入 content 预检回写（medium 词命中） | ✅ |
| 16 | checkCompliance 脚本不存在 → SCRIPT_NOT_FOUND | ✅ |
| 17 | 版本 save：parentVersionId=当前 id、version+1、status=draft、继承字段 | ✅ |
| 18 | 版本 rollback：当前内容被 sourceVersionId 覆盖 | ✅ |
| 19 | rollback 未指定 sourceVersionId → SCRIPT_VERSION_REQUIRED | ✅ |
| 20 | rollback 源版本不存在 → SCRIPT_VERSION_NOT_FOUND | ✅ |
| 21 | 版本脚本不存在 → SCRIPT_NOT_FOUND | ✅ |
| 22 | listTemplates：返回 4 套模板 | ✅ |
| 23 | 跨租户隔离（generate/list/get 的 where 带正确 tenantId） | ✅ |

## 三、R4 E 选题引擎（core）验收（同日）

- 业务实现：阿砚（后端），`src/modules/topic/**`
- 测试：苏晴（测试），`src/modules/topic/topic.service.spec.ts`（24 用例）
- 结果：**24 passed / 24**，覆盖验收点 1–19，无业务 bug

### 覆盖矩阵
| 验收点 | 内容 | 结果 |
|--------|------|------|
| 1 | generateTopics 消费 D 洞察库 → 生成选题，attributionId 合规、status=idea、score=50+usageCount*5 | ✅ |
| 2 | generateTopics 空洞察 → 返回 {topics:[],traceId} 不报错 | ✅ |
| 3 | 去重：同租户+title+driver+emotion 已存在 → 跳过不新增行 | ✅ |
| 4 | 从 analysisId 生成：消费该任务 insights（analysisId 回填） | ✅ |
| 5 | analysisId 不存在 → ANALYSIS_TASK_NOT_FOUND | ✅ |
| 6 | 校验：driver 非法→HUMANITY_INVALID；emotion 非法→EMOTION_INVALID | ✅ |
| 7 | getTopic 不存在→TOPIC_NOT_FOUND；存在返回 | ✅ |
| 8 | updateTopic 状态机合法：idea→todo 成功 | ✅ |
| 9 | 状态机非法：idea→written → INVALID_STATUS_TRANSITION | ✅ |
| 10 | 原地流转：idea→idea → INVALID_STATUS_TRANSITION | ✅ |
| 11 | 校验：humanDriver 非法→HUMANITY_INVALID；emotion 非法→EMOTION_INVALID | ✅ |
| 12 | A/B 变体派生：abVariantOf=基准 id、继承未传字段、status=idea | ✅ |
| 13 | A/B 防环：对变体再建变体 → INVALID_AB_VARIANT_CYCLE | ✅ |
| 14 | A/B 基准不存在 → TOPIC_NOT_FOUND | ✅ |
| 15 | 排期正常：scheduledAt+可选 accountId，账号存在则绑定 | ✅ |
| 16 | 排期账号不存在 → SCHEDULE_ACCOUNT_NOT_FOUND | ✅ |
| 17 | 排期终态（published/dead）不可排期 → INVALID_STATUS_TRANSITION | ✅ |
| 18 | listTopics：分页+过滤(driver/emotion/status)+score 降序 | ✅ |
| 19 | 跨租户隔离（generate/list/get 的 where 带正确 tenantId） | ✅ |

## 三、R2 C 情报采集（core）验收（同日）

- 业务实现：阿砚（后端），`src/modules/intel/**`
- 测试：苏晴（测试），`src/modules/intel/intel.service.spec.ts`（18 用例）
- 结果：**18 passed / 18**，覆盖验收点 1–12，无业务 bug

| 验收点 | 内容 | 结果 |
|--------|------|------|
| 1 | 竞品 create（tenantId/platform/name，monitorEnabled 默认 false） | ✅ |
| 2 | 竞品 findOne 不存在→COMPETITOR_NOT_FOUND；存在返回 | ✅ |
| 3 | 竞品 update / toggleMonitor 翻转 | ✅ |
| 4 | 竞品 remove（softDelete） | ✅ |
| 5 | 跨租户隔离（list/findCleanComments/createCollectTask 的 where 带正确 tenantId） | ✅ |
| 6 | 限频（rateLimiter.allow=false→COLLECT_RATE_LIMITED；true→{taskId,traceId}） | ✅ |
| 7 | 来源级别非法（L3→COLLECT_SOURCE_LEVEL_INVALID） | ✅ |
| 8 | getCollectTask 不存在→COLLECT_TASK_NOT_FOUND；存在返回三字段 | ✅ |
| 9 | 合规清洗：3 条全落库；手机→[已脱敏]+piiRemoved:['phone']+isClean=false；广告→isClean=false；正常→isClean=true；task pending→done、collectedCount=3 | ✅ |
| 10 | 去重（批内相同只落库 1 条） | ✅ |
| 11 | 失败路径（fetchComments 抛错→task failed+errorMsg） | ✅ |
| 12 | mineKeywords 返回 string[]；getHot→hotRepo.save 调用且 find 返回 | ✅ |

## 三、R1 B 账号矩阵（core）验收（同日）
- 测试：`src/modules/account/account.service.spec.ts`（14 用例），覆盖加密存储/重复键/租户隔离/健康巡检等验收点 1–10
- 结果：14 passed，无 bug

## 四、全量回归
- `npx jest --forceExit`：166 passed / 0 failed（无回归）
- 备注：因 `AccountService.reconcileHealth`、`IntelService.processPendingTasks`、`AnalyzeService.processPendingAnalysis` 上的 `@Cron` 装饰器在无 Nest 运行时悬挂定时器句柄，jest 提示 "worker process has failed to exit gracefully"；用 `--forceExit` 正常退出，不影响任何断言结果（属已知良性现象，无需改业务代码）。

## 六、结论
R1、R2、R3、R4、R5、R6、R7 后端均以真实生产代码落地并通过验收，可进入 R8（候选 J 回收，回流 D 再分析闭环）或 A 权限 / 阶段2 商业化。
