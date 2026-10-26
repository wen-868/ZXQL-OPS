import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { IncomingMessage } from 'http';
import type { Server } from 'http';
import type { Duplex } from 'stream';
import type { CDPSession, Page } from 'playwright';
import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { BrowserGateway } from '../../playwright/BrowserGateway';
import { parseInstruction, type Instruction } from '../../playwright/directive-parser';
import {
  validateBrowserOperation,
  type BrowserOperationValidation,
} from '../../playwright/input-validator';
import { errMessage } from '../../playwright/err-msg';
import { checkUrl } from '../../shared/url-guard';
import { verifyToken, type AuthUser } from '../../auth/auth-user';
import { AuditService } from '../n/audit.service';
import { TenantContext } from '../../tenant/tenant-context';

/** 单条 WS 连接的会话状态 */
interface ClientState {
  tenantId: string;
  traceId: string;
  /** 连接用户（来自已验签的 JWT，供审计溯源） */
  userId?: number;
  role?: string;
  pageId?: string;
  /** 人工接管中：AI 指令被拒绝执行 */
  takeover: boolean;
  /** 正在执行指令（防并发） */
  running: boolean;
  /** 实时画面帧正在捕获（单连接串行，防止帧堆积） */
  frameInFlight?: boolean;
  /** 人工接管期间绑定的页面：画面与输入都作用于同一页，保证点击坐标与所见画面一致 */
  takeoverPage?: { page: Page; instanceId: string };
  /** 接管页的 CDP 会话（转发鼠标/键盘事件到服务端浏览器） */
  cdp?: CDPSession;
  /** 最近一次推帧时间（输入后即时刷新画面的节流依据） */
  lastFrameAt?: number;
  lastUrl?: string;
  lastTitle?: string;
  alive: boolean;
}

/** 携带鉴权信息的 WebSocket（upgrade 阶段挂载） */
type AuthedWebSocket = WebSocket & { authUser?: AuthUser };

/** 前端下行消息（与 BrowserTab.vue handleMessage 协议对齐） */
interface DownlinkMessage {
  type: 'screenshot' | 'frame' | 'status' | 'taskResult' | 'retry';
  payload: any;
}

/**
 * 浏览器工作台 WebSocket 网关（原生 ws，挂在 NestJS http server /browser 路径）
 *
 * 上行（BrowserTab.vue → 后端）:
 *   { type: 'execute',  payload: '<指令原文>', pageId }
 *   { type: 'status',    pageId }
 *   { type: 'takeover',  pageId }
 *   { type: 'resume',    pageId }
 *   { type: 'frame',     pageId }              // 实时画面：轻量拉帧，与 execute 分离
 *   { type: 'input',     pageId, event }       // 人工接管：鼠标/键盘/滚轮事件（CDP 转发）
 *
 * 下行（后端 → BrowserTab.vue）:
 *   { type: 'screenshot', payload: '<base64>' }   // execute 结果附带
 *   { type: 'frame',      payload: '<base64>' }   // 实时画面帧
 *   { type: 'status',      payload: { status, url, title, executor, poolCount, poolMax, circuit, platform } }
 *   { type: 'taskResult',  payload: { success, duration, error?, retryCount? } }
 *   { type: 'retry',       payload: { attempt } }
 *
 * input.event 形态（x/y 为 1920×1080 视口坐标，由前端按 contain 比例换算）:
 *   { kind: 'mouse', action: 'move'|'down'|'up', x, y, button, buttons, clickCount, modifiers }
 *   { kind: 'wheel', x, y, deltaX, deltaY, modifiers }
 *   { kind: 'key',   action: 'down'|'up', key, code, keyCode, text, modifiers }
 *   { kind: 'text',  text }
 */
