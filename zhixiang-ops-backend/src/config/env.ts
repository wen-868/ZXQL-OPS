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

  // 鉴权（必填）
  JWT_SECRET: required('JWT_SECRET'),
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

  // 演示模式：开启后允许免密「演示登录」并在启动时自动种子演示数据；
  // 系统初始化（/ops/system/init）会清除演示租户的全部演示数据。默认关闭，避免演示数据混入正式环境。
  demoMode: optional('OPS_DEMO_MODE', 'false') === 'true',
  demoTenant: optional('OPS_DEMO_TENANT', 't_demo'),
};

export type AppEnv = typeof env;
