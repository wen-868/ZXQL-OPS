<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import { currentTenantId } from '@/utils/tenant'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  /** 页面观察截图（dataURL），有值则渲染成图片卡片 */
  image?: string
}

interface AgentSession {
  id: string
  title: string
  messages: ChatMessage[]
}

const input = ref('')
const sending = ref(false)
const listRef = ref<HTMLElement | null>(null)
const appStore = useAppStore()
const modelMenuOpen = ref(false)
const viewMenuOpen = ref(false)
const modelName = ref('')
// 模型清单来自后端白名单（GET /ops/ai-chat/models）；加载失败前禁用菜单避免展示不可用项
const models = ref<Array<{ name: string; desc: string }>>([])

async function loadModels() {
  try {
    const resp = await fetch('/api/ops/ai-chat/models', { headers: chatHeaders() })
    const json = (await resp.json()) as { code?: string; data?: { active?: string; list?: Array<{ name: string; desc: string }> } }
    if (json.code === '0' && json.data?.list?.length) {
      models.value = json.data.list
      modelName.value = json.data.active || json.data.list[0].name
    }
  } catch {
    // 后端不可用时保持空清单（模型按钮隐藏）
  }
}

// ===== 页面观察：给 AI 一条「看一眼当前页面」的能力（后端独立无头 Chromium 快照） =====
// 与后端系统提示词里的模块清单保持一致；AI 回复里 [[查看:页面名]] 或用户 @查看 xx 都会触发截图。
const VIEW_PAGES: Array<{ name: string; path: string }> = [
  { name: '运营总览', path: '/home' },
  { name: '账号矩阵', path: '/accounts' },
  { name: '市场情报', path: '/intel' },
  { name: '分析中心', path: '/analyze' },
  { name: '选题中心', path: '/topic' },
  { name: '脚本中心', path: '/script' },
  { name: '素材库', path: '/materials' },
  { name: '成片库', path: '/videos' },
  { name: '发布中心', path: '/publish' },
  { name: '工作流', path: '/workflows' },
  { name: '自动化', path: '/automation' },
  { name: '回收站', path: '/recycle' },
  { name: '选品', path: '/selection' },
  { name: '商品', path: '/products' },
  { name: '直播', path: '/live' },
  { name: '投流', path: '/ad' },
  { name: '私域', path: '/private' },
  { name: '对账', path: '/reconcile' },
  { name: '订单', path: '/orders' },
  { name: '客服', path: '/cs' },
  { name: '数据看板', path: '/dashboard' },
  { name: '个人中心', path: '/profile' },
]

/** 把「页面名/路径」模糊解析为可查看的目标页；解析不到返回 null */
function resolvePage(q: string): { name: string; path: string } | null {
  const s = (q || '').trim()
  if (!s) return null
  const asPath = s.startsWith('/') ? s : `/${s}`
  const byPath = VIEW_PAGES.find((p) => p.path === asPath)
  if (byPath) return byPath
  const byName = VIEW_PAGES.find((p) => p.name.includes(s) || s.includes(p.name))
  return byName ?? null
}

interface ViewResult {
  url: string
  title: string
  screenshot: string
  summary: Record<string, unknown>
}

/** 调后端浏览器快照：截图 + 关键 DOM 摘要 */
async function snapshotPage(page: { name: string; path: string }): Promise<ViewResult | null> {
  try {
    const resp = await fetch('/api/ops/browser/snapshot', {
      method: 'POST',
      headers: chatHeaders(),
      body: JSON.stringify({ path: page.path }),
    })
    const json = (await resp.json()) as { code?: string; data?: ViewResult | null }
    if (json.code === '0' && json.data?.screenshot) return json.data
  } catch {
    // 快照失败：静默，调用方降级提示
  }
  return null
}

/** 快照摘要 → 分段文案（数据驱动，避免逐字段分支堆叠） */
function summaryParts(res: ViewResult): string[] {
  const s = res.summary ?? {}
  const specs: Array<[unknown, (v: never) => string]> = [
    [(s.headings as string[] | undefined) ?? [], (v: string[]) => `标题：${v.join(' · ')}`],
    [(s.cards as string[] | undefined) ?? [], (v: string[]) => `关键数据：${v.join('；')}`],
    [
      (s.todos as string[] | undefined) ?? [],
      (v: string[]) => `待办：${v.join('；')}`,
    ],
  ]
  const parts = specs
    .map(([raw, fmt]) => [raw, fmt] as [unknown, (v: never) => string])
    .filter(([raw]) => Array.isArray(raw) && (raw as unknown[]).length > 0)
    .map(([raw, fmt]) => fmt(raw as never))
  const rows = (s.table as { rows?: number } | undefined)?.rows ?? 0
  if (rows > 0) parts.push(`表格 ${rows} 行`)
  return parts
}

