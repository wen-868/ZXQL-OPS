import { createHmac } from 'crypto';
import { CallbackController } from './callback.controller';
import { IntegrationService } from './integration.service';
import { env } from '../config/env';
import { AppError } from '../shared/app-error';
import type { Request } from 'express';

/**
 * 管理系统 Webhook 回调签名校验单测（方案 §18-⑦）。
 * 覆盖：正确签名通过、错误签名拒绝、sha256= 前缀兼容、未配置密钥放行。
 */

function makeReq(body: unknown, signature?: string): Request {
  return {
    headers: signature ? { 'x-core-signature': signature } : {},
    rawBody: Buffer.from(JSON.stringify(body)),
    body,
  } as unknown as Request;
}

describe('CallbackController（管理系统 Webhook 回调）', () => {
  let controller: CallbackController;
  let originalSecret: string;

  beforeAll(() => {
    controller = new CallbackController(new IntegrationService());
    originalSecret = env.OPS_MS_CLIENT_SECRET;
  });

  afterEach(() => {
    env.OPS_MS_CLIENT_SECRET = originalSecret;
  });

  it('配置密钥 + 正确签名：校验通过并确认收到', () => {
    env.OPS_MS_CLIENT_SECRET = 'test-secret';
    const body = { orderId: 'P-1', status: 'settled' };
    const signature = createHmac('sha256', 'test-secret')
      .update(JSON.stringify(body))
      .digest('hex');
    const res = controller.orderSettled(makeReq(body, signature), body);
    expect(res.received).toBe(true);
    expect(res.event).toBe('order-settled');
  });

  it('配置密钥 + sha256= 前缀签名：兼容通过', () => {
    env.OPS_MS_CLIENT_SECRET = 'test-secret';
    const body = { stock: 10 };
    const signature = `sha256=${createHmac('sha256', 'test-secret')
      .update(JSON.stringify(body))
      .digest('hex')}`;
    const res = controller.stockUpdated(makeReq(body, signature), body);
    expect(res.received).toBe(true);
  });

  it('配置密钥 + 错误签名：拒绝（CALLBACK_SIGNATURE_INVALID）', () => {
    env.OPS_MS_CLIENT_SECRET = 'test-secret';
    const body = { tenantId: '1' };
    expect(() => controller.tenantUpdated(makeReq(body, 'bad-signature'), body)).toThrow(
      expect.objectContaining({ code: 'CALLBACK_SIGNATURE_INVALID' }),
    );
  });

  it('配置密钥 + 缺失签名：拒绝（CALLBACK_SIGNATURE_INVALID）', () => {
    env.OPS_MS_CLIENT_SECRET = 'test-secret';
    const body = { period: '2026-08' };
    expect(() => controller.financialUpdated(makeReq(body), body)).toThrow(
      expect.objectContaining({ code: 'CALLBACK_SIGNATURE_INVALID' }),
    );
  });

  it('未配置密钥（standalone/本地调试）：放行', () => {
    env.OPS_MS_CLIENT_SECRET = '';
    const body = { orderId: 'P-1' };
    const res = controller.orderSettled(makeReq(body), body);
    expect(res.received).toBe(true);
  });

  it('错误类型为 AppError（错误码表兜底）', () => {
    env.OPS_MS_CLIENT_SECRET = 'test-secret';
    try {
      controller.orderSettled(makeReq({}, 'bad'), {});
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).httpStatus).toBe(401);
    }
  });
});
