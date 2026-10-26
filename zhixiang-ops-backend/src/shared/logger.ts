/**
 * 结构化日志工具
 * 提供统一的日志格式，便于接入外部日志系统 (如 ELK, Papertrace, etc.)
 *
 * 同时保留两套 API：
 * 1) pino 统一日志（对齐管理系统：pino + LOG_LEVEL，5xx 经飞书告警）
 *    logger / traceLogger(traceId) / alertError —— 兼容既有业务代码
 * 2) Logger 类（浏览器工作台等新模块的结构化控制台日志）
 */

import pino from 'pino';
import { env } from '../config/env';

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

/** 返回绑定了 traceId 的子 logger，便于按请求聚合日志。传入空值则回退根 logger。 */
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
  void fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ msg_type: 'text', content: { text: `[zhixiang-ops] ${message}` } }),
  }).catch(() => {
    logger.error('飞书告警发送失败');
  });
}

export enum LogLevel {
  Error = 'error',
  Warn = 'warn',
  Info = 'info',
  Debug = 'debug',
  Trace = 'trace',
}

export interface LogContext {
  requestId?: string;
  tenantId?: string;
  operation?: string;
  module?: string;
  duration?: number;
  [key: string]: unknown;
}

export interface StructuredLog {
  timestamp: number;
  level: LogLevel;
  message: string;
  context: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export class Logger {
  private static instance: Logger | null = null;

  private constructor() {}

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * 记录错误日志
   */
  error(message: string, context?: Omit<LogContext, 'level'>): void {
    this.log(LogLevel.Error, message, context);
  }

  /**
   * 记录警告日志
   */
  warn(message: string, context?: Omit<LogContext, 'level'>): void {
    this.log(LogLevel.Warn, message, context);
  }

  /**
   * 记录信息日志
   */
  info(message: string, context?: Omit<LogContext, 'level'>): void {
    this.log(LogLevel.Info, message, context);
  }

  /**
   * 记录调试日志
   */
  debug(message: string, context?: Omit<LogContext, 'level'>): void {
    this.log(LogLevel.Debug, message, context);
  }

  /**
   * 记录跟踪日志
   */
  trace(message: string, context?: Omit<LogContext, 'level'>): void {
    this.log(LogLevel.Trace, message, context);
  }

  private log(level: LogLevel, message: string, context?: Omit<LogContext, 'level'>): void {
    // 输出到控制台 (生产环境应接入外部日志系统；结构化字段随 context 序列化输出)
    const contextStr = context ? JSON.stringify(context) : '{}';
    console.log(
      `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message} [Ctx: ${contextStr}]`,
    );
  }
}

/**
 * 创建带上下文的日志记录器
 */
export function createLogger(_context: Omit<LogContext, 'level'>): Logger {
  return Logger.getInstance();
}
