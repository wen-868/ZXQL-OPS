<template>
  <div class="browser-workbench">
    <!-- 顶部：标题 + 状态指示器 -->
    <div class="browser-header">
      <div class="browser-title">
        <svg class="browser-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M4 4h16v16H4V4zm2 2v12h12V6H6zm2 2h8v2H8V8zm0 4h8v2H8v-2zm0 4h5v2H8v-2z"/>
        </svg>
        <span>浏览器工作台</span>
        <span class="status-badge" :class="statusClass">{{ statusText }}</span>
        <span class="mode-badge" :class="modeClass">{{ modeText }}</span>
      </div>
      <div class="browser-actions">
        <button
          @click="toggleLiveRefresh"
          :class="['btn-icon', 'live-btn', { active: liveRefresh }]"
          :title="liveRefresh ? '实时画面：开（点击暂停）' : '实时画面：关（点击开启）'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </button>
        <button @click="refresh" title="刷新" class="btn-icon" :disabled="isRunning">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
          </svg>
        </button>
        <button @click="capture" title="截图" class="btn-icon" :disabled="isRunning">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 15.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4zM9 2L7.17 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2h-3.17L15 2H9zm3 15a5 5 0 110-10 5 5 0 010 10z"/>
          </svg>
        </button>
        <button @click="toggleTakeover" :class="['btn-icon', 'takeover-btn', { active: isTakeover }]" :title="isTakeover ? '交还AI控制' : '人工接管'">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 4a2 2 0 110 4 2 2 0 010-4zm0 12c-2.33 0-4.31-1.46-5.11-3.5h10.22c-.8 2.04-2.78 3.5-5.11 3.5z"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- 路径栏：完整路径 + 导航历史 -->
    <div class="path-bar">
      <div class="nav-buttons">
        <button @click="goBack" class="nav-btn" title="后退" :disabled="historyIndex <= 0">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
        </button>
        <button @click="goForward" class="nav-btn" title="前进" :disabled="historyIndex >= navigationHistory.length - 1">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/>
          </svg>
        </button>
      </div>
      <div class="url-display" :class="{ 'loading': isRunning }">
        <span class="url-protocol">{{ urlProtocol }}</span>
        <span class="url-path">{{ urlPath }}</span>
      </div>
      <div class="breadcrumb" v-if="navigationHistory.length > 1">
        <span
          v-for="(item, index) in navigationHistory"
          :key="index"
          class="crumb"
          :class="{ active: index === historyIndex }"
          @click="navigateToHistory(index)"
          :title="item"
        >{{ shortenUrl(item) }}</span>
      </div>
    </div>

    <!-- 主体：浏览器画面（后端 headless 浏览器截图帧） -->
    <div class="browser-container">
      <img
        v-if="screenshotBase64"
        ref="frameEl"
        class="browser-frame"
        :class="{ 'takeover-input': isTakeover }"
        :src="`data:image/png;base64,${screenshotBase64}`"
        alt="浏览器实时画面"
        tabindex="0"
        draggable="false"
        @mousedown="onMouseDown"
        @mouseup="onMouseUp"
        @mousemove="onMouseMove"
        @wheel="onWheel"
        @contextmenu.prevent
        @keydown="onKeyDown"
        @keyup="onKeyUp"
        @paste="onPaste"
      />
      <div v-else class="browser-empty">
        <div class="browser-empty-title">正在获取画面…</div>
        <div class="browser-empty-hint">实时画面约每 2 秒刷新；也可执行 screenshot 指令或点击顶部「截图」</div>
      </div>
      <!-- AI 运行覆盖层 -->
      <div class="ai-overlay" v-if="isRunning && !isTakeover">
        <div class="ai-overlay-content">
          <div class="ai-spinner"></div>
          <div class="ai-overlay-text">AI 执行中: {{ currentInstruction || '处理中...' }}</div>
          <div class="ai-overlay-meta">已用 {{ executionElapsed }}ms</div>
        </div>
      </div>
      <!-- 人工接管标记 -->
      <div class="takeover-banner" v-if="isTakeover">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
        人工接管中 — 可直接在画面上点击/输入（先点一下画面聚焦键盘）
      </div>
    </div>

    <!-- 智能联动面板 -->
    <div class="smart-panel">
      <!-- 工作状态区 -->
      <div class="panel-section status-section">
        <div class="section-title">工作状态</div>
        <div class="status-grid">
          <div class="status-item" :class="workStateClass">
            <span class="status-label">当前状态</span>
            <span class="status-value">{{ workStateText }}</span>
          </div>
          <div class="status-item">
            <span class="status-label">当前指令</span>
            <span class="status-value mono">{{ currentInstruction || '-' }}</span>
          </div>
          <div class="status-item">
            <span class="status-label">重试次数</span>
            <span class="status-value">{{ retryCount }}/{{ maxRetries }}</span>
          </div>
          <div class="status-item">
            <span class="status-label">执行耗时</span>
            <span class="status-value">{{ executionElapsed }}ms</span>
          </div>
        </div>
      </div>

      <!-- 智能联动区 -->
      <div class="panel-section linkage-section">
        <div class="section-title">智能联动</div>
        <div class="linkage-grid">
          <div class="linkage-item" :class="{ ok: wsConnected, bad: !wsConnected }">
            <span class="linkage-dot"></span>
            <span class="linkage-label">WebSocket</span>
            <span class="linkage-value">{{ wsConnected ? '已连接' : '断开' }}</span>
          </div>
          <div class="linkage-item" :class="{ ok: executorReady, bad: !executorReady }">
            <span class="linkage-dot"></span>
            <span class="linkage-label">执行引擎</span>
            <span class="linkage-value">{{ executorReady ? '就绪' : '未就绪' }}</span>
          </div>
          <div class="linkage-item" :class="{ ok: poolAvailable, bad: !poolAvailable }">
            <span class="linkage-dot"></span>
            <span class="linkage-label">实例池</span>
            <span class="linkage-value">{{ poolInstanceCount }}/{{ poolMaxInstances }}</span>
          </div>
          <div class="linkage-item" :class="{ ok: circuitClosed, warn: !circuitClosed }">
            <span class="linkage-dot"></span>
            <span class="linkage-label">熔断器</span>
            <span class="linkage-value">{{ circuitState }}</span>
          </div>
          <div class="linkage-item" :class="{ ok: platformAdapter, warn: !platformAdapter }">
            <span class="linkage-dot"></span>
            <span class="linkage-label">平台适配</span>
            <span class="linkage-value">{{ currentPlatform }}</span>
          </div>
        </div>
      </div>

      <!-- 指令队列 -->
      <div class="panel-section queue-section">
        <div class="section-title">
          指令队列
          <span class="queue-count" v-if="commandQueue.length > 0">({{ commandQueue.length }})</span>
          <button class="btn-mini" @click="clearQueue" v-if="commandQueue.length > 0" :disabled="isRunning">清空</button>
        </div>
        <div class="queue-list" v-if="commandQueue.length > 0">
          <div
            v-for="(item, index) in commandQueue"
            :key="item.id"
            class="queue-item"
            :class="{ running: item.status === 'running', done: item.status === 'done', failed: item.status === 'failed', pending: item.status === 'pending' }"
          >
            <span class="queue-index">{{ index + 1 }}</span>
            <span class="queue-cmd mono">{{ item.command }}</span>
            <span class="queue-status">{{ statusIcon(item.status) }}</span>
            <span class="queue-duration" v-if="item.duration">{{ item.duration }}ms</span>
          </div>
        </div>
        <div class="queue-empty" v-else>暂无排队指令</div>
      </div>
    </div>

    <!-- 底部：命令输入 -->
    <div class="browser-bottom">
      <div class="browser-commands">
        <input
          v-model="command"
          @keydown.enter="executeCommand"
          placeholder="输入指令 (navigate URL / click SELECTOR / input SELECTOR:TEXT / wait MS / screenshot)"
          :disabled="isRunning && !isTakeover"
        />
        <button @click="executeCommand" :disabled="(!command.length) || (isRunning && !isTakeover)" :class="{ running: isRunning }">
          {{ isRunning ? '执行中...' : '执行' }}
        </button>
        <button class="btn-queue" @click="addToQueue" :disabled="!command.length || isRunning" title="加入队列">
          排队
        </button>
      </div>
      <div class="browser-info">
        <span class="info-label">路径:</span><span class="mono info-value">{{ currentUrl || '-' }}</span>
        <span class="info-label">标题:</span><span class="info-value">{{ pageTitle || '-' }}</span>
        <span class="info-label">运行:</span><span class="info-value">{{ totalExecuted }} 条</span>
        <span class="info-label">成功:</span><span class="info-value success">{{ successCount }}</span>
        <span class="info-label">失败:</span><span class="info-value error">{{ failCount }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, reactive } from 'vue';
