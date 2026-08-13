import "dotenv/config";

declare const process: any;

/** 应用环境变量配置（统一入口，所有环境变量在此集中管理） */
export const env = {
  /** 服务端口号，默认 8080 */
  PORT: Number(process.env.PORT || 8080),

  /** 运行环境：development / production，默认 production */
  NODE_ENV: process.env.NODE_ENV || "production",

  /** JWT 签名密钥（必须设置，无默认值，缺失时启动失败） */
  JWT_SECRET: process.env.JWT_SECRET || (() => { throw new Error("环境变量 JWT_SECRET 必须设置，不能为空"); })(),

  /**
   * CSRF 令牌 HMAC 签名密钥（独立于 JWT_SECRET）
   * 未设置时自动回退到 JWT_SECRET，确保向后兼容。
   * 建议生产环境独立配置，避免 JWT 密钥轮换导致所有 CSRF token 立即失效。
   */
  CSRF_SECRET: process.env.CSRF_SECRET || (process.env.JWT_SECRET as string) || (() => { throw new Error("环境变量 CSRF_SECRET 或 JWT_SECRET 必须设置"); })(),

  /** MySQL 数据库主机地址，默认 127.0.0.1 */
  DB_HOST: process.env.DB_HOST || "127.0.0.1",

  /** MySQL 数据库端口，默认 3306 */
  DB_PORT: Number(process.env.DB_PORT || 3306),

  /** MySQL 数据库用户名，默认 zhixiang_app */
  DB_USER: process.env.DB_USER || "zhixiang_app",

  /** MySQL 数据库密码，默认空字符串 */
  DB_PASSWORD: process.env.DB_PASSWORD || "",

  /** MySQL 数据库名称，默认 liquor_inventory */
  DB_NAME: process.env.DB_NAME || "liquor_inventory",

  /** 是否使用 Mock 数据库（测试/开发环境），默认 false */
  USE_MOCK_DB: process.env.USE_MOCK_DB === "true",

  /** 数据库连接池最大连接数，默认 20 */
  DB_CONNECTION_LIMIT: process.env.DB_CONNECTION_LIMIT || "20",

  /** 数据库连接池最大空闲连接数，默认 10 */
  DB_MAX_IDLE: process.env.DB_MAX_IDLE || "10",

  /** 数据库连接空闲超时时间（毫秒），默认 60000 */
  DB_IDLE_TIMEOUT: process.env.DB_IDLE_TIMEOUT || "60000",

  /** 数据库连接池队列限制，默认 0（无限制） */
  DB_QUEUE_LIMIT: process.env.DB_QUEUE_LIMIT || "0",

  /** 数据库连接获取超时时间（毫秒），默认 10000 */
  DB_ACQUIRE_TIMEOUT: process.env.DB_ACQUIRE_TIMEOUT || "10000",

  /** Redis 主机地址，默认 127.0.0.1 */
  REDIS_HOST: process.env.REDIS_HOST || "127.0.0.1",

  /** Redis 端口，默认 6379 */
  REDIS_PORT: Number(process.env.REDIS_PORT || 6379),

  /**
   * Redis 连接 URL（可选，多进程限流共享存储用）
   * 配置后限流器（express-rate-limit）将使用 RedisStore，替代默认 MemoryStore，
   * 避免多进程部署或重启后计数清零导致防暴力破解能力降级。
   * 格式：redis://[:password@]host:port[/db]
   * 未配置时限流器回退到 MemoryStore（单进程内存）。
   * 关联任务：R55-03 rate-limit 使用 MemoryStore
   */
  REDIS_URL: process.env.REDIS_URL || "",

  /** 主域名，默认 onepan.cn */
  DOMAIN: process.env.DOMAIN || "onepan.cn",

  /** API 服务子域名，默认 api.onepan.cn */
  API_DOMAIN: process.env.API_DOMAIN || "api.onepan.cn",

  /** 管理后台子域名，默认 admin.onepan.cn */
  ADMIN_DOMAIN: process.env.ADMIN_DOMAIN || "admin.onepan.cn",

  /** 商户端子域名，默认 m.onepan.cn */
  MERCHANT_DOMAIN: process.env.MERCHANT_DOMAIN || "m.onepan.cn",

  /** 微信 AppID（小程序），默认空字符串 */
  WECHAT_APP_ID: process.env.WECHAT_APP_ID || "",

  /** 腾讯云 AppID（用于短信/云服务），默认空字符串 */
  TENCENT_CLOUD_APPID: process.env.TENCENT_CLOUD_APPID || "",

  /** 微信 AppSecret（小程序密钥），默认空字符串 */
  WECHAT_APP_SECRET: process.env.WECHAT_APP_SECRET || "",

  /** 微信支付商户号，默认空字符串 */
  WECHAT_MCH_ID: process.env.WECHAT_MCH_ID || "",

  /** 微信支付证书序列号，默认空字符串 */
  WECHAT_PAY_SERIAL_NO: process.env.WECHAT_PAY_SERIAL_NO || "",

  /** 微信支付商户私钥文件路径（.pem），默认空字符串 */
  WECHAT_PAY_PRIVATE_KEY_PATH: process.env.WECHAT_PAY_PRIVATE_KEY_PATH || "",

  /** 微信支付平台证书文件路径（.pem），默认空字符串 */
  WECHAT_PAY_PLATFORM_CERT_PATH: process.env.WECHAT_PAY_PLATFORM_CERT_PATH || "",

  /** 微信支付 API v3 密钥，默认空字符串 */
  WECHAT_PAY_API_V3_KEY: process.env.WECHAT_PAY_API_V3_KEY || "",

  /** 微信支付回调通知 URL，默认空字符串 */
  WECHAT_PAY_NOTIFY_URL: process.env.WECHAT_PAY_NOTIFY_URL || "",

  /** 微信 AppID（兼容别名，优先 WX_APPID 否则回退 WECHAT_APP_ID） */
  WX_APPID: process.env.WX_APPID || process.env.WECHAT_APP_ID || "",

  /** 微信 AppSecret（兼容别名，优先 WX_APP_SECRET 否则回退 WECHAT_APP_SECRET） */
  WX_APP_SECRET: process.env.WX_APP_SECRET || process.env.WECHAT_APP_SECRET || "",

  /** 微信支付商户号（兼容别名，优先 WX_MCH_ID 否则回退 WECHAT_MCH_ID） */
  WX_MCH_ID: process.env.WX_MCH_ID || process.env.WECHAT_MCH_ID || "",

  /** 微信支付 API 密钥（兼容别名，优先 WX_API_KEY 否则回退 WECHAT_PAY_API_V3_KEY） */
  WX_API_KEY: process.env.WX_API_KEY || process.env.WECHAT_PAY_API_V3_KEY || "",

  /** 即时零售 Mock 开关（开发调试用），默认空字符串表示关闭 */
  INSTANT_RETAIL_MOCK: process.env.INSTANT_RETAIL_MOCK || "",

  // ─── 以下变量原先散落在代码中直接 process.env 读取，R63 统一纳入 env.ts ───

  /** 日志级别（pino），默认 info */
  LOG_LEVEL: process.env.LOG_LEVEL || "info",

  /** CORS 允许的域名列表（逗号分隔），未配置时默认允许所有来源 */
  CORS_ORIGINS: process.env.CORS_ORIGINS || "",

  /** 飞书群机器人 webhook URL（通用通知），默认空 */
  FEISHU_WEBHOOK_URL: process.env.FEISHU_WEBHOOK_URL || "",

  /** 飞书告警 webhook URL（5xx错误告警），未配置时回退到 FEISHU_WEBHOOK_URL */
  FEISHU_ALERT_WEBHOOK_URL: process.env.FEISHU_ALERT_WEBHOOK_URL || process.env.FEISHU_WEBHOOK_URL || "",

  // ─── 推送服务配置（R63 统一纳入，原先仅在 push.service.ts 中直接读取） ───

  /** 极光推送 AppKey */
  JPUSH_APP_KEY: process.env.JPUSH_APP_KEY || "",

  /** 极光推送 MasterSecret */
  JPUSH_MASTER_SECRET: process.env.JPUSH_MASTER_SECRET || "",

  /** Firebase Cloud Messaging 项目 ID */
  FCM_PROJECT_ID: process.env.FCM_PROJECT_ID || "",

  /** Firebase Cloud Messaging 访问令牌 */
  FCM_ACCESS_TOKEN: process.env.FCM_ACCESS_TOKEN || "",

  /** 华为推送 AppID */
  HMS_APP_ID: process.env.HMS_APP_ID || "",

  /** 华为推送 AppSecret */
  HMS_APP_SECRET: process.env.HMS_APP_SECRET || "",
};