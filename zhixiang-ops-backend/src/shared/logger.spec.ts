import { env } from '../config/env';
import { logger, traceLogger, alertError } from './logger';

describe('logger', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    (env as Record<string, unknown>).FEISHU_ALERT_WEBHOOK_URL = '';
  });

  it('traceLogger 绑定 traceId 生成子 logger', () => {
    const child = traceLogger('tid123');
    expect(child).not.toBe(logger);
    expect(child.bindings().traceId).toBe('tid123');
  });

  it('traceLogger 无 traceId 回退根 logger', () => {
    expect(traceLogger(undefined)).toBe(logger);
  });

  it('alertError 未配置飞书告警时走 logger.error', () => {
    (env as Record<string, unknown>).FEISHU_ALERT_WEBHOOK_URL = '';
    const errSpy = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    alertError('boom');
    expect(errSpy).toHaveBeenCalled();
  });

  it('alertError 配置后异步推送飞书，携带 text 内容', async () => {
    (env as Record<string, unknown>).FEISHU_ALERT_WEBHOOK_URL = 'https://feishu.example/hook';
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    (globalThis as Record<string, unknown>).fetch = fetchMock;
    jest.spyOn(logger, 'error').mockImplementation(() => undefined);

    alertError('数据库异常', { code: 'DB_UNAVAILABLE' });
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://feishu.example/hook',
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.content.text).toContain('数据库异常');
  });

  it('飞书推送失败走 catch 兜底日志', async () => {
    (env as Record<string, unknown>).FEISHU_ALERT_WEBHOOK_URL = 'https://feishu.example/hook';
    const fetchMock = jest.fn().mockRejectedValue(new Error('net down'));
    (globalThis as Record<string, unknown>).fetch = fetchMock;
    const errSpy = jest.spyOn(logger, 'error').mockImplementation(() => undefined);

    alertError('boom');
    await Promise.resolve();

    expect(errSpy).toHaveBeenCalledWith('飞书告警发送失败');
  });
});