import { useAppStore } from '@/stores/app';

// ========== 连接状态 ==========
const ws = ref(null);
const wsConnected = ref(false);
const isRunning = ref(false);
const isTakeover = ref(false);
// 实时画面：定时向后端拉帧（后端 frame 通道，不影响指令执行与统计）
const liveRefresh = ref(true);
const FRAME_INTERVAL_MS = 2000;
let pageId = Date.now();
let executionTimer = null;
let elapsedTimer = null;
let frameTimer = null;
let framePending = false;

// ========== 页面状态 ==========
const statusText = ref('未连接');
const statusClass = ref('status-offline');
const currentUrl = ref('');
const pageTitle = ref('');
const command = ref('');
const screenshotBase64 = ref('');
const frameEl = ref(null);

// 服务端浏览器视口（browser-pool newContext 固定为 1920×1080）
const VIEWPORT_W = 1920;
const VIEWPORT_H = 1080;
let lastMoveAt = 0;
let pressedButtons = 0;

// ========== 完整路径与导航历史 ==========
const navigationHistory = ref([]);
const historyIndex = ref(-1);

const urlProtocol = computed(() => {
  if (!currentUrl.value) return '';
  try {
    return new URL(currentUrl.value).protocol;
  } catch { return ''; }
});

const urlPath = computed(() => {
  if (!currentUrl.value) return 'about:blank';
  try {
    const u = new URL(currentUrl.value);
    return u.host + u.pathname + u.search;
  } catch { return currentUrl.value; }
});

