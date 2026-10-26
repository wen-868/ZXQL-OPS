/**
 * 浏览器工作台 WS 网关单测
 * 覆盖：status 查询、execute 成功/失败、takeover 守卫、解析失败兜底
 */

import { HttpAdapterHost } from '@nestjs/core';
import { BrowserWsGateway } from './browser-ws.gateway';
import { BrowserGateway } from '../../playwright/BrowserGateway';
import { AuditService } from '../n/audit.service';

// url-guard 含实时 DNS 解析（fail-closed），单测环境 mock 掉以保持离线确定性；
// DNS/字面量拦截逻辑由 url-guard 自身 spec 覆盖
jest.mock('../../shared/url-guard', () => ({
  checkUrl: jest.fn(async (raw: string) => ({ ok: true, url: raw.trim() })),
}));

class FakeWS {
  static OPEN = 1;
  readyState = 1;
  sent: any[] = [];
  handlers: Record<string, Function> = {};
  on(ev: string, fn: Function) {
    this.handlers[ev] = fn;
  }
  ping() {}
  send(raw: string, cb?: (err?: Error) => void) {
    this.sent.push(JSON.parse(raw));
    cb?.();
  }
  terminate() {}
  close() {}
  // 测试帮助：模拟收到上行消息
  emitMessage(raw: string) {
    this.handlers['message']?.(Buffer.from(raw));
  }
}

