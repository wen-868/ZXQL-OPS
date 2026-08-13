<script setup lang="ts">
import { ref, nextTick, computed, onBeforeUnmount } from 'vue'
import { ChatDotRound, Close, Promotion } from '@element-plus/icons-vue'
import request from '@/utils/request'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const open = ref(false)
const input = ref('')
const messages = ref<ChatMessage[]>([])
const sending = ref(false)
const listRef = ref<HTMLElement | null>(null)

const hasMessages = computed(() => messages.value.length > 0)

function toggle() {
  open.value = !open.value
  if (open.value) {
    nextTick(() => scrollBottom())
  }
}

function scrollBottom() {
  nextTick(() => {
    if (listRef.value) {
      listRef.value.scrollTop = listRef.value.scrollHeight
    }
  })
}

async function send() {
  const text = input.value.trim()
  if (!text || sending.value) return
  input.value = ''
  messages.value.push({ role: 'user', content: text })
  scrollBottom()

  // 取最近 10 轮做历史
  const history = messages.value.slice(0, -1).slice(-10)
  sending.value = true

  try {
    const res = await request.post<{ reply: string }>('/ops/ai-chat', {
      message: text,
      history: history.map((m) => ({ role: m.role, content: m.content })),
    })
    const reply = (res.data as any)?.reply ?? (res.data as unknown as string) ?? '（助手暂时无法回复，请稍后重试）'
    messages.value.push({ role: 'assistant', content: reply })
  } catch {
    messages.value.push({ role: 'assistant', content: '抱歉，AI 助手暂时不可用。请检查本地 LLM 服务（Ollama）是否已启动。' })
  } finally {
    sending.value = false
    scrollBottom()
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
  }
}

onBeforeUnmount(() => {
  open.value = false
})
</script>

<template>
  <div class="ai-chat-root" :class="{ open }">
    <!-- 浮动触发按钮 -->
    <button
      class="ai-chat-trigger"
      type="button"
      :aria-label="open ? '关闭 AI 助手' : '打开 AI 助手'"
      title="智享 AI 助手"
      @click="toggle"
    >
      <span class="trigger-ring" />
      <el-icon :size="22">
        <ChatDotRound v-if="!open" />
        <Close v-else />
      </el-icon>
    </button>

    <!-- 对话面板 -->
    <Transition name="panel">
      <div v-if="open" class="ai-chat-panel" role="dialog" aria-label="智享 AI 助手对话框">
        <!-- 头部 -->
        <div class="chat-header">
          <div class="chat-header-left">
            <span class="chat-avatar">AI</span>
            <div>
              <h3 class="chat-title">智享 AI 助手</h3>
              <p class="chat-subtitle">基于本地大模型，回答全链路运营问题</p>
            </div>
          </div>
          <button class="chat-close" type="button" aria-label="关闭" @click="open = false">
            <el-icon :size="16"><Close /></el-icon>
          </button>
        </div>

        <!-- 消息列表 -->
        <div ref="listRef" class="chat-messages">
          <!-- 空态 -->
          <div v-if="!hasMessages" class="chat-empty">
            <div class="empty-icon">
              <el-icon :size="32" color="var(--app-brand-300)"><Promotion /></el-icon>
            </div>
            <p class="empty-title">你好，我是智享 AI 助手</p>
            <p class="empty-hint">可以问我关于账号矩阵、情报分析、选题策略、脚本生成、合规预检等运营问题</p>
            <div class="empty-suggestions">
              <button
                v-for="q in ['今天有哪些高热度选题？', '帮我分析账号矩阵表现', '如何优化脚本转化率？']"
                :key="q"
                class="suggestion-chip"
                type="button"
                @click="input = q; send()"
              >
                {{ q }}
              </button>
            </div>
          </div>

          <!-- 消息 -->
          <TransitionGroup name="msg" tag="div" class="msg-list">
            <div
              v-for="(m, i) in messages"
              :key="i"
              class="msg-row"
              :class="m.role"
            >
              <span class="msg-role">{{ m.role === 'user' ? '你' : 'AI' }}</span>
              <div class="msg-bubble">{{ m.content }}</div>
            </div>

            <!-- 加载态气泡 -->
            <div v-if="sending" key="loading" class="msg-row assistant">
              <span class="msg-role">AI</span>
              <div class="msg-bubble loading">
                <span class="dot-pulse" />
              </div>
            </div>
          </TransitionGroup>
        </div>

        <!-- 输入区 -->
        <div class="chat-input-area">
          <textarea
            v-model="input"
            class="chat-textarea"
            :disabled="sending"
            placeholder="输入你的运营问题…（Enter 发送）"
            rows="1"
            @keydown="onKeydown"
          />
          <button
            class="chat-send-btn"
            type="button"
            :disabled="!input.trim() || sending"
            aria-label="发送消息"
            @click="send"
          >
            <el-icon :size="18"><Promotion /></el-icon>
          </button>
        </div>

        <!-- 免责声明 -->
        <p class="chat-disclaimer">AI 回答仅供参考，请结合实际运营数据做决策</p>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* ========================================
   根定位
   ======================================== */
