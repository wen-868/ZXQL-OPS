import 'dotenv/config';

/**
 * 集中配置入口（对齐管理系统 backend/src/config/env.ts）。
 * 变量名与管理系统保持一致；运营系统专属变量加 OPS_ 前缀。
 * 缺失关键变量时启动失败（与管理系统一致）。
 */

function required(name: string): string {
  const v = process.env[name];
  if (v === undefined || v === '') {
    throw new Error(`[env] 缺少必填环境变量: ${name}`);
  }
  return v;
}

/** 密钥强度校验：拒绝占位符与弱密钥（防止默认/已知密钥被用于伪造 token） */
function secret(name: string): string {
  const v = required(name);
  const placeholderPattern = /请替换|replace|changeme|your-?secret|example/i;
  if (placeholderPattern.test(v)) {
    throw new Error(
      `[env] ${name} 仍为占位符，请配置强随机密钥（如 openssl rand -base64 48）后重启`,
    );
  }
  if (v.length < 32) {
    throw new Error(`[env] ${name} 强度不足：长度须 ≥ 32 字符，请配置强随机密钥后重启`);
  }
  return v;
}

function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

function int(name: string, fallback: number): number {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : parseInt(v, 10);
}

export const env = {
  PORT: int('PORT', 3100),
  NODE_ENV: optional('NODE_ENV', 'development'),

  // 鉴权（必填；强度校验：拒绝占位符/弱密钥）
  JWT_SECRET: secret('JWT_SECRET'),
  CSRF_SECRET: optional('CSRF_SECRET') || required('JWT_SECRET'),

  // 数据库
  DB_HOST: optional('DB_HOST', '127.0.0.1'),
  DB_PORT: int('DB_PORT', 3306),
  DB_USER: optional('DB_USER', 'root'),
  DB_PASSWORD: optional('DB_PASSWORD', ''),
  DB_NAME: optional('DB_NAME', 'zhixiang_ops'),
  DB_CONNECTION_LIMIT: int('DB_CONNECTION_LIMIT', 10),
  DB_MAX_IDLE: int('DB_MAX_IDLE', 10),
  DB_IDLE_TIMEOUT: int('DB_IDLE_TIMEOUT', 30000),
  DB_QUEUE_LIMIT: int('DB_QUEUE_LIMIT', 0),
  DB_ACQUIRE_TIMEOUT: int('DB_ACQUIRE_TIMEOUT', 60000),
  // 启动期握手超时（毫秒）：控制「初次建连」最长等待，缺库时据此快速失败（非 60s 静默挂起）
  DB_CONNECT_TIMEOUT: int('DB_CONNECT_TIMEOUT', 5000),
  // 启动期连接重试与退避（TypeORM retryAttempts / retryDelay）
  DB_RETRY_ATTEMPTS: int('DB_RETRY_ATTEMPTS', 5),
  DB_RETRY_DELAY: int('DB_RETRY_DELAY', 2000),
  // 内嵌 MySQL（打包运行自带数据库，无需外挂实例）
  //   auto=检出二进制则托管启动；true=强制（缺失报错）；false=关闭（连接外部 DB）
  OPS_EMBEDDED_MYSQL: optional('OPS_EMBEDDED_MYSQL', 'auto'),
  OPS_MYSQL_HOME: optional('OPS_MYSQL_HOME', ''),
  OPS_MYSQL_DATA_DIR: optional('OPS_MYSQL_DATA_DIR', ''),
  OPS_MYSQL_STOP_ON_EXIT: optional('OPS_MYSQL_STOP_ON_EXIT', 'false') === 'true',
  // 启动期执行 SQL 迁移（本地打包运行推荐开启；开启时自动关闭 synchronize）
  OPS_DB_MIGRATIONS_RUN: optional(
    'OPS_DB_MIGRATIONS_RUN',
    optional('NODE_ENV', 'development') === 'production' ? 'true' : 'false',
  ) === 'true',

  // Redis
  REDIS_HOST: optional('REDIS_HOST', '127.0.0.1'),
  REDIS_PORT: int('REDIS_PORT', 6379),
  REDIS_URL: optional('REDIS_URL', 'redis://127.0.0.1:6379'),

  // 域名
  DOMAIN: optional('DOMAIN', `http://localhost:${int('PORT', 3100)}`),
  API_DOMAIN: optional('API_DOMAIN', `http://localhost:${int('PORT', 3100)}`),
  ADMIN_DOMAIN: optional('ADMIN_DOMAIN', `http://localhost:${int('PORT', 3100)}`),
  MERCHANT_DOMAIN: optional('MERCHANT_DOMAIN', `http://localhost:${int('PORT', 3100)}`),

  // 跨域 / 日志 / 告警
  CORS_ORIGINS: optional('CORS_ORIGINS', ''),
  LOG_LEVEL: optional('LOG_LEVEL', 'info'),
  FEISHU_WEBHOOK_URL: optional('FEISHU_WEBHOOK_URL', ''),
  FEISHU_ALERT_WEBHOOK_URL: optional('FEISHU_ALERT_WEBHOOK_URL', ''),

  // 运营系统专属（OPS_）
  OPS_LLM_GATEWAY: optional('OPS_LLM_GATEWAY', ''),
  OPS_LLM_GATEWAY_TYPE: optional('OPS_LLM_GATEWAY_TYPE', 'ollama'),
  OPS_LLM_GATEWAY_KEY: optional('OPS_LLM_GATEWAY_KEY', ''),
  OPS_OLLAMA_HOST: optional('OPS_OLLAMA_HOST', '127.0.0.1'),
  OPS_OLLAMA_PORT: int('OPS_OLLAMA_PORT', 11434),
  OPS_OLLAMA_MODEL: optional('OPS_OLLAMA_MODEL', 'qwen2.5:7b'),
  OPS_OSS_ENDPOINT: optional('OPS_OSS_ENDPOINT', ''),
  OPS_OSS_BUCKET: optional('OPS_OSS_BUCKET', ''),
  OPS_OSS_ACCESS_KEY: optional('OPS_OSS_ACCESS_KEY', ''),
  OPS_OSS_SECRET_KEY: optional('OPS_OSS_SECRET_KEY', ''),
  OPS_OSS_REGION: optional('OPS_OSS_REGION', 'us-east-1'),
  OPS_OSS_FORCE_PATH_STYLE: optional('OPS_OSS_FORCE_PATH_STYLE', 'true'),
  OPS_OSS_PUBLIC_URL: optional('OPS_OSS_PUBLIC_URL', ''),

  // FFmpeg（空=自动探测 PATH + 常见路径）
  OPS_FFMPEG_PATH: optional('OPS_FFMPEG_PATH', ''),
  // AI 页面观察（浏览器快照）：目标前端基址 / 无头开关 / chromium 可执行路径
  OPS_BROWSER_BASE: optional('OPS_BROWSER_BASE', 'http://localhost:5173'),
  OPS_BROWSER_HEADLESS: optional('OPS_BROWSER_HEADLESS', 'true') === 'true',
  OPS_BROWSER_EXECUTABLE: optional('OPS_BROWSER_EXECUTABLE', ''),
  // 浏览器实例池容量（多租户并发工作；按机器内存与并发租户数调整）
  OPS_BROWSER_MAX_INSTANCES: optional('OPS_BROWSER_MAX_INSTANCES', '5'),
  OPS_BROWSER_MAX_PAGES_PER_INSTANCE: optional('OPS_BROWSER_MAX_PAGES_PER_INSTANCE', '10'),
  OPS_BROWSER_KEEP_ALIVE_MS: optional('OPS_BROWSER_KEEP_ALIVE_MS', '300000'),
  OPS_BROWSER_CLEANUP_IDLE_MS: optional('OPS_BROWSER_CLEANUP_IDLE_MS', '60000'),
  // 抖音开放平台（发布用；空=降级模拟回执）
  OPS_DOUYIN_APP_ID: optional('OPS_DOUYIN_APP_ID', ''),
  OPS_DOUYIN_APP_SECRET: optional('OPS_DOUYIN_APP_SECRET', ''),

  // 双模式接入（规划 §17）：standalone=独立自营；connected=经 ZhixiangCore SSO 打通管理系统
  OPS_INTEGRATION_MODE: optional('OPS_INTEGRATION_MODE', 'standalone'),
  // 管理系统 API 基址（统一管理后台方案 §5.4；connected 模式使用）
  OPS_MS_API_BASE: optional('OPS_MS_API_BASE', 'https://api.onepan.cn/api'),
  // 服务账号凭证（P3 主数据同步使用；SSO 验签不依赖）
  OPS_MS_CLIENT_ID: optional('OPS_MS_CLIENT_ID', ''),
  OPS_MS_CLIENT_SECRET: optional('OPS_MS_CLIENT_SECRET', ''),
  // SSO 签发的运营 token 有效期（建议跟随管理系统 4h）
  OPS_SSO_TOKEN_TTL: optional('OPS_SSO_TOKEN_TTL', '4h'),
  // 文件上传目录（默认 ./uploads）
  OPS_UPLOAD_DIR: optional('OPS_UPLOAD_DIR', ''),
  // 公网可访问的 base URL（用于返回文件的公网地址）
  PUBLIC_URL: optional('PUBLIC_URL', ''),

  // 令牌加密密钥（缺省复用 JWT_SECRET）：用于加密存储平台 Access/Refresh Token
  OPS_TOKEN_SECRET:
    optional('OPS_TOKEN_SECRET') || optional('JWT_SECRET', 'zhixiang-ops-token-secret'),
  // 敏感字段加密密钥（缺省复用 JWT_SECRET）：用于加密订单收货信息等授权交易数据（§11②）
  OPS_DATA_SECRET:
    optional('OPS_DATA_SECRET') || optional('JWT_SECRET', 'zhixiang-ops-data-secret'),

  // 管理系统 SSO 验签密钥（缺省复用 JWT_SECRET）：
  // 管理系统与运营系统共用密钥时无需配置；独立部署/密钥轮换时配置专用验签密钥，
  // 避免两系统凭据任一泄露即双向伪造。
  OPS_MS_JWT_SECRET: optional('OPS_MS_JWT_SECRET') || optional('JWT_SECRET', ''),

  // 开放注册开关：false 时 /ops/auth/register 返回 REGISTER_DISABLED。
  // 生产环境建议关闭（注册应走管理员邀请/员工管理），演示与首次部署可开启。
  allowRegister: optional('OPS_ALLOW_REGISTER', 'true') === 'true',

  // 演示模式：开启后允许免密「演示登录」并在启动时自动种子演示数据；
  // 系统初始化（/ops/system/init）会清除演示租户的全部演示数据。默认关闭，避免演示数据混入正式环境。
  demoMode: optional('OPS_DEMO_MODE', 'false') === 'true',
  demoTenant: optional('OPS_DEMO_TENANT', 't_demo'),
  demoUsername: optional('OPS_DEMO_USERNAME', 'demo'),
  demoPassword: optional('OPS_DEMO_PASSWORD', ''),
};

export type AppEnv = typeof env;
