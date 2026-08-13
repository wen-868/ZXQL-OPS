import type { ErrorRequestHandler } from "express";
import { ZodError, type ZodIssue } from "zod";
import logger from "../shared/logger";
import { fail } from "../shared/response";
import { insertErrorLog } from "../services/admin/error-log.service";
import { reportToLingZhou } from "../shared/feishu-report";
import { env } from "../shared/env";

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  logger.error(err);

  const errorMessage = err instanceof Error ? err.message : String(err);
  const errorStack = err instanceof Error ? err.stack : undefined;
  const requestUrl = req.originalUrl || req.url || "";
  const requestMethod = req.method || "";

  // ZodError：参数校验失败，返回 400 及具体字段错误
  if (err instanceof ZodError) {
    const fieldErrors = err.errors.map((e: ZodIssue) => ({
      field: e.path.join(".") || "root",
      message: e.message,
      code: e.code
    }));

    const userId = (req as { user?: { id: number } }).user?.id || undefined;
    const tenantId = (req as { tenantId?: number | string }).tenantId || undefined;

    insertErrorLog({
      error_type: "validation",
      severity: "WARN",
      message: errorMessage,
      stack: errorStack,
      request_url: requestUrl,
      request_method: requestMethod,
      status_code: 400,
      user_id: userId,
      tenant_id: tenantId,
      source: "backend",
    }).catch((e) => logger.error("insertErrorLog failed", e));

    res.status(400).json({ ...fail("参数校验失败", "400"), errors: fieldErrors });
    return;
  }

  // 业务错误：带有 statusCode 属性的错误，返回对应状态码
  if (err && typeof err === "object" && "statusCode" in err) {
    const status = (err as { statusCode?: number }).statusCode as number;
    const message = (err as { message?: string }).message || "请求错误";
    const code = String(status);
    res.status(status).json(fail(message, code));

    // 5xx 错误：记录日志并上报凌舟
    if (status >= 500) {
      insertErrorLog({
        error_type: "server",
        severity: "ERROR",
        message: errorMessage,
        stack: errorStack,
        request_url: requestUrl,
        request_method: requestMethod,
        status_code: status,
      }).catch((e) => logger.error("insertErrorLog failed", e));

      reportToLingZhou({
        phase: "系统错误告警",
        status: "BLOCKED",
        summary: `[${requestMethod}] ${requestUrl} — ${message}`,
        details: [
          { label: "请求URL", value: `${requestMethod} ${requestUrl}` },
          { label: "状态码", value: String(status) },
          { label: "错误消息", value: message },
        ],
        reporter: "系统自动告警",
        webhookUrl: env.FEISHU_ALERT_WEBHOOK_URL || undefined,
      }).catch((e) => logger.error("reportToLingZhou failed", e));
    }
    return;
  }

// 未知错误：返回 500，写入错误日志 + 飞书告警
  const userId = (req as { user?: { id: number } }).user?.id || undefined;
  const tenantId = (req as { tenantId?: number }).tenantId || undefined;

  insertErrorLog({
    error_type: "unhandled_error",
    severity: "ERROR",
    message: errorMessage,
    stack: errorStack,
    request_url: requestUrl,
    request_method: requestMethod,
    status_code: 500,
    user_id: userId ? String(userId) : undefined,
    tenant_id: tenantId ? String(tenantId) : undefined,
    source: "backend",
  }).catch((e) => logger.error("insertErrorLog failed", e));

  reportToLingZhou({
    phase: "系统错误告警",
    status: "BLOCKED",
    summary: `[ERROR] [${requestMethod}] ${requestUrl} — ${errorMessage}`,
    details: [
      { label: "请求URL", value: `${requestMethod} ${requestUrl}` },
      { label: "用户ID", value: userId ? String(userId) : "未登录" },
      { label: "租户ID", value: tenantId ? String(tenantId) : "N/A" },
      { label: "状态码", value: "500" },
      { label: "错误消息", value: errorMessage },
      { label: "错误堆栈", value: (errorStack || "").split("\n").slice(0, 3).join("\n") },
    ],
    reporter: "系统自动告警",
    webhookUrl: env.FEISHU_ALERT_WEBHOOK_URL || undefined,
  }).catch((e) => logger.error("reportToLingZhou failed", e));

  res.status(500).json(fail("服务器内部错误", "500"));
};