function summaryLine(page: { name: string }, res: ViewResult): string {
  const parts = summaryParts(res)
  return `📷 我查看了「${page.name}」（${res.url}）。${parts.join('。') || '页面已就绪。'}`
}

/** 把「查看页面」结果以助手消息（图片 + 摘要）追加进对话 */
function appendViewMessage(page: { name: string; path: string }, res: ViewResult | null) {
  const list = currentSession().messages
  if (res) {
    list.push({ role: 'assistant', content: summaryLine(page, res), image: res.screenshot })
  } else {
    list.push({ role: 'assistant', content: `抱歉，页面观察暂不可用（后端浏览器未就绪）。你可以直接在右侧工作区查看「${page.name}」。` })
  }
  scrollBottom()
}

/** 工具钮 / 用户 @查看：解析目标页 → 快照 → 追加助手消息 */
async function viewPage(q: string) {
  const page = resolvePage(q)
  if (!page) {
    currentSession().messages.push({ role: 'assistant', content: `没找到「${q}」对应的页面。可查看：${VIEW_PAGES.map((p) => p.name).join('、')}。` })
    scrollBottom()
    return
  }
  const res = await snapshotPage(page)
  appendViewMessage(page, res)
}

/**
 * 用户消息是否为「查看页面」类确定性指令。
 * 命中则直连快照（不走 LLM），返回 true 表示已消费该消息。
 * 支持：`@查看 选题中心` / `查看素材库` / `看一下 /publish` / `截图`
 */
async function tryInlineView(text: string): Promise<boolean> {
  const s = text.trim()
  // 逐前缀精确匹配（不用可选分组正则，避免回溯与 ReDoS 风险）
  const prefixes = ['@查看', '查看', '看一下', '看看', '截图', '打开页面']
  const hit = prefixes.find((p) => s.startsWith(p))
  if (!hit) return false
  const target = s.slice(hit.length).trim() || '运营总览'
  // 仅在目标能解析到内置页面时才接管，否则交回 LLM 正常对话
  if (!resolvePage(target)) return false
  await viewPage(target)
  return true
}

/** 处理 AI 回复末尾的 [[查看:目标]] 标记：剥离标记并补一次页面快照 */
async function handleViewTag(_task: ChatTask) {
  const list = currentSession().messages
  const last = list[list.length - 1]
  if (!last || last.role !== 'assistant') return
  const m = last.content.match(/\[\[查看:([^\]]+)\]\]/)
  if (!m) return
  last.content = last.content.replace(/\[\[查看:[^\]]+\]\]/g, '').replace(/\n{2,}$/, '\n').trim()
  const page = resolvePage(m[1])
  if (!page) return
  const res = await snapshotPage(page)
  appendViewMessage(page, res)
}

const sessions = ref<AgentSession[]>([
  {
    id: 'main',
    title: '主会话',
    messages: [
      {
        role: 'assistant',
        content: '你好，我是运营 AI。告诉我任务，比如「给红星商行做条五粮液短视频挂车卖」，或直接用下方指令。',
      },
    ],
  },
])
const activeSessionId = ref('main')

function currentSession(): AgentSession {
  return sessions.value.find((s) => s.id === activeSessionId.value) ?? sessions.value[0]
}

const messages = computed(() => currentSession().messages)
const hasInput = computed(() => !!input.value.trim())

const speechSupported =
  typeof window !== 'undefined' &&
  !!((window as unknown as Record<string, unknown>).SpeechRecognition ||
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition)
const listening = ref(false)
let recognition: { stop: () => void } | null = null

const shortcuts = [
  { label: '@选题', prompt: '@选题 帮我生成一批选题，结合最近的爆款趋势' },
  { label: '@脚本', prompt: '@脚本 帮我把最新选题写成 60 秒口播脚本' },
  { label: '@直播中控', prompt: '@直播中控 帮我开一场直播并准备好中控' },
  { label: '@复盘', prompt: '@复盘 帮我把最近发布数据复盘并给出下期建议' },
]