function shortenUrl(url) {
  try {
    const u = new URL(url);
    return u.pathname === '/' ? u.hostname : u.pathname;
  } catch { return url.substring(0, 20); }
}

function pushHistory(url) {
  if (!url) return;
  if (navigationHistory.value[historyIndex.value] === url) return;
  // 截断前进历史
  navigationHistory.value = navigationHistory.value.slice(0, historyIndex.value + 1);
  navigationHistory.value.push(url);
  historyIndex.value = navigationHistory.value.length - 1;
  // 限制历史长度
  if (navigationHistory.value.length > 50) {
    navigationHistory.value.shift();
    historyIndex.value--;
  }
}

function goBack() {
  if (historyIndex.value > 0) {
    historyIndex.value--;
    const url = navigationHistory.value[historyIndex.value];
    currentUrl.value = url;
    sendToBackend({ type: 'execute', payload: `navigate ${url}`, pageId });
  }
}

function goForward() {
  if (historyIndex.value < navigationHistory.value.length - 1) {
    historyIndex.value++;
    const url = navigationHistory.value[historyIndex.value];
    currentUrl.value = url;
    sendToBackend({ type: 'execute', payload: `navigate ${url}`, pageId });
  }
}

function navigateToHistory(index) {
  historyIndex.value = index;
  const url = navigationHistory.value[index];
  currentUrl.value = url;
  sendToBackend({ type: 'execute', payload: `navigate ${url}`, pageId });
}

// ========== 工作状态 ==========
const workState = ref('idle'); // idle | running | paused | error | completed | takeover
const currentInstruction = ref('');
const retryCount = ref(0);
const maxRetries = ref(3);
const executionElapsed = ref(0);
const totalExecuted = ref(0);
const successCount = ref(0);
const failCount = ref(0);

