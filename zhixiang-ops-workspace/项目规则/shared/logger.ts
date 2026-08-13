import pino from "pino";
import { env } from "./env";

const pinoLogger = pino({
  level: env.LOG_LEVEL,
  transport: process.env.NODE_ENV !== "production"
    ? { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:standard" } }
    : undefined,
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },
});

// 兼容 console 风格调用：logger.info("msg", obj) 或 logger.error("msg", err)
function createLogger() {
  return {
    info: (msg: string, ...args: unknown[]) => {
      if (args.length === 0) pinoLogger.info(msg);
      else if (args.length === 1 && args[0] instanceof Error) pinoLogger.info({ err: args[0] }, msg);
      else pinoLogger.info({ extra: args }, msg);
    },
    error: (msg: string, ...args: unknown[]) => {
      if (args.length === 0) pinoLogger.error(msg);
      else if (args.length === 1 && args[0] instanceof Error) pinoLogger.error({ err: args[0] }, msg);
      else pinoLogger.error({ extra: args }, msg);
    },
    warn: (msg: string, ...args: unknown[]) => {
      if (args.length === 0) pinoLogger.warn(msg);
      else if (args.length === 1 && args[0] instanceof Error) pinoLogger.warn({ err: args[0] }, msg);
      else pinoLogger.warn({ extra: args }, msg);
    },
    debug: (msg: string, ...args: unknown[]) => {
      if (args.length === 0) pinoLogger.debug(msg);
      else if (args.length === 1 && args[0] instanceof Error) pinoLogger.debug({ err: args[0] }, msg);
      else pinoLogger.debug({ extra: args }, msg);
    },
  };
}

export default createLogger();