function openWithPrompt(prompt?: string) {
  if (prompt) {
    input.value = prompt
    nextTick(() => send())
  }
}

watch(
  () => appStore.aiTask,
  (v) => {
    if (v) {
      input.value = v
      appStore.askAI('')
      nextTick(() => send())
    }
  },
)

function scrollBottom() {
  nextTick(() => {
    if (listRef.value) listRef.value.scrollTop = listRef.value.scrollHeight
  })
}

function switchSession(id: string) {
  activeSessionId.value = id
  scrollBottom()
}

function closeSession(id: string) {
  if (sessions.value.length <= 1) return
  sessions.value = sessions.value.filter((s) => s.id !== id)
  if (activeSessionId.value === id) {
    activeSessionId.value = sessions.value[sessions.value.length - 1].id
  }
}

function newSession() {
  let n = 1
  let title = '新任务'
  while (sessions.value.some((s) => s.title === title)) {
    n += 1
    title = `新任务 ${n}`
  }
  const s: AgentSession = { id: `t_${Date.now()}`, title, messages: [] }
  sessions.value.push(s)
  activeSessionId.value = s.id
  nextTick(() => document.getElementById('aiInput')?.focus())
}

function ensureSession(title: string) {
  let s = sessions.value.find((x) => x.title === title)
  if (!s) {
    s = { id: `t_${Date.now()}`, title, messages: [] }
    sessions.value.push(s)
  }
  activeSessionId.value = s.id
}