const workStateText = computed(() => {
  const map = {
    idle: '空闲',
    running: 'AI 执行中',
    paused: '已暂停',
    error: '执行出错',
    completed: '已完成',
    takeover: '人工接管',
  };
  return map[workState.value] || workState.value;
});

const workStateClass = computed(() => `state-${workState.value}`);

const modeText = computed(() => (isTakeover.value ? '人工模式' : 'AI模式'));
const modeClass = computed(() => (isTakeover.value ? 'mode-manual' : 'mode-ai'));

// ========== 智能联动状态 ==========
const executorReady = ref(false);
const poolAvailable = ref(true);
const poolInstanceCount = ref(0);
const poolMaxInstances = ref(5);
const circuitState = ref('正常');
const circuitClosed = computed(() => circuitState.value === '正常');
const currentPlatform = ref('未适配');
const platformAdapter = computed(() => currentPlatform.value !== '未适配');

// ========== 指令队列 ==========
let queueIdCounter = 0;
const commandQueue = reactive([]);

function addToQueue() {
  if (!command.value.trim()) return;
  commandQueue.push({
    id: ++queueIdCounter,
    command: command.value.trim(),
    status: 'pending',
    duration: null,
  });
  command.value = '';
  processQueue();
}

function clearQueue() {
  commandQueue.splice(0, commandQueue.length);
}

async function processQueue() {
  if (isRunning.value) return;
  const next = commandQueue.find((q) => q.status === 'pending');
  if (!next) return;
  next.status = 'running';
  await runInstruction(next.command, next);
}

function statusIcon(status) {
  const map = { pending: '⏳', running: '⚡', done: '✅', failed: '❌' };
  return map[status] || '·';
}

// ========== 指令执行 ==========
async function runInstruction(cmd, queueItem = null) {
  isRunning.value = true;
  workState.value = 'running';
  currentInstruction.value = cmd;
  executionElapsed.value = 0;
  retryCount.value = 0;

  const startTime = Date.now();
  executionTimer = setInterval(() => {
    executionElapsed.value = Date.now() - startTime;
  }, 100);

  try {
    await sendToBackend({ type: 'execute', payload: cmd, pageId });
    // 结果通过 handleMessage 异步返回
  } catch {
    workState.value = 'error';
    if (queueItem) {
      queueItem.status = 'failed';
      queueItem.duration = Date.now() - startTime;
    }
    failCount.value++;
    isRunning.value = false;
    clearInterval(executionTimer);
  }

  // 记录历史 (如果是导航指令)
  if (cmd.startsWith('navigate ') || cmd.startsWith('go ')) {
    const url = cmd.replace(/^(navigate|go)\s+/i, '').trim();
    currentUrl.value = url;
    pushHistory(url);
  }
}

const executeCommand = async (e) => {
  if (e) e.preventDefault();
  if (!command.value.trim() || isRunning.value || isTakeover.value) return;
  const cmd = command.value.trim();
  command.value = '';
  await runInstruction(cmd);
};

// ========== 人工接管 ==========
function toggleTakeover() {
  isTakeover.value = !isTakeover.value;
  pressedButtons = 0;
  if (isTakeover.value) {
    workState.value = 'takeover';
    isRunning.value = false;
    sendToBackend({ type: 'takeover', pageId });
    // 让画面获得焦点，接管后可直接用键盘
    setTimeout(() => frameEl.value?.focus(), 0);
  } else {
    workState.value = 'idle';
    sendToBackend({ type: 'resume', pageId });
  }
}

// ========== 操作按钮 ==========
function refresh() {
  sendToBackend({ type: 'execute', payload: 'screenshot', pageId });
}

function capture() {
  sendToBackend({ type: 'execute', payload: 'screenshot', pageId });
}

/** 实时画面开关 */
function toggleLiveRefresh() {
  liveRefresh.value = !liveRefresh.value;
  if (liveRefresh.value) requestFrame();
}