describe('BrowserWsGateway', () => {
  const readyStatus = {
    ready: true,
    circuitBreakerState: 'closed',
    poolStats: { totalInstances: 1 },
    poolMax: 5,
    tenantId: 't_demo',
  };

  function makeGateway(gwResults?: { execute?: any }) {
    const mockHttpAdapter = {
      httpAdapter: { getHttpServer: () => ({ on: jest.fn() }) },
    } as unknown as HttpAdapterHost;
    const mockAudit = { record: jest.fn().mockResolvedValue({}) } as unknown as AuditService;
    const mockCdp = {
      send: jest.fn().mockResolvedValue(undefined),
      detach: jest.fn().mockResolvedValue(undefined),
    };
    const mockPage = {
      screenshot: jest.fn().mockResolvedValue(Buffer.from('frame-png')),
      url: jest.fn().mockReturnValue('https://example.com/'),
      title: jest.fn().mockResolvedValue('Example Domain'),
      context: jest.fn().mockReturnValue({
        newCDPSession: jest.fn().mockResolvedValue(mockCdp),
      }),
    };
    const mockBrowserGateway = {
      getStatus: jest.fn().mockReturnValue(readyStatus),
      executeSequence: jest
        .fn()
        .mockResolvedValue(gwResults?.execute ?? { success: true, duration: 123, retryCount: 0 }),
      getBrowserPage: jest.fn().mockResolvedValue({ page: mockPage, instanceId: 'instance-1' }),
      releaseBrowserPage: jest.fn(),
    } as unknown as BrowserGateway;
    const gw = new BrowserWsGateway(mockHttpAdapter, mockBrowserGateway, mockAudit);
    return { gw, mockAudit, mockBrowserGateway, mockPage, mockCdp };
  }

  function connect(gw: BrowserWsGateway) {
    const ws = new FakeWS() as any;
    // 与 handleConnection 同构地注册会话状态（真实连接经 upgrade → handleConnection）
    (gw as any).clients.set(ws, {
      tenantId: 't_demo',
      traceId: 'tr-' + Math.random().toString(36).slice(2),
      takeover: false,
      running: false,
      alive: true,
    });
    const state = (gw as any).clients.get(ws);
    return { ws, state };
  }

  it('未注册连接前 handshake 状态构建正常（buildStatusPayload 字段齐全）', () => {
    const { gw } = makeGateway();
    const status = (gw as any).buildStatusPayload({
      tenantId: 't_demo',
      traceId: 'tr',
      takeover: false,
      running: false,
      alive: true,
    });
    expect(status.status).toBe('connected');
    expect(status.executor).toBe(true);
    expect(status.poolCount).toBe(1);
    expect(status.poolMax).toBe(5);
    expect(status.circuit).toBe('closed');
  });

  it('status 查询回传 status 消息', async () => {
    const { gw } = makeGateway();
    const { ws } = connect(gw);
    await (gw as any).handleMessage(ws, (gw as any).clients.get(ws), JSON.stringify({ type: 'status', pageId: 'p1' }));
    const statusMsg = ws.sent.find((m) => m.type === 'status');
    expect(statusMsg).toBeTruthy();
    expect(statusMsg.payload.status).toBe('connected');
  });

  it('frame 消息：回传实时画面帧并回填页面地址/标题，且不产生 taskResult', async () => {
    const { gw, mockBrowserGateway, mockPage } = makeGateway();
    const { ws } = connect(gw);
    const state = (gw as any).clients.get(ws);
    await (gw as any).handleMessage(ws, state, JSON.stringify({ type: 'frame', pageId: 'p1' }));

    const frame = ws.sent.find((m) => m.type === 'frame');
    expect(frame).toBeTruthy();
    expect(frame.payload).toBe(Buffer.from('frame-png').toString('base64'));
    expect(ws.sent.find((m) => m.type === 'taskResult')).toBeUndefined();
    expect(state.lastUrl).toBe('https://example.com/');
    expect(state.lastTitle).toBe('Example Domain');
    // 取页后必须归还（否则实例泄漏）
    expect(mockPage.screenshot).toHaveBeenCalled();
    expect(mockBrowserGateway.releaseBrowserPage).toHaveBeenCalledWith('instance-1', mockPage);
    expect(state.frameInFlight).toBe(false);
  });

  it('frame 消息：指令执行中（running）跳过捕获，避免争抢页面', async () => {
    const { gw, mockBrowserGateway } = makeGateway();
    const { ws } = connect(gw);
    const state = (gw as any).clients.get(ws);
    state.running = true;
    await (gw as any).handleMessage(ws, state, JSON.stringify({ type: 'frame', pageId: 'p1' }));
    expect(ws.sent.find((m) => m.type === 'frame')).toBeUndefined();
    expect(mockBrowserGateway.getBrowserPage).not.toHaveBeenCalled();
  });

  it('takeover：绑定页面并通过 CDP 转发鼠标/键盘事件', async () => {
    const { gw, mockBrowserGateway, mockCdp } = makeGateway();
    const { ws } = connect(gw);
    const state = (gw as any).clients.get(ws);
    await (gw as any).handleMessage(ws, state, JSON.stringify({ type: 'takeover' }));
    expect(mockBrowserGateway.getBrowserPage).toHaveBeenCalledTimes(1);
    expect(state.takeoverPage).toBeTruthy();

    await (gw as any).handleMessage(
      ws,
      state,
      JSON.stringify({
        type: 'input',
        event: { kind: 'mouse', action: 'down', x: 100, y: 200, button: 'left', clickCount: 1 },
      }),
    );
    expect(mockCdp.send).toHaveBeenCalledWith(
      'Input.dispatchMouseEvent',
      expect.objectContaining({ type: 'mousePressed', x: 100, y: 200, button: 'left' }),
    );

    await (gw as any).handleMessage(
      ws,
      state,
      JSON.stringify({
        type: 'input',
        event: { kind: 'key', action: 'down', key: 'a', code: 'KeyA', keyCode: 65, text: 'a' },
      }),
    );
    expect(mockCdp.send).toHaveBeenCalledWith(
      'Input.dispatchKeyEvent',
      expect.objectContaining({ type: 'keyDown', text: 'a' }),
    );

    // 越界坐标被夹紧（不能借输入注入任意值）
    await (gw as any).handleMessage(
      ws,
      state,
      JSON.stringify({ type: 'input', event: { kind: 'wheel', x: -5, y: 99999, deltaY: 120 } }),
    );
    expect(mockCdp.send).toHaveBeenCalledWith(
      'Input.dispatchMouseEvent',
      expect.objectContaining({ type: 'mouseWheel', x: 0, y: 4096 }),
    );
  });

  it('input：非接管状态被忽略；resume 解绑并归还接管页', async () => {
    const { gw, mockBrowserGateway, mockPage, mockCdp } = makeGateway();
    const { ws } = connect(gw);
    const state = (gw as any).clients.get(ws);

    // 未接管：直接忽略，不建页面、不发 CDP
    await (gw as any).handleMessage(
      ws,
      state,
      JSON.stringify({ type: 'input', event: { kind: 'mouse', action: 'down', x: 1, y: 1 } }),
    );
    expect(mockCdp.send).not.toHaveBeenCalled();
    expect(mockBrowserGateway.getBrowserPage).not.toHaveBeenCalled();

    await (gw as any).handleMessage(ws, state, JSON.stringify({ type: 'takeover' }));
    await (gw as any).handleMessage(ws, state, JSON.stringify({ type: 'resume' }));
    expect(state.takeoverPage).toBeUndefined();
    expect(mockCdp.detach).toHaveBeenCalled();
    expect(mockBrowserGateway.releaseBrowserPage).toHaveBeenCalledWith('instance-1', mockPage);
  });

  it('execute 成功：回 taskResult(success) 并记录审计', async () => {
    const { gw, mockAudit } = makeGateway();
    const { ws } = connect(gw);
    const state = (gw as any).clients.get(ws);
    await (gw as any).handleMessage(
      ws,
      state,
      JSON.stringify({ type: 'execute', payload: 'navigate https://example.com', pageId: 'p1' }),
    );
    const result = ws.sent.find((m) => m.type === 'taskResult');
    expect(result.payload.success).toBe(true);
    expect(result.payload.duration).toBe(123);
    expect(mockAudit.record).toHaveBeenCalled();
    expect(state.running).toBe(false);
  });

  it('execute 解析失败：回 taskResult(success=false, error)', async () => {
    const { gw } = makeGateway();
    const { ws } = connect(gw);
    await (gw as any).handleMessage(
      ws,
      (gw as any).clients.get(ws),
      JSON.stringify({ type: 'execute', payload: '不存在的指令' }),
    );
    const result = ws.sent.find((m) => m.type === 'taskResult');
    expect(result.payload.success).toBe(false);
    expect(String(result.payload.error)).toContain('未知的指令格式');
  });

  it('takeover 期间 execute 被拒绝；resume 后恢复', async () => {
    const { gw } = makeGateway();
    const { ws } = connect(gw);
    const state = (gw as any).clients.get(ws);
    await (gw as any).handleMessage(ws, state, JSON.stringify({ type: 'takeover' }));
    expect(state.takeover).toBe(true);
    await (gw as any).handleMessage(ws, state, JSON.stringify({ type: 'execute', payload: 'wait 100' }));
    const refused = ws.sent.find((m) => m.type === 'taskResult');
    expect(refused.payload.success).toBe(false);
    expect(String(refused.payload.error)).toContain('人工接管');

    await (gw as any).handleMessage(ws, state, JSON.stringify({ type: 'resume' }));
    expect(state.takeover).toBe(false);
  });

  it('running 状态下拒绝并发 execute', async () => {
    const { gw } = makeGateway();
    const { ws } = connect(gw);
    const state = (gw as any).clients.get(ws);
    state.running = true;
    await (gw as any).handleMessage(ws, state, JSON.stringify({ type: 'execute', payload: 'wait 100' }));
    const refused = ws.sent.find((m) => m.type === 'taskResult');
    expect(refused.payload.success).toBe(false);
    expect(String(refused.payload.error)).toContain('正在执行');
  });

  it('非法 JSON 消息回 taskResult 失败', async () => {
    const { gw } = makeGateway();
    const { ws } = connect(gw);
    await (gw as any).handleMessage(ws, (gw as any).clients.get(ws), 'not-json');
    const result = ws.sent.find((m) => m.type === 'taskResult');
    expect(result.payload.success).toBe(false);
  });

  it('execute 带截图结果时推送 screenshot 消息', async () => {
    const execute = {
      success: true,
      duration: 50,
      retryCount: 0,
      screenshot: 'AAAA',
      url: 'https://creator.douyin.com/',
      title: '抖音创作者中心',
    };
    const { gw } = makeGateway({ execute });
    const { ws } = connect(gw);
    const state = (gw as any).clients.get(ws);
    await (gw as any).handleMessage(
      ws,
      state,
      JSON.stringify({ type: 'execute', payload: 'screenshot', pageId: 'p1' }),
    );
    const shot = ws.sent.find((m) => m.type === 'screenshot');
    expect(shot.payload).toBe('AAAA');
    expect(state.lastUrl).toContain('douyin.com');
    const statusAfter = (gw as any).buildStatusPayload(state);
    expect(statusAfter.platform).toBe('douyin');
  });

  it('navigate 命中 SSRF 守卫时拒绝执行并回错误', async () => {
    const { checkUrl } = jest.requireMock('../../shared/url-guard') as {
      checkUrl: jest.Mock;
    };
    checkUrl.mockResolvedValueOnce({ ok: false, reason: '不允许访问的内网地址: 127.0.0.1' });
    const { gw } = makeGateway();
    const { ws } = connect(gw);
    await (gw as any).handleMessage(
      ws,
      (gw as any).clients.get(ws),
      JSON.stringify({ type: 'execute', payload: 'navigate http://127.0.0.1:8080/admin', pageId: 'p1' }),
    );
    const result = ws.sent.find((m) => m.type === 'taskResult');
    expect(result.payload.success).toBe(false);
    expect(String(result.payload.error)).toContain('导航目标被拒绝');
  });
});