async function send() {
  const text = input.value.trim()
  if (!text || sending.value) return
  input.value = ''
  autoResize()
  const title = taskTitle(text)
  ensureSession(title)
  const task = appStore.addTask(title)
  currentSession().messages.push({ role: 'user', content: text })
  scrollBottom()

  // 用户指令 @查看 xx（确定性能力，直连快照，不走 LLM）
  if (await tryInlineView(text)) {
    task.status = 'pending_confirm'
    return
  }

  const history = currentSession().messages.slice(0, -1).slice(-10)
  sending.value = true

  try {
    const resp = await fetch('/api/ops/ai-chat/stream', {
      method: 'POST',
      headers: chatHeaders(),
      // model 传后端白名单内的所选模型；未加载到清单时由后端回落默认
      body: JSON.stringify({
        message: text,
        history: history.map((m) => ({ role: m.role, content: m.content })),
        ...(modelName.value ? { model: modelName.value } : {}),
      }),
    })
    if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`)
    await routeResponse(resp, task)
    // AI 回复末尾 [[查看:页面]] → 追加一次页面快照，供人工看图 + 后续对话带摘要
    await handleViewTag(task)
  } catch {
    currentSession().messages.push({
      role: 'assistant',
      content: '抱歉，AI 助手暂时不可用。请检查本地 LLM 服务是否已启动。',
    })
    task.status = 'pending_confirm'
  } finally {
    sending.value = false
    scrollBottom()
  }
}

function taskTitle(text: string): string {
  const t = text.replace(/^@/, '')
  return t.length > 14 ? `${t.slice(0, 14)}…` : t
}

function chatHeaders(): Record<string, string> {
  const token = localStorage.getItem('ops_token') || ''
  // 写请求必须带 CSRF 令牌（后端 CsrfGuard 校验；缺省会 403 CSRF_INVALID）
  const csrf = localStorage.getItem('ops_csrf') || ''
  return {
    'content-type': 'application/json',
    authorization: token ? `Bearer ${token}` : '',
    'x-csrf-token': csrf,
    tenantId: currentTenantId(),
  }
}

async function routeResponse(resp: Response, task: ChatTask) {
  const contentType = resp.headers.get('content-type') || ''
  if (contentType.includes('text/event-stream')) await streamChat(resp, task)
  else await jsonChat(resp, task)
}

interface ChatTask {
  stepIndex: number
  status: string
}

function parseSseData(line: string): Record<string, unknown> | null {
  if (!line.startsWith('data:')) return null
  try {
    return JSON.parse(line.slice(5).trim()) as Record<string, unknown>
  } catch {
    return null
  }
}

function flushAssistant(state: { assistantText: string }) {
  const list = currentSession().messages
  const last = list[list.length - 1]
  if (last && last.role === 'assistant') last.content = state.assistantText
  else list.push({ role: 'assistant', content: state.assistantText })
  scrollBottom()
}

function applyChatEvent(
  data: Record<string, unknown>,
  task: ChatTask,
  state: { assistantText: string },
): void {
  if (data.type === 'text' && typeof data.content === 'string') {
    state.assistantText += data.content
    flushAssistant(state)
  } else if (data.type === 'tool_start') {
    task.stepIndex = Math.min(task.stepIndex + 1, 5)
    task.status = 'running'
  } else if (data.type === 'tool_result') {
    task.stepIndex = Math.min(task.stepIndex + 1, 5)
  } else if (data.type === 'done') {
    // 回复完成 → 人工确认态：批准后由 TaskPanel 调真实后端自动化链
    task.status = 'pending_confirm'
  } else if (data.type === 'error') {
    task.status = 'pending_confirm'
    state.assistantText += typeof data.message === 'string' ? data.message : '（任务执行出错，请人工确认）'
    flushAssistant(state)
  }
}

async function streamChat(resp: Response, task: ChatTask) {
  const reader = resp.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const state: { assistantText: string } = { assistantText: '' }
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() || ''
    for (const part of parts) {
      for (const line of part.split('\n')) {
        const data = parseSseData(line)
        if (!data) continue
        applyChatEvent(data, task, state)
      }
    }
  }
  if (!state.assistantText) {
    currentSession().messages.push({ role: 'assistant', content: '（未收到流式回复）' })
  }
}

async function jsonChat(resp: Response, task: ChatTask) {
  const json = (await resp.json().catch(() => null)) as {
    code?: string
    data?: { reply?: string } | string | null
  } | null
  const payload = json?.code === '0' ? json.data : null
  const reply =
    (typeof payload === 'object' && payload?.reply) || (typeof payload === 'string' ? payload : '')
  currentSession().messages.push({
    role: 'assistant',
    content: reply || '（助手暂时无法回复，请稍后重试）',
  })
  // 回复后任务进入人工确认态：批准后由 TaskPanel 调真实后端自动化链
  task.status = 'pending_confirm'
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
  }
}

function useShortcut(prompt: string) {
  input.value = prompt
  send()
}

function startVoice() {
  if (!speechSupported || listening.value) return
  const w = window as unknown as Record<string, unknown>
  const SR = (w.SpeechRecognition || w.webkitSpeechRecognition) as (new () => unknown) | undefined
  if (!SR) return
  const sr = new SR() as {
    lang: string
    interimResults: boolean
    onresult: (e: { results: Array<Array<{ transcript: string }>> }) => void
    onend: () => void
    start: () => void
    stop: () => void
  }
  sr.lang = 'zh-CN'
  sr.interimResults = false
  sr.onresult = (e) => {
    input.value = e.results[0][0].transcript
    listening.value = false
    autoResize()
  }
  sr.onend = () => {
    listening.value = false
  }
  sr.start()
  recognition = sr
  listening.value = true
}

function stopVoice() {
  recognition?.stop()
  listening.value = false
}

function onCombo() {
  if (hasInput.value) send()
  else if (listening.value) stopVoice()
  else if (speechSupported) startVoice()
  else {
    currentSession().messages.push({
      role: 'assistant',
      content: '当前浏览器不支持语音输入，请直接输入任务。',
    })
    scrollBottom()
  }
}

function pickModel(name: string) {
  modelName.value = name
  modelMenuOpen.value = false
  currentSession().messages.push({ role: 'assistant', content: `已切换模型为 ${name}。` })
  scrollBottom()
}

function autoResize() {
  const t = document.getElementById('aiInput') as HTMLTextAreaElement | null
  if (!t) return
  // 空内容固定单行（占位文案较长会折行，不能按 scrollHeight 撑高）
  const singleLine = Math.ceil(14 * 1.6) + 28
  if (!t.value) {
    t.style.height = `${singleLine}px`
    return
  }
  t.style.height = 'auto'
  t.style.height = `${Math.min(Math.max(t.scrollHeight, singleLine), 200)}px`
}

function onDocClick(e: MouseEvent) {
  const t = e.target as HTMLElement
  if (!t.closest('.ai-modelbar')) {
    modelMenuOpen.value = false
    viewMenuOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  void loadModels()
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  recognition?.stop()
})

defineExpose({ openWithPrompt })
</script>

<template>
  <aside class="ai-chat-root" aria-label="运营 AI 对话区">
    <div class="ai-head">
      <button
        class="ai-side-toggle"
        type="button"
        :title="appStore.sidebarCollapsed ? '展开侧栏' : '收起侧栏'"
        @click="appStore.toggleSidebar()"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /><path d="M6 9l-2 2 2 2" /></svg>
      </button>
      <span class="spark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.9 5.6L19.5 9l-5.6 1.9L12 16l-1.9-5.1L4.5 9l5.6-1.4L12 2z" /><path d="M19 14l.9 2.6L22.5 17l-2.6.9L19 20l-.9-2.1L15.5 17l2.6-.4L19 14z" /></svg>
      </span>
      <div class="ai-tasktabs">
        <button
          v-for="s in sessions"
          :key="s.id"
          type="button"
          class="atab"
          :class="{ active: s.id === activeSessionId }"
          @click="switchSession(s.id)"
        >
          <span>{{ s.title }}</span>
          <span v-if="sessions.length > 1" class="x" @click.stop="closeSession(s.id)">✕</span>
        </button>
      </div>
      <button class="ai-add" type="button" title="新建任务" @click="newSession">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
      </button>
      <!-- 工作区收起时，展开按钮移入 AI 头（原型 wsDockToggle 按钮随状态迁移） -->
      <button
        v-if="!appStore.workspaceOpen"
        class="ai-ws-toggle"
        type="button"
        title="展开工作区"
        @click="appStore.toggleWorkspace()"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M15 4v16" /><path d="M18 9l2 2-2 2" /></svg>
      </button>
    </div>

    <div ref="listRef" class="ai-msgs">
      <div
        v-for="(m, i) in messages"
        :key="i"
        class="msg"
        :class="m.role === 'user' ? 'user' : 'ai'"
      >
        <img v-if="m.image" class="shot" :src="m.image" alt="页面截图" />
        <span v-if="m.content" class="txt">{{ m.content }}</span>
      </div>
      <div v-if="sending" class="msg ai">
        <span class="typing"><span /><span /><span /></span>
      </div>
    </div>

    <div class="chips">
      <button
        v-for="s in shortcuts"
        :key="s.label"
        type="button"
        class="chip"
        :disabled="sending"
        @click="useShortcut(s.prompt)"
      >
        {{ s.label }}
      </button>
    </div>

    <div class="ai-inputbar-wrap">
      <div class="ai-inputbar">
        <textarea
          id="aiInput"
          v-model="input"
          class="ai-textbox"
          rows="1"
          placeholder="丢个运营任务给 AI，Enter 发送"
          :disabled="sending"
          @keydown="onKeydown"
          @input="autoResize"
        />
        <div class="ai-modelbar">
          <button class="ait" type="button" title="附件">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          </button>
          <button v-if="models.length" class="ait model" type="button" title="切换模型" @click.stop="viewMenuOpen = false; modelMenuOpen = !modelMenuOpen">
            <span class="mi" />
            <span>{{ modelName }}</span>
            <span class="arr">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
            </span>
          </button>
          <button
            class="ait view"
            type="button"
            title="查看页面（AI 快照截图）"
            :class="{ open: viewMenuOpen }"
            @click.stop="modelMenuOpen = false; viewMenuOpen = !viewMenuOpen"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
          </button>
          <button
            class="fb combo"
            type="button"
            :title="hasInput ? '发送' : '语音输入'"
            :class="{ listening }"
            @click="onCombo"
          >
            <svg v-if="hasInput" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
          </button>
          <div v-if="modelMenuOpen" class="model-menu">
            <button
              v-for="m in models"
              :key="m.name"
              type="button"
              class="mm-item"
              :class="{ active: m.name === modelName }"
              @click="pickModel(m.name)"
            >
              {{ m.name }}<small>{{ m.desc }}</small>
            </button>
          </div>
          <div v-if="viewMenuOpen" class="model-menu view-menu">
            <div class="vm-head">查看页面（AI 截图）</div>
            <button
              v-for="p in VIEW_PAGES"
              :key="p.path"
              type="button"
              class="mm-item"
              @click="viewMenuOpen = false; viewPage(p.name)"
            >
              <span class="mi" />{{ p.name }}<small>{{ p.path }}</small>
            </button>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.ai-chat-root {
  width: 380px;
  background: #fff;
  border-left: 1px solid var(--app-neutral-200);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  height: 100vh;
}
.ai-head {
  /* border-box 48px：与侧栏品牌栏 / 工作区顶栏底线对齐 */
  box-sizing: border-box;
  height: 48px;
  flex-shrink: 0;
  padding: 0 10px;
  border-bottom: 1px solid var(--app-neutral-200);
  display: flex;
  align-items: center;
  gap: 6px;
}
.ai-side-toggle,
.ai-ws-toggle {
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--app-neutral-400);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ai-side-toggle svg,
.ai-ws-toggle svg {
  width: 17px;
  height: 17px;
}
.ai-side-toggle:hover,
.ai-ws-toggle:hover {
  color: var(--app-brand-500);
  background: transparent;
}
.spark {
  color: var(--app-brand-500);
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}
.spark svg {
  width: 18px;
  height: 18px;
}
.ai-tasktabs {
  flex: 1;
  display: flex;
  gap: 4px;
  overflow-x: auto;
  min-width: 0;
  align-items: flex-end;
  align-self: stretch;
  scrollbar-width: none;
}
.ai-tasktabs::-webkit-scrollbar {
  width: 0;
  height: 0;
}
.ai-add {
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--app-neutral-400);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ai-add svg {
  width: 16px;
  height: 16px;
}
.ai-add:hover {
  color: var(--app-brand-500);
  background: transparent;
}
.atab {
  padding: 0 12px;
  font-size: 13px;
  color: var(--app-neutral-400);
  border: 1px solid transparent;
  border-bottom: none;
  border-radius: 8px 8px 0 0;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  position: relative;
  background: transparent;
  font-family: inherit;
  transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
}
.atab:hover:not(.active) {
  color: var(--app-neutral-800);
  background: var(--app-neutral-50);
}
/* 原型：激活标签白底 + 1px 边框（下边透明）+ 下移 1px 压住 ai-head 分隔线 */
.atab.active {
  background: #fff;
  color: var(--app-brand-500);
  border-color: var(--app-neutral-200);
  border-bottom-color: transparent;
  box-shadow: 0 1px 0 0 #fff;
  z-index: 2;
  font-weight: 500;
}
.atab.active::before {
  content: '';
  position: absolute;
  top: 0;
  left: 10px;
  right: 10px;
  height: 2px;
  border-radius: 2px 2px 0 0;
  background: var(--app-brand-500);
}
.atab .x {
  font-size: 12px;
  line-height: 1;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.45;
  flex-shrink: 0;
  transition: all 0.15s ease;
}
.atab .x:hover {
  opacity: 1;
  color: #fff;
  background: var(--app-danger-500);
}

.ai-msgs {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  scrollbar-width: none;
}
.ai-msgs:hover {
  scrollbar-width: thin;
  scrollbar-color: #c3c9d2 transparent;
}
.ai-msgs::-webkit-scrollbar {
  width: 8px;
}
.ai-msgs::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 4px;
}
.ai-msgs:hover::-webkit-scrollbar-thumb {
  background: #c3c9d2;
}
.msg {
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}
.msg.user {
  align-self: flex-end;
  background: var(--app-brand-500);
  color: #fff;
  padding: 9px 13px;
  border-radius: 12px 12px 2px 12px;
  max-width: 85%;
}
.msg.ai {
  background: transparent;
  border: none;
  padding: 11px 0;
  max-width: 100%;
  color: var(--app-neutral-700);
  line-height: 1.7;
}

.chips {
  display: flex;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid var(--app-neutral-200);
  flex-wrap: wrap;
}
.chip {
  font-size: 12px;
  padding: 6px 12px;
  border-radius: 20px;
  background: #eef3ff;
  color: var(--app-brand-500);
  border: 1px solid #c7d7ff;
  cursor: pointer;
  font-family: inherit;
}
.chip:hover:not(:disabled) {
  background: var(--app-brand-500);
  color: #fff;
}
.chip:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ai-inputbar-wrap {
  margin: 10px 14px 14px;
  position: relative;
}
.ai-inputbar {
  background: #fff;
  border: 1px solid var(--app-neutral-200);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
}
.ai-inputbar:focus-within {
  border-color: var(--app-brand-500);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08);
}
.ai-textbox {
  /* 显式 border-box：否则 autoResize 设入的 scrollHeight（含 padding）会被 content-box 再加一次 padding，空内容也会变两行高 */
  box-sizing: border-box;
  resize: none;
  border: none;
  outline: none;
  background: transparent;
  color: var(--app-neutral-800);
  font-family: inherit;
  font-size: 14px;
  padding: 14px 16px;
  line-height: 1.6;
  width: 100%;
  max-height: 200px;
  overflow-y: auto;
  display: block;
}
.ai-textbox::placeholder {
  color: var(--app-neutral-400);
}

.ai-modelbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border-top: 1px solid var(--app-neutral-200);
  position: relative;
}
.ait {
  width: 30px;
  height: 30px;
  border: none;
  background: transparent;
  color: var(--app-neutral-400);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}
.ait svg {
  width: 16px;
  height: 16px;
}
.ait:hover:not(:disabled) {
  color: var(--app-brand-500);
}
.ait.model {
  width: auto;
  padding: 0 12px;
  border-radius: 20px;
  font-size: 12px;
  gap: 7px;
  height: 30px;
  color: var(--app-neutral-800);
  font-weight: 500;
}
.mi {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3b82f6, #22c55e);
  display: inline-block;
  flex-shrink: 0;
}
.arr {
  display: inline-flex;
  color: var(--app-neutral-400);
}
.arr svg {
  width: 12px;
  height: 12px;
}
.fb.combo {
  width: 36px;
  height: 36px;
  margin-left: auto;
  border-radius: 50%;
  border: none;
  background: var(--app-brand-500);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.fb.combo svg {
  width: 18px;
  height: 18px;
}
.fb.combo:hover {
  background: var(--app-brand-700);
}
.fb.combo.listening {
  background: var(--app-danger-500);
}
.model-menu {
  position: absolute;
  bottom: 100%;
  right: 0;
  margin-bottom: 6px;
  background: #fff;
  border: 1px solid var(--app-neutral-200);
  border-radius: 12px;
  padding: 6px;
  box-shadow: 0 12px 32px rgba(16, 24, 40, 0.12);
  min-width: 280px;
  z-index: 20;
  box-shadow: var(--shadow-lg);
}
.mm-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 9px 12px;
  font-size: 13px;
  border-radius: 8px;
  cursor: pointer;
  color: var(--app-neutral-800);
  line-height: 1.5;
  border: none;
  background: transparent;
  font-family: inherit;
}
.mm-item:hover {
  background: var(--app-neutral-100);
}
.mm-item.active {
  background: var(--app-brand-500);
  color: #fff;
}
.mm-item small {
  display: block;
  font-size: 11px;
  color: var(--app-neutral-400);
  margin-top: 3px;
  font-weight: 400;
}
.mm-item.active small {
  color: #eaf1ff;
}
/* 查看页面菜单：纵向滚动 + 头部说明 */
.view-menu {
  max-height: 320px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #c3c9d2 transparent;
}
.view-menu .vm-head {
  font-size: 11px;
  color: var(--app-neutral-400);
  padding: 4px 12px 6px;
  border-bottom: 1px solid var(--app-neutral-100);
  margin-bottom: 4px;
}
.view-menu .mm-item {
  display: flex;
  align-items: center;
  gap: 8px;
}
.view-menu .mm-item small {
  margin: 0 0 0 auto;
}
.view-menu .mm-item .mi {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--app-brand-500);
  flex-shrink: 0;
}
/* 截图卡片：圆角边框，点按可看大图 */
.msg .shot {
  display: block;
  max-width: 100%;
  border-radius: 10px;
  border: 1px solid var(--app-neutral-200);
  margin-bottom: 8px;
  cursor: zoom-in;
}
.msg .shot:hover {
  box-shadow: 0 4px 14px rgba(16, 24, 40, 0.1);
}
.msg .txt {
  display: block;
}

.typing span {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--app-neutral-400);
  margin: 0 2px;
  animation: blink 1.2s infinite;
}
.typing span:nth-child(2) {
  animation-delay: 0.2s;
}
.typing span:nth-child(3) {
  animation-delay: 0.4s;
}
@keyframes blink {
  0%,
  100% {
    opacity: 0.3;
  }
  50% {
    opacity: 1;
  }
}

@media (max-width: 768px) {
  .ai-chat-root {
    width: 100%;
    height: 48vh;
    border-left: none;
    border-top: 1px solid var(--app-neutral-200);
  }
}
</style>
