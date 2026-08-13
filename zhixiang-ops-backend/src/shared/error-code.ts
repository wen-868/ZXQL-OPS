/**
 * 字符串错误码表（对齐管理系统 backend/src/shared/error-code.ts 风格）。
 * 运营系统新增错误码时，沿用 { message, httpStatus } 结构并在此登记。
 */

export interface ErrorCodeDef {
  message: string;
  httpStatus: number;
}

export const ERROR_CODES: Record<string, ErrorCodeDef> = {
  // 通用
  SUCCESS: { message: '成功', httpStatus: 200 },
  INVALID_PARAM: { message: '参数校验失败', httpStatus: 400 },
  UNAUTHORIZED: { message: '未登录或登录已失效', httpStatus: 401 },
  FORBIDDEN: { message: '无权限访问', httpStatus: 403 },
  NOT_FOUND: { message: '资源不存在', httpStatus: 404 },
  METHOD_NOT_ALLOWED: { message: '请求方法不被允许', httpStatus: 405 },
  CONFLICT: { message: '资源状态冲突，操作无法完成', httpStatus: 409 },
  TOO_MANY_REQUESTS: { message: '请求过于频繁，请稍后再试', httpStatus: 429 },
  INTERNAL_ERROR: { message: '服务器内部错误', httpStatus: 500 },
  SERVICE_UNAVAILABLE: { message: '服务暂不可用，请稍后再试', httpStatus: 503 },
  EXTERNAL_SERVICE_ERROR: { message: '外部服务调用失败', httpStatus: 502 },

  // 认证（独立模式）
  AUTH_USER_NOT_FOUND: { message: '用户名不存在', httpStatus: 401 },
  AUTH_INVALID_PASSWORD: { message: '密码错误', httpStatus: 401 },
  AUTH_USER_EXISTS: { message: '用户名已存在', httpStatus: 409 },
  AUTH_USER_DISABLED: { message: '账号已被禁用', httpStatus: 403 },

  // 认证（管理系统 SSO 对接）
  AUTH_MS_TOKEN_INVALID: { message: '管理系统登录态无效或已过期', httpStatus: 401 },
  AUTH_MS_ROLE_NOT_ALLOWED: { message: '当前账号无运营系统访问权限', httpStatus: 403 },
  SSO_TENANT_NOT_MAPPED: { message: '租户尚未配置映射，请联系管理员', httpStatus: 403 },
  CALLBACK_SIGNATURE_INVALID: { message: 'Webhook 签名校验失败', httpStatus: 401 },
  MS_CLIENT_NOT_CONFIGURED: {
    message: '管理系统服务账号未配置（OPS_MS_CLIENT_ID/SECRET）',
    httpStatus: 503,
  },
  MS_API_ERROR: { message: '管理系统接口调用失败', httpStatus: 502 },

  // 主数据同步开关（P3 客户自决）
  SYNC_REQUIRES_CONNECTED: {
    message: '仅在同时使用管理系统与运营系统（对接模式）时可开启数据同步',
    httpStatus: 400,
  },
  SYNC_REQUIRES_SERVICE_ACCOUNT: {
    message: '服务账号未配置（OPS_MS_CLIENT_ID/SECRET），无法开启同步',
    httpStatus: 400,
  },
  SYNC_REQUIRES_TENANT_BIND: {
    message: '租户尚未配置映射（ops_tenant_bind），无法开启同步',
    httpStatus: 400,
  },

  // 运营系统业务
  TENANT_REQUIRED: { message: '缺少租户标识', httpStatus: 400 },
  TENANT_MISMATCH: { message: '禁止跨租户操作', httpStatus: 403 },
  ATTRIBUTION_INVALID: { message: '归因标识格式非法', httpStatus: 400 },
  HUMANITY_INVALID: { message: '人性标签非法', httpStatus: 400 },
  EMOTION_INVALID: { message: '情绪标签非法', httpStatus: 400 },
  SKILL_UNAVAILABLE: { message: '能力网关暂不可用', httpStatus: 503 },
  CONTENT_NOT_FOUND: { message: '内容不存在', httpStatus: 404 },
  LIVE_NOT_FOUND: { message: '直播不存在', httpStatus: 404 },

  // 账号矩阵（B-core）
  ACCOUNT_NOT_FOUND: { message: '账号不存在', httpStatus: 404 },
  ACCOUNT_DUPLICATE: { message: '同一租户下该平台账号已存在', httpStatus: 409 },
  ACCOUNT_TOKEN_EXPIRED: { message: '账号 Access Token 已过期，请重新授权', httpStatus: 401 },
  ACCOUNT_UNSIGNED: { message: '账号尚未授权（未绑定 Token）', httpStatus: 400 },
  ACCOUNT_GROUP_NOT_FOUND: { message: '账号分组不存在', httpStatus: 404 },
  ACCOUNT_GROUP_DUPLICATE: { message: '同一租户下分组名已存在', httpStatus: 409 },
  ACCOUNT_GROUP_IN_USE: { message: '分组内仍有账号，请先移出账号再删除', httpStatus: 409 },
  OAUTH_PLATFORM_UNSUPPORTED: { message: '该平台暂不支持 OAuth 授权', httpStatus: 400 },
  OAUTH_STATE_INVALID: { message: 'OAuth state 无效或已使用，请重新发起授权', httpStatus: 400 },
  OAUTH_STATE_EXPIRED: { message: 'OAuth state 已过期，请重新发起授权', httpStatus: 400 },

  // 情报采集（C）
  COMPETITOR_NOT_FOUND: { message: '竞品不存在', httpStatus: 404 },
  COLLECT_TASK_NOT_FOUND: { message: '采集任务不存在', httpStatus: 404 },
  COLLECT_RATE_LIMITED: { message: '采集频率超限，请稍后重试', httpStatus: 429 },
  COLLECT_SOURCE_LEVEL_INVALID: { message: '采集来源级别不合法（应为 L1/L2）', httpStatus: 400 },

  // 人性分析与洞察引擎（D）
  ANALYSIS_TASK_NOT_FOUND: { message: '分析任务不存在', httpStatus: 404 },
  ANALYSIS_EMPTY_INPUT: { message: '无可分析评论（请先经 C 采集并清洗）', httpStatus: 400 },

  // 选题引擎（E）
  TOPIC_NOT_FOUND: { message: '选题不存在', httpStatus: 404 },
  INVALID_STATUS_TRANSITION: { message: '选题状态流转非法', httpStatus: 400 },
  INVALID_AB_VARIANT_CYCLE: { message: '不允许对 A/B 变体再创建变体（防环）', httpStatus: 400 },
  SCHEDULE_ACCOUNT_NOT_FOUND: { message: '排期绑定的账号不存在', httpStatus: 404 },

  // 脚本工坊（F）
  SCRIPT_NOT_FOUND: { message: '脚本不存在', httpStatus: 404 },
  SCRIPT_INVALID_TRANSITION: { message: '脚本状态流转非法', httpStatus: 400 },
  COMPLIANCE_BLOCKED: { message: '高危违禁词命中，禁止发布（请先修改脚本）', httpStatus: 400 },
  SCRIPT_VERSION_REQUIRED: { message: '回滚操作必须指定 sourceVersionId', httpStatus: 400 },
  SCRIPT_VERSION_NOT_FOUND: { message: '指定版本不存在（须同选题同租户）', httpStatus: 404 },

  // 发布与分发（I）
  PUBLISH_NOT_FOUND: { message: '发布任务不存在', httpStatus: 404 },
  PUBLISH_ACCOUNT_NOT_FOUND: { message: '发布账号不存在', httpStatus: 404 },
  SCRIPT_NOT_PUBLISHABLE: {
    message: '脚本未达可发布状态（须 approved/published）',
    httpStatus: 400,
  },
  PUBLISH_PLATFORM_MISMATCH: { message: '指定平台与账号平台不一致', httpStatus: 400 },
  PUBLISH_DOUYIN_UNCONFIGURED: {
    message: '抖音开放平台未配置（需 OPS_DOUYIN_APP_ID + OPS_DOUYIN_APP_SECRET）',
    httpStatus: 503,
  },
  PUBLISH_DOUYIN_NO_CREDENTIAL: {
    message: '该抖音账号未绑定 OAuth 凭证（需 token + open_id）',
    httpStatus: 400,
  },
  PUBLISH_DOUYIN_API_ERROR: { message: '抖音 API 返回错误', httpStatus: 502 },

  // 数据监控与回收（J）
  RECYCLE_TASK_NOT_FOUND: { message: '回收任务不存在', httpStatus: 404 },
  FEEDBACK_NOT_FOUND: { message: '回收明细不存在', httpStatus: 404 },
  RECYCLE_NO_DATA: { message: '暂无可回收数据（请先经 I 发布内容）', httpStatus: 400 },
  RECYCLE_TARGET_INVALID: { message: '回收目标引用无效（单视频需指定 video_id）', httpStatus: 400 },

  // 团队与权限（N）
  ROLE_NOT_FOUND: { message: '角色不存在', httpStatus: 404 },
  ROLE_DUPLICATE: { message: '同一租户下角色名已存在', httpStatus: 409 },
  ROLE_SYSTEM_PROTECTED: { message: '系统内置角色不可删除', httpStatus: 403 },
  ROLE_ASSIGN_DUP: { message: '该用户已绑定此角色', httpStatus: 409 },
  ROLE_USER_NOT_FOUND: { message: '用户角色绑定不存在', httpStatus: 404 },

  // 选品中心（T）
  SELECTION_PRODUCT_NOT_FOUND: { message: '选品不存在', httpStatus: 404 },
  SELECTION_LIST_NOT_FOUND: { message: '选品清单不存在', httpStatus: 404 },
  SELECTION_IMPORT_EMPTY: { message: '导入选品需提供 products 或 ids', httpStatus: 400 },
  SELECTION_IMPORT_MODE_UNSUPPORTED: {
    message: '当前为独立模式，无法经平台 API 批量拉取；请直接传入 products 列表',
    httpStatus: 400,
  },
  SELECTION_INVALID_HUMAN_DRIVER: {
    message: '非法人性标签（须为 D 字典 7 人性之一）',
    httpStatus: 400,
  },

  // 商品内容中心（R）
  PRODUCT_NOT_FOUND: { message: '商品不存在', httpStatus: 404 },
  PRODUCT_CONTENT_NOT_FOUND: { message: '商品内容不存在', httpStatus: 404 },
  PRODUCT_SELECTION_REQUIRED: {
    message: 'sourceType=t_selection 时须提供 selectionProductId',
    httpStatus: 400,
  },
  PRODUCT_SELECTION_NOT_FOUND: { message: '关联的 T 选品不存在', httpStatus: 404 },
  PRODUCT_EXTERNAL_ID_REQUIRED: {
    message: 'sourceType=system 时须提供 externalProductId',
    httpStatus: 400,
  },
  PRODUCT_SOURCE_UNSUPPORTED_IN_STANDALONE: {
    message: '当前为独立模式，无法经管理系统适配层拉取商品；请改用 manual/competitor/t_selection',
    httpStatus: 400,
  },
  PRODUCT_TITLE_REQUIRED: { message: 'manual/competitor 来源须提供 title', httpStatus: 400 },
  PRODUCT_INVALID_HUMAN_DRIVER: {
    message: '非法人性标签（须为 D 字典 7 人性之一）',
    httpStatus: 400,
  },
  PRODUCT_STOCK_INSUFFICIENT: { message: '库存不足，扣减后为负', httpStatus: 400 },

  // 直播中心（K）
  LIVE_ROOM_NOT_FOUND: { message: '直播间不存在', httpStatus: 404 },
  LIVE_ACCOUNT_NOT_FOUND: { message: '关联的 B 账号不存在', httpStatus: 404 },
  LIVE_PRODUCT_NOT_FOUND: { message: '挂载的 R 商品不存在或不属于本租户', httpStatus: 404 },
  LIVE_ROOM_NOT_CREATED: { message: '直播间非 created 状态，无法开播', httpStatus: 400 },
  LIVE_ROOM_NOT_LIVE: { message: '直播间非 live 状态，无法结束', httpStatus: 400 },
  LIVE_RTMP_URL_REQUIRED: { message: '推流须提供 rtmpUrl', httpStatus: 400 },

  // 投流管理（S）
  AD_ACCOUNT_NOT_FOUND: { message: '投放账户不存在', httpStatus: 404 },
  AD_CAMPAIGN_NOT_FOUND: { message: '投放计划不存在', httpStatus: 404 },

  // 粉丝与私域运营（U）
  FANS_PROFILE_NOT_FOUND: { message: '粉丝画像不存在', httpStatus: 404 },
  PRIVATE_GROUP_NOT_FOUND: { message: '私域群不存在', httpStatus: 404 },

  // 收益与对账（W）
  REVENUE_NOT_FOUND: { message: '收益记录不存在', httpStatus: 404 },
  RECONCILIATION_NOT_FOUND: { message: '对账记录不存在', httpStatus: 404 },
  SETTLEMENT_NOT_FOUND: { message: '分账记录不存在', httpStatus: 404 },
  SETTLEMENT_PARTIES_MISMATCH: { message: '分账各方金额合计与总额不一致', httpStatus: 400 },

  // 订单与物流（Y）
  ORDER_NOT_FOUND: { message: '订单不存在', httpStatus: 404 },
  ORDER_SYNC_EMPTY: { message: '订单同步需提供 orders 列表', httpStatus: 400 },

  // 智能客服（AA）
  CS_SESSION_NOT_FOUND: { message: '客服会话不存在', httpStatus: 404 },
  CS_TICKET_NOT_FOUND: { message: '工单不存在', httpStatus: 404 },
  CS_KNOWLEDGE_NOT_FOUND: { message: '知识条目不存在', httpStatus: 404 },

  // 决策仪表盘（M）
  DASHBOARD_NOT_FOUND: { message: '仪表盘不存在', httpStatus: 404 },

  // 素材中心（G）
  MATERIAL_NOT_FOUND: { message: '素材不存在', httpStatus: 404 },

  // 智能成片（H）
  VIDEO_NOT_FOUND: { message: '成片不存在', httpStatus: 404 },
  VIDEO_SCRIPT_NOT_FOUND: { message: '关联脚本不存在', httpStatus: 404 },

  // 达人/商单管理（V）
  TALENT_NOT_FOUND: { message: '达人不存在', httpStatus: 404 },
  BRAND_ORDER_NOT_FOUND: { message: '商单不存在', httpStatus: 404 },
  BRAND_ORDER_ALREADY_SETTLED: { message: '商单已分账，禁止重复操作或删除', httpStatus: 409 },

  // 内容出海（X）
  OVERSEAS_PLATFORM_NOT_FOUND: { message: '出海平台不存在', httpStatus: 404 },
  OVERSEAS_VIDEO_NOT_FOUND: { message: '出海视频不存在', httpStatus: 404 },

  // 合规预检（P）
  COMPLIANCE_WORD_EXISTS: { message: '该违禁词已存在', httpStatus: 409 },
  COMPLIANCE_WORD_NOT_FOUND: { message: '违禁词不存在', httpStatus: 404 },

  // 技能中心（Z）
  SKILL_NOT_FOUND: { message: '技能不存在', httpStatus: 404 },
  SKILL_NOT_AVAILABLE: { message: '该技能系统未上架，不可启用', httpStatus: 400 },
  SKILL_NOT_INSTALLED: { message: '请先启用该技能再绑定 Provider', httpStatus: 400 },
  SKILL_NOT_ENABLED: { message: '该租户未启用此技能', httpStatus: 403 },
  PROVIDER_NOT_FOUND: { message: 'Provider 不存在或不可绑定', httpStatus: 404 },
  PROVIDER_BOUND: { message: '该 Provider 正被技能绑定，请先解绑再删除', httpStatus: 409 },

  // 工作流编排（L）
  WORKFLOW_NOT_FOUND: { message: '编排不存在', httpStatus: 404 },
  WORKFLOW_NODE_DUP: { message: '编排节点 id 重复', httpStatus: 400 },
  WORKFLOW_EDGE_INVALID: { message: '编排边引用了不存在的节点', httpStatus: 400 },
  WORKFLOW_DAG_CYCLE: { message: '编排存在环（DAG 校验失败）', httpStatus: 400 },
  WORKFLOW_CRON_REQUIRED: { message: 'trigger=cron 必须提供 cronExpr', httpStatus: 400 },
  WORKFLOW_MISSING_INPUT: { message: '节点缺少上游产出（如 script 缺 topicId）', httpStatus: 400 },
  WORKFLOW_NODE_UNKNOWN: { message: '未知节点类型', httpStatus: 400 },

  // 基础设施（启动期）
  DB_UNAVAILABLE: { message: '数据库不可用', httpStatus: 503 },
  SKILL_UNSUPPORTED: { message: '技能暂不可用', httpStatus: 501 },
  NOT_IMPLEMENTED: { message: '该功能尚未接入（独立模式）', httpStatus: 501 },

  // 大模型配置（LLM）
  LLM_PROVIDER_NOT_FOUND: { message: '大模型提供方不存在', httpStatus: 404 },
  LLM_PROVIDER_NAME_DUP: { message: '同一租户下该提供方名称已存在', httpStatus: 409 },
  LLM_PROVIDER_TEST_FAILED: { message: '大模型连接测试失败', httpStatus: 502 },

  // 演示模式
  DEMO_MODE_DISABLED: { message: '演示模式未开启，不支持演示登录', httpStatus: 403 },
};

export type ErrorCode = keyof typeof ERROR_CODES;