.ai-chat-root {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 9999;
}

/* ========================================
   浮动触发按钮
   ======================================== */
.ai-chat-trigger {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  background: linear-gradient(135deg, var(--app-brand-500), var(--app-brand-600));
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 20px var(--app-brand-shadow);
  transition: transform var(--duration-normal) var(--ease-out),
              box-shadow var(--duration-normal) var(--ease-out);
  position: relative;
}

.ai-chat-trigger:hover {
  transform: scale(1.08);
  box-shadow: 0 6px 28px var(--app-brand-shadow-strong);
}

/* 脉冲光环 */
.trigger-ring {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 2px solid var(--app-brand-400);
  opacity: 0.4;
  animation: ring-pulse 2s ease-out infinite;
}

@keyframes ring-pulse {
  0%, 100% { transform: scale(1); opacity: 0.4; }
  50%      { transform: scale(1.15); opacity: 0; }
}

/* ========================================
   对话面板
   ======================================== */
.ai-chat-panel {
  position: absolute;
  right: 0;
  bottom: 68px;
  width: 400px;
  height: 560px;
  background: var(--app-neutral-0);
  border: 1px solid var(--app-neutral-200);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ========================================
   头部
   ======================================== */
.chat-header {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--app-neutral-100);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  background: var(--app-neutral-0);
}

.chat-header-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.chat-avatar {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--app-brand-500), var(--app-driver-lazy));
  color: #fff;
  font-weight: 700;
  font-size: var(--text-base-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.chat-title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--app-neutral-800);
  margin: 0;
  line-height: 1.3;
}

.chat-subtitle {
  font-size: var(--text-xs);
  color: var(--app-neutral-400);
  margin: 0;
}

.chat-close {
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--app-neutral-400);
  padding: 4px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color var(--duration-fast), background var(--duration-fast);
}

.chat-close:hover {
  color: var(--app-neutral-700);
  background: var(--app-neutral-100);
}

/* ========================================
   消息列表
   ======================================== */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-3) var(--space-4);
  display: flex;
  flex-direction: column;
}

/* 空态 */
.chat-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-8) var(--space-4);
  text-align: center;
}

.empty-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--app-brand-50);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--space-2);
}

.empty-title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--app-neutral-700);
  margin: 0;
}

.empty-hint {
  font-size: var(--text-base-sm);
  color: var(--app-neutral-400);
  margin: 0;
  max-width: 280px;
  line-height: 1.5;
}

.empty-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  justify-content: center;
  margin-top: var(--space-2);
}

