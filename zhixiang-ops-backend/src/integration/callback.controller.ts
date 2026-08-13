import { Body, Controller, Post, Req } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import { IntegrationService } from './integration.service';
import { env } from '../config/env';
import { AppError } from '../shared/app-error';
import { Public } from '../auth/public.decorator';

/** Nest 开启 rawBody 后挂载的原始请求字节（Express 类型未内置） */
type RawBodyRequest = Request & { rawBody?: Buffer };

/**
 * 管理系统回调入口（规划 §17，双模式）。
 * 接收管理系统推送：订单结算 / 库存更新 / 租户变更 / 财务更新。
 * - 配置了 OPS_MS_CLIENT_SECRET 时强制校验 X-Core-Signature（HMAC-SHA256，对齐方案 §18-⑦）；
 *   未配置（本地调试 / standalone）跳过校验。
 * - standalone 模式仅确认收到（占位），connected 模式接入后做真实双向同步。
 */
@Public()
@Controller('integration/callbacks')
export class CallbackController {
  constructor(private readonly svc: IntegrationService) {}

  /** 校验管理系统 Webhook 签名：X-Core-Signature = HMAC-SHA256(rawBody, CLIENT_SECRET) */
  private verifySignature(req: RawBodyRequest): void {
    const secret = env.OPS_MS_CLIENT_SECRET;
    if (!secret) return;

    const provided = String(req.headers['x-core-signature'] ?? '')
      .replace(/^sha256=/i, '')
      .trim();
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');

    const expectedBuf = Buffer.from(expected.toLowerCase(), 'utf8');
    const providedBuf = Buffer.from(provided.toLowerCase(), 'utf8');
    if (
      !provided ||
      expectedBuf.length !== providedBuf.length ||
      !timingSafeEqual(expectedBuf, providedBuf)
    ) {
      throw new AppError('CALLBACK_SIGNATURE_INVALID');
    }
  }

  @Post('order-settled')
  orderSettled(@Req() req: RawBodyRequest, @Body() body: Record<string, unknown>) {
    this.verifySignature(req);
    return { event: 'order-settled', received: true, mode: this.svc.mode, payload: body };
  }

  @Post('stock-updated')
  stockUpdated(@Req() req: RawBodyRequest, @Body() body: Record<string, unknown>) {
    this.verifySignature(req);
    return { event: 'stock-updated', received: true, mode: this.svc.mode, payload: body };
  }

  @Post('tenant-updated')
  tenantUpdated(@Req() req: RawBodyRequest, @Body() body: Record<string, unknown>) {
    this.verifySignature(req);
    return { event: 'tenant-updated', received: true, mode: this.svc.mode, payload: body };
  }

  @Post('financial-updated')
  financialUpdated(@Req() req: RawBodyRequest, @Body() body: Record<string, unknown>) {
    this.verifySignature(req);
    return { event: 'financial-updated', received: true, mode: this.svc.mode, payload: body };
  }
}