/** 拉取一帧实时画面：未连接/执行中/上一帧未回时跳过（后端亦会二次拦截） */
function requestFrame() {
  if (!liveRefresh.value || !wsConnected.value || isRunning.value) return;
  if (framePending) return;
  framePending = true;
  // 后端在指令执行中会静默跳过（不回消息），超时解锁避免永久挂起
  setTimeout(() => { framePending = false; }, FRAME_INTERVAL_MS * 2);
  sendToBackend({ type: 'frame', pageId }).catch(() => { framePending = false; });
}

// ========== 人工接管：输入转发（画面 → 服务端浏览器） ==========
/** 屏幕坐标 → 服务端视口坐标（img 用 object-fit: contain，需按比例换算并扣除留白） */
function mapPointToViewport(clientX, clientY) {
  const el = frameEl.value;
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  const scale = Math.min(rect.width / VIEWPORT_W, rect.height / VIEWPORT_H);
  if (!scale) return null;
  const drawW = VIEWPORT_W * scale;
  const drawH = VIEWPORT_H * scale;
  const offX = rect.left + (rect.width - drawW) / 2;
  const offY = rect.top + (rect.height - drawH) / 2;
  const x = Math.round((clientX - offX) / scale);
  const y = Math.round((clientY - offY) / scale);
  if (x < 0 || y < 0 || x > VIEWPORT_W || y > VIEWPORT_H) return null;
  return { x, y };
}

function sendInput(event) {
  if (!isTakeover.value) return;
  sendToBackend({ type: 'input', pageId, event }).catch(() => {});
}

function modifierMask(e) {
  return (e.altKey ? 1 : 0) | (e.ctrlKey ? 2 : 0) | (e.metaKey ? 4 : 0) | (e.shiftKey ? 8 : 0);
}

const BUTTON_NAME = { 0: 'left', 1: 'middle', 2: 'right' };
const BUTTON_BIT = { 0: 1, 1: 4, 2: 2 };

function onMouseDown(e) {
  if (!isTakeover.value) return;
  e.preventDefault();
  frameEl.value?.focus();
  const p = mapPointToViewport(e.clientX, e.clientY);
  if (!p) return;
  pressedButtons |= BUTTON_BIT[e.button] || 1;
  sendInput({ kind: 'mouse', action: 'down', ...p, button: BUTTON_NAME[e.button] || 'left', buttons: pressedButtons, clickCount: 1, modifiers: modifierMask(e) });
}

function onMouseUp(e) {
  if (!isTakeover.value) return;
  e.preventDefault();
  const p = mapPointToViewport(e.clientX, e.clientY);
  if (!p) return;
  pressedButtons &= ~(BUTTON_BIT[e.button] || 1);
  sendInput({ kind: 'mouse', action: 'up', ...p, button: BUTTON_NAME[e.button] || 'left', buttons: pressedButtons, clickCount: 1, modifiers: modifierMask(e) });
}

function onMouseMove(e) {
  if (!isTakeover.value) return;
  const now = Date.now();
  if (now - lastMoveAt < 60) return;
  lastMoveAt = now;
  const p = mapPointToViewport(e.clientX, e.clientY);
  if (!p) return;
  sendInput({ kind: 'mouse', action: 'move', ...p, button: 'none', buttons: pressedButtons, modifiers: modifierMask(e) });
}

function onWheel(e) {
  if (!isTakeover.value) return;
  e.preventDefault();
  const p = mapPointToViewport(e.clientX, e.clientY);
  if (!p) return;
  sendInput({ kind: 'wheel', ...p, deltaX: Math.round(e.deltaX), deltaY: Math.round(e.deltaY), modifiers: modifierMask(e) });
}

function onKeyDown(e) {
  if (!isTakeover.value) return;
  // 交给后端/页面处理，避免空格滚动、退格回退等宿主行为
  e.preventDefault();
  const printable = e.key.length === 1 && !e.ctrlKey && !e.metaKey;
  sendInput({
    kind: 'key',
    action: 'down',
    key: e.key,
    code: e.code,
    keyCode: e.keyCode || 0,
    text: printable ? e.key : '',
    modifiers: modifierMask(e),
  });
}