.suggestion-chip {
  border: 1px solid var(--app-neutral-200);
  background: var(--app-neutral-0);
  color: var(--app-brand-600);
  font-size: var(--text-xs);
  padding: 6px 12px;
  border-radius: 999px;
  cursor: pointer;
  transition: background var(--duration-fast), border-color var(--duration-fast);
  white-space: nowrap;
}

.suggestion-chip:hover {
  background: var(--app-brand-50);
  border-color: var(--app-brand-300);
}

/* 消息行 */
.msg-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.msg-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-width: 90%;
}

.msg-row.user {
  align-self: flex-end;
}

.msg-row.assistant {
  align-self: flex-start;
}

.msg-role {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--app-neutral-400);
  padding: 0 6px;
  text-transform: uppercase;
}

.msg-row.user .msg-role {
  text-align: right;
}

.msg-bubble {
  padding: 10px 14px;
  border-radius: var(--radius-lg);
  font-size: var(--text-base-sm);
  line-height: 1.55;
  word-break: break-word;
}

.msg-row.user .msg-bubble {
  background: var(--app-brand-500);
  color: #fff;
  border-bottom-right-radius: 4px;
}

.msg-row.assistant .msg-bubble {
  background: var(--app-neutral-50);
  color: var(--app-neutral-700);
  border-bottom-left-radius: 4px;
  border: 1px solid var(--app-neutral-100);
}

/* 加载动画气泡 */
.msg-bubble.loading {
  display: flex;
  align-items: center;
  min-width: 54px;
  min-height: 32px;
}

.dot-pulse {
  display: flex;
  gap: 4px;
}

.dot-pulse::before,
.dot-pulse::after,
.dot-pulse {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--app-neutral-300);
  animation: dot-bounce 1.4s ease-in-out infinite both;
}

.dot-pulse::before {
  animation-delay: -0.32s;
}

.dot-pulse::after {
  animation-delay: -0.16s;
}

@keyframes dot-bounce {
  0%, 80%, 100% { transform: scale(0); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}

/* ========================================
   输入区
   ======================================== */
.chat-input-area {
  padding: var(--space-2) var(--space-3);
  border-top: 1px solid var(--app-neutral-100);
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
  flex-shrink: 0;
  background: var(--app-neutral-0);
}

.chat-textarea {
  flex: 1;
  border: 1px solid var(--app-neutral-200);
  border-radius: var(--radius-lg);
  padding: 10px 12px;
  font-size: var(--text-base-sm);
  font-family: inherit;
  resize: none;
  outline: none;
  color: var(--app-neutral-700);
  background: var(--app-neutral-50);
  line-height: 1.5;
  max-height: 100px;
  transition: border-color var(--duration-fast), box-shadow var(--duration-fast);
}

.chat-textarea:focus {
  border-color: var(--app-brand-400);
  box-shadow: 0 0 0 3px var(--app-brand-100);
  background: #fff;
}

.chat-textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.chat-send-btn {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  background: var(--app-brand-500);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform var(--duration-fast),
              background var(--duration-fast),
              opacity var(--duration-fast);
}

.chat-send-btn:hover:not(:disabled) {
  background: var(--app-brand-600);
  transform: scale(1.08);
}

.chat-send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ========================================
   免责声明
   ======================================== */
.chat-disclaimer {
  font-size: 11px;
  color: var(--app-neutral-300);
  text-align: center;
  padding: 6px var(--space-4);
  margin: 0;
  flex-shrink: 0;
}

/* ========================================
   过渡动画
   ======================================== */
.panel-enter-active,
.panel-leave-active {
  transition: all 0.25s var(--ease-out);
}

.panel-enter-from,
.panel-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.95);
}

/* 消息入场 */
.msg-enter-active {
  transition: all 0.3s var(--ease-spring);
}

.msg-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

/* ========================================
   响应式：在小屏下缩小面板宽度
   ======================================== */
@media (max-width: 480px) {
  .ai-chat-panel {
    width: calc(100vw - 48px);
    right: -4px;
  }

  .ai-chat-trigger {
    right: 0;
  }
}
</style>