@Injectable()
export class BrowserWsGateway implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(BrowserWsGateway.name);
  private wss: WebSocketServer | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private readonly clients = new Map<WebSocket, ClientState>();

  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly browserGateway: BrowserGateway,
    private readonly auditService: AuditService,
  ) {}

  onApplicationBootstrap(): void {
    const httpServer = this.httpAdapterHost.httpAdapter.getHttpServer() as Server;
    // maxPayload 限制上行消息体积（指令/状态均为小报文，1MB 远超上限，防御恶意超包）
    this.wss = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 });

    httpServer.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      // 兼容两种接入路径：VITE_WS_URL 未带/已带 api 全局前缀
      if (url.pathname !== '/browser' && url.pathname !== '/api/browser') return; // 非本网关路径，交由其他处理器

      // 鉴权前置（安全基座）：浏览器工作台可驱动服务端 Chromium 访问任意页面，
      // 未鉴权即为 SSRF + 任意页面读取，故在 upgrade 阶段即校验 JWT，拒绝则不建立连接。
      const auth = this.authenticate(req);
      if (!auth) {
        this.logger.warn(`WS upgrade 拒绝：未通过鉴权 (${req.socket.remoteAddress})`);
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      this.wss!.handleUpgrade(req, socket, head, (ws) => {
        (ws as AuthedWebSocket).authUser = auth;
        this.wss!.emit('connection', ws, req);
      });
    });

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      this.handleConnection(ws, req);
    });

    // 心跳：30s 一轮 ping/pong，剔除死连接（商用必需，防止资源泄漏）
    this.heartbeatTimer = setInterval(() => {
      for (const [ws, state] of this.clients) {
        if (!state.alive) {
          ws.terminate();
          continue;
        }
        state.alive = false;
        try {
          ws.ping();
        } catch {
          ws.terminate();
        }
      }
    }, 30_000);

    this.logger.log('Browser WS gateway listening on ws://*/browser');
  }

  onModuleDestroy(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    for (const ws of this.clients.keys()) {
      try {
        ws.close(1001, 'server shutting down');
      } catch {
        /* ignore */
      }
    }
    this.clients.clear();
    this.wss?.close();
  }

  // ==================== 鉴权 ====================

  /**
   * 校验 upgrade 请求：从 Authorization / Sec-WebSocket-Protocol / query token 取 JWT 并验签。
   * 通过返回 AuthUser（租户与角色取自 token 载荷，绝不信任 query 的 tenant 参数，
   * 否则任何人都可借 ?tenant=xxx 跨租户驱动浏览器）。
   */
  private authenticate(req: IncomingMessage): AuthUser | null {
    const token = BrowserWsGateway.extractToken(req);
    if (!token) return null;
    try {
      return verifyToken(token);
    } catch {
      return null;
    }
  }

  /** 从 Authorization / Sec-WebSocket-Protocol / query token 三通道提取 JWT */
  private static extractToken(req: IncomingMessage): string {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const raw =
      req.headers['authorization'] ??
      req.headers['sec-websocket-protocol'] ??
      url.searchParams.get('token') ??
      '';
    // Sec-WebSocket-Protocol 可能是 "bearer, <token>" 形式，取最后一段
    const candidate = raw.includes(',') ? raw.split(',').pop()!.trim() : raw.trim();
    return candidate.replace(/^Bearer\s+/i, '').trim();
  }

  // ==================== 连接生命周期 ====================

  private handleConnection(ws: WebSocket, _req: IncomingMessage): void {
    const authUser = (ws as AuthedWebSocket).authUser;
    if (!authUser) {
      // 兜底：正常情况下 upgrade 阶段已拦截，此处防御绕过路径
      ws.close(4401, 'unauthorized');
      return;
    }
    // 租户与角色一律取自已验签的 token，不信任 URL 参数
    const tenantId = authUser.tenantId;
    const traceId = randomUUID();

    const state: ClientState = {
      tenantId,
      traceId,
      userId: authUser.id,
      role: authUser.role,
      takeover: false,
      running: false,
      alive: true,
    };
    this.clients.set(ws, state);

    this.logger.log(`WS client connected: tenant=${tenantId} user=${authUser.id} trace=${traceId}`);
    void TenantContext.run({ traceId, tenantId }, async () => {
      try {
        await this.auditService.record({
          action: 'browser_ws_connect',
          module: 'browser-workbench',
          resource: `ws:${traceId}`,
          traceId,
        });
      } catch (err: unknown) {
        this.logger.warn(`ws connect audit failed: ${errMessage(err)}`);
      }
    });

    ws.on('pong', () => {
      state.alive = true;
    });

    ws.on('message', (raw) => {
      state.alive = true;
      // ws 的 data 为 string | Buffer | ArrayBuffer | Buffer[]，统一转字符串后处理
      const text = typeof raw === 'string' ? raw : Buffer.from(raw as ArrayBufferLike).toString();
      void this.handleMessage(ws, state, text);
    });

    ws.on('error', (err: unknown) => {
      this.logger.warn(`WS client error: ${errMessage(err)}`);
    });

    ws.on('close', () => {
      this.clients.delete(ws);
      // 断开时归还接管页（否则实例永久占用，直到进程退出）
      void this.endTakeover(state);
      this.logger.log(`WS client disconnected: tenant=${state.tenantId} trace=${state.traceId}`);
      void TenantContext.run({ traceId: state.traceId, tenantId: state.tenantId }, async () => {
        try {
          await this.auditService.record({
            action: 'browser_ws_disconnect',
            module: 'browser-workbench',
            resource: `ws:${state.traceId}`,
            traceId: state.traceId,
          });
        } catch {
          /* ignore */
        }
      });
    });

    // 连接即刻推送初始状态（前端 onopen 后也会主动查询）
    this.sendStatus(ws, state).catch(() => undefined);
  }

  // ==================== 消息分发 ====================

  private async handleMessage(ws: WebSocket, state: ClientState, raw: string): Promise<void> {
    let msg: { type?: string; payload?: string; pageId?: string; event?: unknown };
    try {
      msg = JSON.parse(raw) as { type?: string; payload?: string; pageId?: string; event?: unknown };
    } catch {
      this.sendTaskResult(ws, false, '消息格式错误：需要 JSON').catch(() => undefined);
      return;
    }
    if (msg.pageId) state.pageId = msg.pageId;

    // 所有业务处理都在租户上下文内执行（Audit/适配器依赖 TenantContext）
    try {
      await TenantContext.run({ traceId: state.traceId, tenantId: state.tenantId }, async () => {
        switch (msg.type) {
          case 'execute':
            await this.handleExecute(ws, state, msg.payload || '');
            break;
          case 'status':
            await this.sendStatus(ws, state);
            break;
          case 'frame':
            await this.handleFrame(ws, state);
            break;
          case 'input':
            await this.handleInput(ws, state, msg.event);
            break;
          case 'takeover':
            state.takeover = true;
            await this.startTakeover(state);
            this.logger.log(`Client takeover: trace=${state.traceId}`);
            await this.auditService.record({
              action: 'browser_ws_takeover',
              module: 'browser-workbench',
              resource: `ws:${state.traceId}`,
              traceId: state.traceId,
            });
            await this.sendStatus(ws, state);
            break;
          case 'resume':
            state.takeover = false;
            await this.endTakeover(state);
            this.logger.log(`Client resume AI control: trace=${state.traceId}`);
            await this.auditService.record({
              action: 'browser_ws_resume',
              module: 'browser-workbench',
              resource: `ws:${state.traceId}`,
              traceId: state.traceId,
            });
            await this.sendStatus(ws, state);
            break;
          default:
            this.sendTaskResult(ws, false, `未知消息类型: ${msg.type}`).catch(() => undefined);
        }
      });
    } catch (err: unknown) {
      this.logger.error(`WS message handling failed: ${errMessage(err)}`);
      state.running = false;
      this.sendTaskResult(ws, false, errMessage(err) || '服务器内部错误').catch(() => undefined);
    }
  }

  // ==================== 实时画面帧 ====================

  /**
   * 实时画面帧（前端定时拉取，与 execute 分离的轻量通道）：
   * - 指令执行中直接跳过：避免与用户指令争抢同一页面、也避免把「截图」混进执行语义/计数
   * - 单连接串行：上一帧未回前不再捕获，防止帧堆积
   * - 只回 `{ type: 'frame', payload: base64 }`，不产生 taskResult
   * 人工接管期间仍允许拉帧（接管者正需要看画面），仅 running 时暂停。
   */
  private async handleFrame(ws: WebSocket, state: ClientState): Promise<void> {
    if (state.running || state.frameInFlight) return;
    state.frameInFlight = true;
    try {
      // 接管期间画面固定为接管页（与输入坐标同一页，避免画面/操作错页）
      if (state.takeoverPage) {
        await this.captureAndSendFrame(ws, state, state.takeoverPage.page);
        return;
      }
      const acquired = await this.browserGateway.getBrowserPage();
      if (!acquired) return;
      const { page, instanceId } = acquired;
      try {
        await this.captureAndSendFrame(ws, state, page);
      } finally {
        this.browserGateway.releaseBrowserPage(instanceId, page);
      }
    } catch (err: unknown) {
      this.logger.warn(`实时画面帧捕获失败 trace=${state.traceId}: ${errMessage(err)}`);
    } finally {
      state.frameInFlight = false;
    }
  }

  /** 捕获一帧并下发；同时回填页面地址/标题（调用方负责页面归属与释放） */
  private async captureAndSendFrame(ws: WebSocket, state: ClientState, page: Page): Promise<void> {
    const buffer = await page.screenshot();
    const url = page.url();
    const title = await page.title();
    if (url) state.lastUrl = url;
    if (title) state.lastTitle = title;
    state.lastFrameAt = Date.now();
    await this.send(ws, { type: 'frame', payload: buffer.toString('base64') });
  }

  // ==================== 人工接管 ====================

  /** 接管开始：绑定一个页面（同一页既出画面也接输入），建立 CDP 会话 */
  private async startTakeover(state: ClientState): Promise<void> {
    if (state.takeoverPage) return;
    const acquired = await this.browserGateway.getBrowserPage();
    if (!acquired) {
      this.logger.warn(`接管未绑定页面（无可用实例） trace=${state.traceId}`);
      return;
    }
    state.takeoverPage = acquired;
    try {
      state.cdp = await acquired.page.context().newCDPSession(acquired.page);
    } catch (err: unknown) {
      this.logger.warn(`接管 CDP 会话创建失败 trace=${state.traceId}: ${errMessage(err)}`);
      state.cdp = undefined;
    }
  }

  /** 接管结束：解绑页面并归还实例（否则实例泄漏）、关闭 CDP 会话 */
  private async endTakeover(state: ClientState): Promise<void> {
    const pinned = state.takeoverPage;
    const cdp = state.cdp;
    state.takeoverPage = undefined;
    state.cdp = undefined;
    if (cdp) {
      try {
        await cdp.detach();
      } catch {
        /* ignore */
      }
    }
    if (pinned) {
      try {
        this.browserGateway.releaseBrowserPage(pinned.instanceId, pinned.page);
      } catch (err: unknown) {
        this.logger.warn(`接管页面归还失败 trace=${state.traceId}: ${errMessage(err)}`);
      }
    }
  }

  /**
   * 接管输入转发（仅 takeover 期间生效，静默忽略其它情况）：
   * 通过 CDP Input.* 把前端鼠标/键盘/滚轮事件注入接管页，实现真正的人在环操作。
   * 所有坐标/文本均做范围与长度限制，避免畸形载荷。
   */
  private async handleInput(ws: WebSocket, state: ClientState, event: unknown): Promise<void> {
    if (!state.takeover || !state.takeoverPage || !state.cdp) return;
    const cdp = state.cdp;
    const evt = (event && typeof event === 'object' ? event : {}) as Record<string, unknown>;
    const kind = String(evt.kind ?? '');
    try {
      if (kind === 'mouse') await this.dispatchMouse(cdp, evt);
      else if (kind === 'wheel') await this.dispatchWheel(cdp, evt);
      else if (kind === 'key') await this.dispatchKey(cdp, evt);
      else if (kind === 'text') await this.dispatchText(cdp, evt);
      else return;
    } catch (err: unknown) {
      this.logger.warn(`接管输入转发失败 trace=${state.traceId}: ${errMessage(err)}`);
      return;
    }

    // 离散操作后即时刷新画面（节流 250ms，避免高频事件把截图打满）
    if (Date.now() - (state.lastFrameAt || 0) > 250) {
      await this.captureAndSendFrame(ws, state, state.takeoverPage.page).catch(() => undefined);
    }
  }

  private static readPoint(evt: Record<string, unknown>): { x: number; y: number } {
    const clamp = (v: unknown, max: number) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.min(Math.max(Math.round(n), 0), max) : 0;
    };
    return { x: clamp(evt.x, 4096), y: clamp(evt.y, 4096) };
  }

  private static readModifiers(evt: Record<string, unknown>): number {
    const n = Number(evt.modifiers);
    return Number.isFinite(n) ? Math.max(0, Math.min(Math.round(n), 15)) : 0;
  }

  private static readButtons(evt: Record<string, unknown>): number {
    const n = Number(evt.buttons);
    return Number.isFinite(n) ? Math.max(0, Math.min(Math.round(n), 7)) : 0;
  }

  private async dispatchMouse(cdp: CDPSession, evt: Record<string, unknown>): Promise<void> {
    const action = String(evt.action ?? '');
    const type =
      action === 'down' ? 'mousePressed' : action === 'up' ? 'mouseReleased' : 'mouseMoved';
    const button: 'none' | 'left' | 'middle' | 'right' =
      evt.button === 'left' || evt.button === 'middle' || evt.button === 'right'
        ? evt.button
        : 'none';
    const clickCount = type === 'mouseMoved' ? 0 : Math.min(Math.max(Number(evt.clickCount) || 1, 1), 3);
    await cdp.send('Input.dispatchMouseEvent', {
      type,
      ...BrowserWsGateway.readPoint(evt),
      button,
      buttons: BrowserWsGateway.readButtons(evt),
      clickCount,
      modifiers: BrowserWsGateway.readModifiers(evt),
    });
  }

  private async dispatchWheel(cdp: CDPSession, evt: Record<string, unknown>): Promise<void> {
    const num = (v: unknown) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.max(-5000, Math.min(Math.round(n), 5000)) : 0;
    };
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseWheel',
      ...BrowserWsGateway.readPoint(evt),
      deltaX: num(evt.deltaX),
      deltaY: num(evt.deltaY),
      modifiers: BrowserWsGateway.readModifiers(evt),
    });
  }

  private async dispatchKey(cdp: CDPSession, evt: Record<string, unknown>): Promise<void> {
    const action = String(evt.action ?? '');
    if (action !== 'down' && action !== 'up') return;
    const key = String(evt.key ?? '').slice(0, 32);
    const code = String(evt.code ?? '').slice(0, 32);
    const rawText = action === 'down' ? String(evt.text ?? '').slice(0, 16) : '';
    const keyCodeNum = Number(evt.keyCode);
    const keyCode = Number.isFinite(keyCodeNum) ? Math.min(Math.max(Math.round(keyCodeNum), 0), 255) : 0;
    const printable = rawText.length > 0;

    await cdp.send('Input.dispatchKeyEvent', {
      // 可打印字符用 keyDown（带 text），功能键用 rawKeyDown，保证页面 keydown 处理器均能收到
      type: action === 'up' ? 'keyUp' : printable ? 'keyDown' : 'rawKeyDown',
      key,
      code,
      text: rawText,
      unmodifiedText: rawText,
      windowsVirtualKeyCode: keyCode,
      nativeVirtualKeyCode: keyCode,
      modifiers: BrowserWsGateway.readModifiers(evt),
    });
  }

  private async dispatchText(cdp: CDPSession, evt: Record<string, unknown>): Promise<void> {
    const text = String(evt.text ?? '').slice(0, 200);
    if (!text) return;
    await cdp.send('Input.insertText', { text });
  }

  // ==================== execute ====================

  private async handleExecute(ws: WebSocket, state: ClientState, payload: string): Promise<void> {    if (state.takeover) {
      await this.sendTaskResult(ws, false, '人工接管中，AI 指令已拒绝（请先交还控制权）');
      return;
    }
    if (state.running) {
      await this.sendTaskResult(ws, false, '已有指令正在执行，请等待完成');
      return;
    }
    if (!payload || !payload.trim()) {
      await this.sendTaskResult(ws, false, '指令不能为空');
      return;
    }

    // 解析指令（失败也回 taskResult，前端据此结束 loading）
    let instruction: Instruction;
    try {
      instruction = parseInstruction(payload);
    } catch (err: unknown) {
      await this.sendTaskResult(ws, false, errMessage(err) || '指令解析失败');
      return;
    }

    // 安全校验（SSRF + 注入）：指令中的 URL / 选择器 / 载荷须通过守卫后才允许执行
    const guard = await this.validateInstruction(instruction);
    if (!guard.ok) {
      this.logger.warn(`指令被安全守卫拒绝 trace=${state.traceId}: ${guard.reason}`);
      await this.sendTaskResult(ws, false, guard.reason);
      return;
    }

    state.running = true;
    await this.send(ws, {
      type: 'status',
      payload: { ...this.buildStatusPayload(state), status: 'running' },
    });

    try {
      const result = await this.browserGateway.executeSequence([instruction], {
        onRetry: (attempt) => {
          this.send(ws, { type: 'retry', payload: { attempt } }).catch(() => undefined);
        },
      });
      await this.deliverExecuteResult(ws, state, instruction, result);
    } finally {
      state.running = false;
      await this.sendStatus(ws, state).catch(() => undefined);
    }
  }

  /** 执行结果投递：回填页面地址/标题 → 推截图 → 回 taskResult → 审计 */
  private async deliverExecuteResult(
    ws: WebSocket,
    state: ClientState,
    instruction: Instruction,
    result: Awaited<ReturnType<BrowserGateway['executeSequence']>>,
  ): Promise<void> {
    if (result.url) state.lastUrl = result.url;
    if (result.title) state.lastTitle = result.title;

    // 截图结果单独推送给前端刷新画面
    if (result.screenshot) {
      await this.send(ws, { type: 'screenshot', payload: result.screenshot });
    }

    await this.sendTaskResult(ws, result.success, result.error, result.duration, result.retryCount);

    await this.auditService.record({
      action: `browser_ws_execute_${instruction.type}_${result.success ? 'ok' : 'fail'}`,
      module: 'browser-workbench',
      resource: `ws:${state.traceId}`,
      traceId: state.traceId,
    });
  }

  // ==================== 安全守卫 ====================

  /**
   * 指令安全校验：危险模式拦截（input-validator） + 导航目标 SSRF 拦截（url-guard）。
   * 之前 input-validator 已存在但从未被调用，等于校验器形同虚设；此处真正接入。
   */
  private async validateInstruction(instruction: { type: string; payload: string }): Promise<{
    ok: boolean;
    reason?: string;
  }> {
    const input = BrowserWsGateway.parseInstructionInput(instruction);
    if (input.ssrReason) return { ok: false, reason: input.ssrReason };

    const { valid, errors, cleanValidation } = validateBrowserOperation(input.validation);
    if (!valid) {
      return { ok: false, reason: `指令未通过安全校验：${errors.join('；')}` };
    }
    // DNS 级校验（fail-closed）：拦截域名解析到内网 / DNS rebinding，
    // 仅靠同步字面量检查无法防住 nip.io 等泛解析绕过
    if (input.validation.url) {
      const dnsGuarded = await checkUrl(input.validation.url);
      if (!dnsGuarded.ok) {
        return { ok: false, reason: `导航目标被拒绝：${dnsGuarded.reason}` };
      }
    }
    BrowserWsGateway.applyCleanedPayload(instruction, cleanValidation);
    return { ok: true };
  }

  /** 按指令类型拆解校验入参；SSRF 检查（字面量 + DNS，fail-closed）统一在 validateInstruction 内完成 */
  private static parseInstructionInput(instruction: { type: string; payload: string }): {
    validation: BrowserOperationValidation;
    ssrReason?: string;
  } {
    const validation: BrowserOperationValidation = {};
    if (instruction.type === 'navigate') {
      const url = instruction.payload.replace(/^navigate\s+/i, '').trim();
      validation.url = url;
    } else if (instruction.type === 'click') {
      validation.selector = instruction.payload.replace(/^click\s+/i, '').trim();
    } else if (instruction.type === 'input') {
      const spec = instruction.payload.replace(/^input\s+/i, '');
      const idx = spec.indexOf(':');
      validation.selector = idx >= 0 ? spec.slice(0, idx).trim() : spec;
      validation.text = idx >= 0 ? spec.slice(idx + 1).trim() : '';
    }
    return { validation };
  }

  /** 用清洗后的值回写 payload，避免下游执行原始（可能含危险片段）的载荷 */
  private static applyCleanedPayload(
    instruction: { type: string; payload: string },
    clean: BrowserOperationValidation,
  ): void {
    if (clean.url) {
      instruction.payload = `navigate ${clean.url}`;
      return;
    }
    if (!clean.selector) return;
    if (instruction.type === 'click') {
      instruction.payload = `click ${clean.selector}`;
    } else if (instruction.type === 'input') {
      instruction.payload = `input ${clean.selector}:${clean.text ?? ''}`;
    }
  }

  // ==================== 下行消息 ====================

  private async sendStatus(ws: WebSocket, state: ClientState): Promise<void> {
    await this.send(ws, { type: 'status', payload: this.buildStatusPayload(state) });
  }

  private buildStatusPayload(state: ClientState) {
    const gw = this.browserGateway.getStatus();
    return {
      status: state.running ? 'running' : 'connected',
      url: state.lastUrl,
      title: state.lastTitle,
      executor: gw.ready,
      poolCount: gw.poolStats.totalInstances,
      poolMax: gw.poolMax,
      circuit: gw.circuitBreakerState,
      platform: this.detectPlatform(state.lastUrl),
    };
  }

  private async sendTaskResult(
    ws: WebSocket,
    success: boolean,
    error?: string,
    duration?: number,
    retryCount?: number,
  ): Promise<void> {
    await this.send(ws, {
      type: 'taskResult',
      payload: { success, error, duration: duration || 0, retryCount: retryCount || 0 },
    });
  }

  private async send(ws: WebSocket, message: DownlinkMessage): Promise<void> {
    if (ws.readyState !== WebSocket.OPEN) return;
    await new Promise<void>((resolve) => {
      ws.send(JSON.stringify(message), (err) => {
        if (err) this.logger.warn(`WS send failed: ${err.message}`);
        resolve();
      });
    });
  }

  // ==================== 工具 ====================

  private detectPlatform(url?: string): string | undefined {
    if (!url) return undefined;
    if (url.includes('douyin.com')) return 'douyin';
    if (url.includes('xiaohongshu.com') || url.includes('xhslink.com')) return 'xiaohongshu';
    if (url.includes('weixin.qq.com') || url.includes('channels')) return 'video-number';
    return undefined;
  }
}
