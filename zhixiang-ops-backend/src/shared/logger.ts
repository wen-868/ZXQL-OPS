import pino from 'pino';
import { env } from '../config/env';

/**
 * 统一日志（对齐管理系统：pino + LOG_LEVEL，5xx 经飞书告警）。
 * 默认带 service 字段；请求级日志用 traceLogger(traceId) 绑定链路号。
 */

export const logger = pino({
  level: env.LOG_LEVEL || 'info',
  base: { service: 'zhixiang-ops' },
  ...(env.NODE_ENV !== 'production'
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
        },
      }
    : {}),
});

/**
 * 返回绑定了 traceId 的子 logger，便于按请求聚合日志。
 * 传入空值则回退根 logger（如请求作用域外调用）。
 */
export function traceLogger(traceId?: string): pino.Logger {
  return traceId ? logger.child({ traceId }) : logger;
}

/** 严重错误推飞书（对齐管理系统的告警通道；未配置则不发送） */
export function alertError(message: string, extra?: Record<string, unknown>): void {
  const url = env.FEISHU_ALERT_WEBHOOK_URL;
  if (!url) {
    logger.error({ alert: message, ...extra }, 'alert(未配置飞书告警)');
    return;
  }
  // 异步发送，不阻塞主流程
  void fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ msg_type: 'text', content: { text: `[zhixiang-ops] ${message}` } }),
  }).catch(() => {
    logger.error('飞书告警发送失败');
  });
}