function onKeyUp(e) {
  if (!isTakeover.value) return;
  e.preventDefault();
  sendInput({
    kind: 'key',
    action: 'up',
    key: e.key,
    code: e.code,
    keyCode: e.keyCode || 0,
    text: '',
    modifiers: modifierMask(e),
  });
}

function onPaste(e) {
  if (!isTakeover.value) return;
  e.preventDefault();
  const text = e.clipboardData?.getData('text') || '';
  if (text) sendInput({ kind: 'text', text: text.slice(0, 200) });
}

// ========== WebSocket ==========
// WS 基地址：优先显式 VITE_WS_URL；默认走同源 /api（dev 经 vite ws 代理转发 3100，生产经 nginx 反代）
function wsBase() {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return proto + '://' + location.host + '/api';
}

function sendToBackend(message) {
  return new Promise((resolve, reject) => {
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify(message));
      resolve();
    } else {
      reject(new Error('WebSocket 未连接'));
    }
  });
}

/** status 消息：状态文案 + 联动字段（数据驱动赋值，避免逐字段分支） */
function applyStatus(payload) {
  statusText.value = payload.status;
  statusClass.value = {
    connected: 'status-online',
    running: 'status-running',
    disconnected: 'status-offline',
  }[payload.status] || 'status-offline';
  if (payload.url && payload.url !== currentUrl.value) {
    currentUrl.value = payload.url;
    pushHistory(payload.url);
  }
  if (payload.title) pageTitle.value = payload.title;
  const links = {
    executor: executorReady,
    poolCount: poolInstanceCount,
    poolMax: poolMaxInstances,
    circuit: circuitState,
    platform: currentPlatform,
  };
  for (const [key, ref] of Object.entries(links)) {
    if (payload[key] !== undefined) ref.value = payload[key];
  }
}

/** taskResult 消息：收尾计数 + 队列项落定 + 触发下一条 */
function applyTaskResult(payload) {
  isRunning.value = false;
  clearInterval(executionTimer);
  const duration = payload.duration || executionElapsed.value;
  totalExecuted.value++;

  if (payload.success) {
    successCount.value++;
    workState.value = 'completed';
  } else {
    failCount.value++;
    workState.value = 'error';
  }

  const running = commandQueue.find((q) => q.status === 'running');
  if (running) {
    running.status = payload.success ? 'done' : 'failed';
    running.duration = duration;
  }

  currentInstruction.value = '';
  // 指令结束后立即刷新画面，避免等下一个轮询周期
  requestFrame();
  setTimeout(() => processQueue(), 300);
}

/** 后端下行消息分发（各分支拆分为独立函数，控制复杂度） */
function handleMessage(data) {
  switch (data.type) {
    case 'screenshot':
      screenshotBase64.value = data.payload;
      break;
    case 'frame':
      framePending = false;
      screenshotBase64.value = data.payload;
      break;
    case 'status':
      applyStatus(data.payload);
      break;
    case 'taskResult':
      applyTaskResult(data.payload);
      break;
    case 'retry':
      retryCount.value = data.payload.attempt || 0;
      break;
  }
}

// ========== 生命周期 ==========
onMounted(() => {
  const tenantId = useAppStore().tenantId;
  // 携带 JWT：浏览器 WebSocket 无法自定义 header，走 query（后端 upgrade 阶段验签，
  // 租户一律从 token 解析，不接受 ?tenant= 覆盖）
  const token = localStorage.getItem('ops_token') || ''
  ws.value = new WebSocket(
    `${wsBase()}/browser?tenant=${encodeURIComponent(tenantId)}&token=${encodeURIComponent(token)}`
  )

  ws.value.onopen = () => {
    wsConnected.value = true;
    statusText.value = '已连接';
    statusClass.value = 'status-online';
    // 请求初始状态
    sendToBackend({ type: 'status', pageId }).catch(() => {});
  };

  ws.value.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleMessage(data);
    } catch {
      // 非 JSON 下行消息：忽略，避免脏数据打断会话
    }
  };

  ws.value.onclose = () => {
    wsConnected.value = false;
    framePending = false;
    statusText.value = '连接断开';
    statusClass.value = 'status-offline';
    executorReady.value = false;
  };

  // 定时状态轮询 (5秒)
  elapsedTimer = setInterval(() => {
    if (wsConnected.value) {
      sendToBackend({ type: 'status', pageId }).catch(() => {});
    }
  }, 5000);

  // 实时画面拉帧
  frameTimer = setInterval(requestFrame, FRAME_INTERVAL_MS);
});

onUnmounted(() => {
  clearInterval(executionTimer);
  clearInterval(elapsedTimer);
  clearInterval(frameTimer);
  if (ws.value) ws.value.close();
});
</script>

<style scoped>
.browser-workbench {
  height: 100%;
  width: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  display: flex;
  flex-direction: column;
  background: #f0f2f5;
}

/* ===== 顶部头部 ===== */
.browser-header {
  height: 44px;
  background: #1a1a2e;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  flex-shrink: 0;
}

.browser-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
}

.browser-icon { color: #4fc3f7; }

.status-badge {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}
.status-online { background: #2e7d32; color: #fff; }
.status-running { background: #ff9800; color: #fff; }
.status-offline { background: #c62828; color: #fff; }

.mode-badge {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}
.mode-ai { background: #1565c0; color: #fff; }
.mode-manual { background: #6a1b9a; color: #fff; }

.browser-actions { display: flex; gap: 6px; }

.btn-icon {
  width: 30px;
  height: 30px;
  background: rgba(255,255,255,0.1);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: #ccc;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.btn-icon:hover { background: rgba(255,255,255,0.2); color: #fff; }
.btn-icon:disabled { opacity: 0.4; cursor: not-allowed; }
.takeover-btn.active { background: #6a1b9a; color: #fff; }
.live-btn.active { background: #2e7d32; color: #fff; }

/* ===== 路径栏 ===== */
.path-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: #fff;
  border-bottom: 1px solid #e0e0e0;
  flex-shrink: 0;
}

.nav-buttons { display: flex; gap: 2px; }
.nav-btn {
  width: 26px;
  height: 26px;
  background: none;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: #666;
  display: flex;
  align-items: center;
  justify-content: center;
}
.nav-btn:hover:not(:disabled) { background: #e8e8e8; }
.nav-btn:disabled { opacity: 0.3; cursor: default; }

.url-display {
  flex: 1;
  padding: 5px 12px;
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  font-size: 13px;
  display: flex;
  gap: 2px;
  overflow: hidden;
  white-space: nowrap;
  min-width: 200px;
}
.url-display.loading { border-color: #ff9800; }
.url-protocol { color: #2e7d32; font-weight: 600; }
.url-path { color: #333; overflow: hidden; text-overflow: ellipsis; }

.breadcrumb {
  display: flex;
  gap: 4px;
  font-size: 11px;
  max-width: 300px;
  overflow: hidden;
}
.crumb {
  padding: 2px 6px;
  background: #e3f2fd;
  border-radius: 3px;
  color: #1565c0;
  cursor: pointer;
  white-space: nowrap;
}
.crumb:hover { background: #bbdefb; }
.crumb.active { background: #1565c0; color: #fff; }

/* ===== 浏览器主体 ===== */
.browser-container {
  flex: 1;
  position: relative;
  background: #fff;
  min-height: 200px;
}

.browser-frame {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #111;
}

.browser-frame.takeover-input {
  cursor: crosshair;
  outline: 2px solid #6a1b9a;
  outline-offset: -2px;
}

.browser-empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: #999;
  background: #fafafa;
}

.browser-empty-title { font-size: 14px; font-weight: 600; color: #666; }
.browser-empty-hint { font-size: 12px; }

.ai-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.ai-overlay-content {
  text-align: center;
  color: #fff;
}

.ai-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(255,255,255,0.3);
  border-top: 4px solid #4fc3f7;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 12px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.ai-overlay-text { font-size: 14px; font-weight: 500; }
.ai-overlay-meta { font-size: 12px; color: #aaa; margin-top: 4px; }

.takeover-banner {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  background: #6a1b9a;
  color: #fff;
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  z-index: 10;
  box-shadow: 0 2px 8px rgba(106, 27, 154, 0.4);
}

/* ===== 智能联动面板 ===== */
.smart-panel {
  display: flex;
  gap: 1px;
  background: #e0e0e0;
  border-top: 1px solid #ccc;
  flex-shrink: 0;
}

.panel-section {
  background: #fff;
  padding: 8px 12px;
  flex: 1;
  min-width: 0;
}

.panel-section.queue-section { flex: 1.5; }

.section-title {
  font-size: 11px;
  font-weight: 700;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.queue-count { color: #1565c0; font-weight: 600; }

.btn-mini {
  margin-left: auto;
  padding: 1px 6px;
  font-size: 10px;
  background: #eee;
  border: 1px solid #ccc;
  border-radius: 3px;
  cursor: pointer;
}
.btn-mini:hover:not(:disabled) { background: #ddd; }

/* 状态网格 */
.status-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.status-item {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.status-label { font-size: 10px; color: #999; }
.status-value { font-size: 12px; font-weight: 600; color: #333; }
.status-value.mono { font-family: monospace; font-size: 11px; }

.state-idle .status-value { color: #999; }
.state-running .status-value { color: #1565c0; }
.state-error .status-value { color: #c62828; }
.state-completed .status-value { color: #2e7d32; }
.state-takeover .status-value { color: #6a1b9a; }

/* 联动网格 */
.linkage-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.linkage-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  padding: 3px 8px;
  background: #f5f5f5;
  border-radius: 4px;
}

.linkage-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #999;
}
.linkage-item.ok .linkage-dot { background: #2e7d32; }
.linkage-item.bad .linkage-dot { background: #c62828; }
.linkage-item.warn .linkage-dot { background: #ff9800; }

.linkage-label { color: #666; }
.linkage-value { color: #333; font-weight: 600; }

/* 队列 */
.queue-list {
  max-height: 80px;
  overflow-y: auto;
}

.queue-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 4px;
  font-size: 12px;
  border-radius: 3px;
  margin-bottom: 2px;
}
.queue-item.pending { background: #f5f5f5; }
.queue-item.running { background: #e3f2fd; border-left: 3px solid #1565c0; }
.queue-item.done { background: #e8f5e9; }
.queue-item.failed { background: #ffebee; }

.queue-index {
  width: 18px;
  height: 18px;
  background: #e0e0e0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: #666;
  flex-shrink: 0;
}

.queue-cmd {
  flex: 1;
  font-family: monospace;
  font-size: 11px;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.queue-status { flex-shrink: 0; font-size: 12px; }
.queue-duration { font-size: 10px; color: #999; flex-shrink: 0; }
.queue-empty { font-size: 11px; color: #bbb; padding: 8px 0; }

/* ===== 底部命令栏 ===== */
.browser-bottom {
  padding: 8px 12px;
  background: #fff;
  border-top: 1px solid #e0e0e0;
  flex-shrink: 0;
}

.browser-commands {
  display: flex;
  gap: 6px;
  margin-bottom: 6px;
}

.browser-commands input {
  flex: 1;
  padding: 7px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  font-size: 13px;
  font-family: monospace;
  outline: none;
  transition: border-color 0.2s;
}
.browser-commands input:focus { border-color: #1565c0; }
.browser-commands input:disabled { background: #f5f5f5; }

.browser-commands button {
  padding: 0 16px;
  background: #1565c0;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.browser-commands button:hover:not(:disabled) { background: #0d47a1; }
.browser-commands button:disabled { opacity: 0.5; cursor: not-allowed; }
.browser-commands button.running { background: #ff9800; }

.browser-commands .btn-queue {
  background: #546e7a;
}
.browser-commands .btn-queue:hover:not(:disabled) { background: #37474f; }

.browser-info {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: #999;
  flex-wrap: wrap;
}
.info-label { color: #999; }
.info-value { color: #333; font-weight: 500; }
.info-value.mono { font-family: monospace; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.info-value.success { color: #2e7d32; }
.info-value.error { color: #c62828; }

.mono { font-family: monospace; }
</style>
