<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  createSession,
  listSessions,
  getSession,
  sendMessage,
  transfer,
  listTickets,
  resolveTicket,
  createKnowledge,
  listKnowledge,
  updateKnowledge,
  deleteKnowledge,
  getSettings,
  upsertSettings,
  syncKnowledge,
  type CsChannel,
  type CsSessionStatus,
  type SessionView,
  type SessionDetail,
  type TicketView,
  type TicketStatus,
  type TicketPriority,
  type KnowledgeView,
  type KnowledgeCategory,
  type CsSettings,
} from '@/api/cs'
import { formatDateTime } from '@/utils/format'

const activeTab = ref<'session' | 'ticket' | 'knowledge' | 'settings'>('session')

const channelMeta: Record<CsChannel, string> = {
  live_comment: '直播评论',
  private_dm: '私信',
  short_video_comment: '短视频评论',
  order_message: '订单消息',
}
const sessionStatusMeta: Record<CsSessionStatus, string> = {
  open: '进行中',
  transferred: '已转人工',
  closed: '已关闭',
}
const ticketStatusMeta: Record<TicketStatus, string> = {
  open: '待处理',
  pending: '处理中',
  resolved: '已解决',
  closed: '已关闭',
}
const priorityMeta: Record<TicketPriority, { label: string; type: '' | 'info' | 'success' | 'warning' | 'danger' }> = {
  low: { label: '低', type: 'info' },
  medium: { label: '中', type: 'success' },
  high: { label: '高', type: 'warning' },
  urgent: { label: '紧急', type: 'danger' },
}

// ============ Tab 1. 会话 ============
const sessions = ref<SessionView[]>([])
const sessionsLoading = ref(false)
const currentSession = ref<SessionDetail | null>(null)
const draft = ref('')
const sending = ref(false)

async function loadSessions() {
  sessionsLoading.value = true
  try {
    sessions.value = await listSessions()
    if (!currentSession.value && sessions.value.length) selectSession(sessions.value[0])
  } catch {
    sessions.value = []
  } finally {
    sessionsLoading.value = false
  }
}

async function selectSession(s: SessionView) {
  currentSession.value = await getSession(s.id)
}

const newDialog = ref(false)
const newSubmitting = ref(false)
const newForm = reactive({ channel: '' as CsChannel, buyerRef: '' })
async function confirmNew() {
  if (!newForm.channel) return ElMessage.warning('请选择触点')
  if (!newForm.buyerRef.trim()) return ElMessage.warning('买家标识必填')
  newSubmitting.value = true
  try {
    const s = await createSession({ channel: newForm.channel, buyerRef: newForm.buyerRef.trim() })
    ElMessage.success('已创建新会话')
    newDialog.value = false
    await loadSessions()
    currentSession.value = await getSession(s.id)
  } catch {
    // 拦截器已提示
  } finally {
    newSubmitting.value = false
  }
}

async function handleSend() {
  if (!currentSession.value) return ElMessage.warning('请先选择会话')
  if (!draft.value.trim()) return
  sending.value = true
  try {
    const res = await sendMessage(currentSession.value.session.id, draft.value.trim())
    const msgs = [...currentSession.value.messages, res.userMessage]
    if (res.aiReply) {
      msgs.push({
        id: -Date.now(),
        sessionId: currentSession.value.session.id,
        role: 'ai',
        content: res.aiReply.reply,
        intent: res.aiReply.intent,
        confidence: res.aiReply.confidence,
        createdAt: new Date().toISOString(),
      })
    }
    currentSession.value = { session: res.session, messages: msgs }
    draft.value = ''
  } catch {
    // 拦截器已提示
  } finally {
    sending.value = false
  }
}

async function handleTransfer() {
  if (!currentSession.value) return
  try {
    const ticket = await transfer(currentSession.value.session.id)
    currentSession.value = { ...currentSession.value, session: { ...currentSession.value.session, status: 'transferred' } }
    ElMessage.success(`已转人工，工单 #${ticket.id} 已创建`)
    await loadSessions()
  } catch {
    // 拦截器已提示
  }
}

// ============ Tab 2. 工单 ============
const tickets = ref<TicketView[]>([])
const ticketsLoading = ref(false)
const ticketStatusFilter = ref<TicketStatus | ''>('')
const ticketPriorityFilter = ref<TicketPriority | ''>('')
async function loadTickets() {
  ticketsLoading.value = true
  try {
    tickets.value = await listTickets({
      status: ticketStatusFilter.value || undefined,
      priority: ticketPriorityFilter.value || undefined,
    })
  } catch {
    tickets.value = []
  } finally {
    ticketsLoading.value = false
  }
}
async function resolve(t: TicketView) {
  try {
    await resolveTicket(t.id)
    ElMessage.success('工单已解决')
    await loadTickets()
  } catch {
    // 拦截器已提示
  }
}

// ============ Tab 3. 知识库 ============
const knowledge = ref<KnowledgeView[]>([])
const knowledgeLoading = ref(false)
const knowledgeCategory = ref<KnowledgeCategory | ''>('')
async function loadKnowledge() {
  knowledgeLoading.value = true
  try {
    knowledge.value = await listKnowledge(knowledgeCategory.value || undefined)
  } catch {
    knowledge.value = []
  } finally {
    knowledgeLoading.value = false
  }
}
const knDialog = ref(false)
const knSubmitting = ref(false)
const knEditing = ref<KnowledgeView | null>(null)
const knForm = reactive({ category: 'faq' as KnowledgeCategory, question: '', answer: '' })
function openCreateKn() {
  knEditing.value = null
  knForm.category = 'faq'
  knForm.question = ''
  knForm.answer = ''
  knDialog.value = true
}
function openEditKn(k: KnowledgeView) {
  knEditing.value = k
  knForm.category = k.category
  knForm.question = k.question
  knForm.answer = k.answer
  knDialog.value = true
}
async function saveKn() {
  if (!knForm.question.trim() || !knForm.answer.trim()) return ElMessage.warning('问题与答案均必填')
  knSubmitting.value = true
  try {
    if (knEditing.value) {
      await updateKnowledge(knEditing.value.id, { category: knForm.category, question: knForm.question.trim(), answer: knForm.answer.trim() })
      ElMessage.success('知识已更新')
    } else {
      await createKnowledge({ category: knForm.category, question: knForm.question.trim(), answer: knForm.answer.trim() })
      ElMessage.success('知识已新增')
    }
    knDialog.value = false
    await loadKnowledge()
  } catch {
    // 拦截器已提示
  } finally {
    knSubmitting.value = false
  }
}
async function removeKn(k: KnowledgeView) {
  try {
    await deleteKnowledge(k.id)
    ElMessage.success('已删除')
    await loadKnowledge()
  } catch {
    // 拦截器已提示
  }
}
async function syncKn() {
  try {
    const res = await syncKnowledge()
    ElMessage.success(`知识同步完成，命中 ${res.added} 条`)
  } catch {
    // 拦截器已提示
  }
}

// ============ Tab 4. 设置 ============
const settings = ref<CsSettings | null>(null)
const settingsLoading = ref(false)
const settingsSaving = ref(false)
const settingsForm = reactive({
  enabledChannels: [] as string[],
  transferThreshold: 0,
  autoReplyEnabled: true,
  greeting: '',
  workingHours: '',
})
async function loadSettings() {
  settingsLoading.value = true
  try {
    settings.value = await getSettings()
    Object.assign(settingsForm, {
      enabledChannels: settings.value.enabledChannels,
      transferThreshold: settings.value.transferThreshold,
      autoReplyEnabled: settings.value.autoReplyEnabled,
      greeting: settings.value.greeting || '',
      workingHours: settings.value.workingHours || '',
    })
  } catch {
    // 拦截器已提示
  } finally {
    settingsLoading.value = false
  }
}
async function saveSettings() {
  settingsSaving.value = true
  try {
    await upsertSettings({
      enabledChannels: settingsForm.enabledChannels as never,
      transferThreshold: settingsForm.transferThreshold,
      autoReplyEnabled: settingsForm.autoReplyEnabled,
      greeting: settingsForm.greeting.trim() || undefined,
      workingHours: settingsForm.workingHours.trim() || undefined,
    })
    ElMessage.success('客服设置已保存')
    await loadSettings()
  } catch {
    // 拦截器已提示
  } finally {
    settingsSaving.value = false
  }
}

onMounted(() => {
  loadSessions()
})
</script>

<template>
  <section class="cs-view" aria-label="AA 智能客服中心">
    <el-alert
      type="info"
      :closable="false"
      show-icon
      class="compliance-alert"
      title="AA 智能客服中心：多触点会话 + AI 自动应答 / 转人工 / 工单 / 知识库；tenantId 由统一拦截器注入。"
    />
    <el-tabs v-model="activeTab" type="border-card" aria-label="AA 功能分区">
      <!-- ===== 1. 会话 ===== -->
      <el-tab-pane name="session">
        <template #label><span aria-label="会话标签页">会话</span></template>
        <div class="session-layout">
          <div class="session-list" aria-label="会话列表">
            <div class="filter-bar">
              <el-button type="primary" size="small" @click="newDialog = true" aria-label="新建会话">新建会话</el-button>
              <el-button size="small" @click="loadSessions" :loading="sessionsLoading" aria-label="刷新会话">刷新</el-button>
            </div>
            <el-scrollbar height="520px">
              <div
                v-for="s in sessions"
                :key="s.id"
                class="session-item"
                :class="{ active: currentSession?.session.id === s.id }"
                @click="selectSession(s)"
                :aria-label="`会话 ${s.id}`"
              >
                <div class="s-row"><b>#{{ s.id }}</b><span class="ch">{{ channelMeta[s.channel] }}</span></div>
                <div class="s-row meta">
                  <el-tag size="small">{{ sessionStatusMeta[s.status] }}</el-tag>
                  <span class="time">{{ formatDateTime(s.updatedAt) }}</span>
                </div>
                <div class="s-last">{{ s.lastMessage || '（暂无消息）' }}</div>
              </div>
            </el-scrollbar>
          </div>
          <div class="session-detail" aria-label="会话详情">
            <template v-if="currentSession">
              <div class="detail-head">
                <span>会话 #{{ currentSession.session.id }} · {{ channelMeta[currentSession.session.channel] }} · {{ sessionStatusMeta[currentSession.session.status] }}</span>
                <el-button size="small" type="warning" @click="handleTransfer" aria-label="转人工">转人工</el-button>
              </div>
              <el-scrollbar height="420px" class="chat-scroll">
                <div v-for="(m, i) in currentSession.messages" :key="m.id || i" class="msg" :class="m.role">
                  <div class="bubble">{{ m.content }}</div>
                  <div class="msg-meta">
                    <span class="msg-time">{{ formatDateTime(m.createdAt) }}</span>
                    <span v-if="m.role === 'ai' && m.intent" class="ai-flag">AI · {{ m.intent }}{{ m.confidence != null ? `(${(m.confidence * 100).toFixed(0)}%)` : '' }}</span>
                  </div>
                </div>
                <el-empty v-if="!currentSession.messages.length" description="暂无消息，发送一条开始对话" />
              </el-scrollbar>
              <div class="chat-input">
                <el-input v-model="draft" placeholder="输入消息，AI 自动应答；不满阈值可转人工" @keyup.enter="handleSend" aria-label="消息输入" />
                <el-button type="primary" :loading="sending" @click="handleSend" aria-label="发送消息">发送</el-button>
              </div>
            </template>
            <el-empty v-else description="选择左侧会话或新建会话" />
          </div>
        </div>
      </el-tab-pane>

      <!-- ===== 2. 工单 ===== -->
      <el-tab-pane name="ticket">
        <template #label><span aria-label="工单标签页">工单</span></template>
        <div class="filter-bar" aria-label="工单操作栏">
          <el-select v-model="ticketStatusFilter" placeholder="状态" clearable style="width: 140px" aria-label="工单状态筛选" @change="loadTickets">
            <el-option label="全部状态" value="" />
            <el-option v-for="(l, k) in ticketStatusMeta" :key="k" :label="l" :value="k" />
          </el-select>
          <el-select v-model="ticketPriorityFilter" placeholder="优先级" clearable style="width: 140px" aria-label="工单优先级筛选" @change="loadTickets">
            <el-option label="全部优先级" value="" />
            <el-option v-for="(p, k) in priorityMeta" :key="k" :label="p.label" :value="k" />
          </el-select>
          <el-button type="primary" @click="loadTickets" :loading="ticketsLoading" aria-label="刷新工单">刷新</el-button>
        </div>
        <el-table :data="tickets" border v-loading="ticketsLoading" aria-label="工单列表">
          <el-table-column prop="id" label="ID" width="70" />
          <el-table-column prop="sessionId" label="会话" width="80" />
          <el-table-column prop="buyerRef" label="买家" min-width="140" show-overflow-tooltip />
          <el-table-column prop="issue" label="问题" min-width="200" show-overflow-tooltip />
          <el-table-column label="优先级" width="100">
            <template #default="{ row }">
              <el-tag size="small" :type="priorityMeta[(row as TicketView).priority].type">{{ priorityMeta[(row as TicketView).priority].label }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">{{ ticketStatusMeta[(row as TicketView).status] }}</template>
          </el-table-column>
          <el-table-column prop="assignedTo" label="处理人" min-width="120" />
          <el-table-column label="创建时间" min-width="170">
            <template #default="{ row }">{{ formatDateTime((row as TicketView).createdAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <el-button
                link
                type="success"
                :disabled="(row as TicketView).status === 'resolved' || (row as TicketView).status === 'closed'"
                @click="resolve(row as TicketView)"
                :aria-label="`解决工单 ${(row as TicketView).id}`"
              >解决</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!ticketsLoading && !tickets.length" description="暂无工单" />
      </el-tab-pane>

      <!-- ===== 3. 知识库 ===== -->
      <el-tab-pane name="knowledge">
        <template #label><span aria-label="知识库标签页">知识库</span></template>
        <div class="filter-bar" aria-label="知识库操作栏">
          <el-select v-model="knowledgeCategory" placeholder="分类" clearable style="width: 150px" aria-label="知识分类筛选" @change="loadKnowledge">
            <el-option label="全部分类" value="" />
            <el-option label="商品 product" value="product" />
            <el-option label="订单 order" value="order" />
            <el-option label="物流 logistics" value="logistics" />
            <el-option label="常见问题 faq" value="faq" />
          </el-select>
          <el-button type="primary" @click="openCreateKn" aria-label="新增知识">新增知识</el-button>
          <el-button @click="syncKn" aria-label="同步知识库">同步知识库</el-button>
        </div>
        <el-table :data="knowledge" border v-loading="knowledgeLoading" aria-label="知识库列表">
          <el-table-column prop="id" label="ID" width="70" />
          <el-table-column prop="category" label="分类" width="120" />
          <el-table-column prop="question" label="问题" min-width="220" show-overflow-tooltip />
          <el-table-column prop="answer" label="答案" min-width="260" show-overflow-tooltip />
          <el-table-column prop="source" label="来源" width="110" />
          <el-table-column label="更新时间" min-width="170">
            <template #default="{ row }">{{ formatDateTime((row as KnowledgeView).updatedAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="140" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openEditKn(row as KnowledgeView)" :aria-label="`编辑知识 ${(row as KnowledgeView).id}`">编辑</el-button>
              <el-button link type="danger" @click="removeKn(row as KnowledgeView)" :aria-label="`删除知识 ${(row as KnowledgeView).id}`">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!knowledgeLoading && !knowledge.length" description="暂无知识，点击「新增知识」沉淀问答" />
      </el-tab-pane>

      <!-- ===== 4. 设置 ===== -->
      <el-tab-pane name="settings">
        <template #label><span aria-label="设置标签页">设置</span></template>
        <div class="settings-card" v-loading="settingsLoading" aria-label="客服设置">
          <el-form label-width="130px" @submit.prevent>
            <el-form-item label="启用触点">
              <el-select v-model="settingsForm.enabledChannels" multiple style="width: 100%" aria-label="启用触点">
                <el-option v-for="(l, k) in channelMeta" :key="k" :label="l" :value="k" />
              </el-select>
            </el-form-item>
            <el-form-item label="转人工阈值">
              <el-input v-model.number="settingsForm.transferThreshold" type="number" style="width: 200px" aria-label="转人工阈值" />
            </el-form-item>
            <el-form-item label="AI 自动回复">
              <el-switch v-model="settingsForm.autoReplyEnabled" aria-label="AI自动回复开关" />
            </el-form-item>
            <el-form-item label="欢迎语">
              <el-input v-model="settingsForm.greeting" type="textarea" :rows="2" aria-label="欢迎语" />
            </el-form-item>
            <el-form-item label="工作时间">
              <el-input v-model="settingsForm.workingHours" placeholder="如 9:00-21:00" style="width: 220px" aria-label="工作时间" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="settingsSaving" @click="saveSettings" aria-label="保存设置">保存设置</el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 新建会话弹窗 -->
    <el-dialog v-model="newDialog" title="新建会话" aria-label="新建会话弹窗" width="480px">
      <el-form label-width="80px" @submit.prevent>
        <el-form-item label="触点" required>
          <el-select v-model="newForm.channel" placeholder="选择触点" style="width: 100%" aria-label="会话触点">
            <el-option v-for="(l, k) in channelMeta" :key="k" :label="l" :value="k" />
          </el-select>
        </el-form-item>
        <el-form-item label="买家标识" required>
          <el-input v-model="newForm.buyerRef" placeholder="如 用户 openId / 订单号" aria-label="买家标识" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="newDialog = false">取消</el-button>
        <el-button type="primary" :loading="newSubmitting" @click="confirmNew">创建</el-button>
      </template>
    </el-dialog>

    <!-- 知识新增/编辑弹窗 -->
    <el-dialog v-model="knDialog" :title="knEditing ? '编辑知识' : '新增知识'" aria-label="知识编辑弹窗" width="560px">
      <el-form label-width="80px" @submit.prevent>
        <el-form-item label="分类" required>
          <el-select v-model="knForm.category" style="width: 100%" aria-label="知识分类">
            <el-option label="商品 product" value="product" />
            <el-option label="订单 order" value="order" />
            <el-option label="物流 logistics" value="logistics" />
            <el-option label="常见问题 faq" value="faq" />
          </el-select>
        </el-form-item>
        <el-form-item label="问题" required>
          <el-input v-model="knForm.question" aria-label="知识问题" />
        </el-form-item>
        <el-form-item label="答案" required>
          <el-input v-model="knForm.answer" type="textarea" :rows="4" aria-label="知识答案" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="knDialog = false">取消</el-button>
        <el-button type="primary" :loading="knSubmitting" @click="saveKn">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.cs-view {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.filter-bar {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-bottom: var(--space-3);
  align-items: center;
}
.session-layout {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: var(--space-3);
}
.session-list {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--radius-md);
  padding: var(--space-2);
}
.session-item {
  padding: var(--space-2) var(--space-2);
  border-radius: var(--radius-md);
  cursor: pointer;
  margin-bottom: 6px;
  border: 1px solid transparent;
}
.session-item:hover {
  background: var(--app-neutral-50);
}
.session-item.active {
  background: var(--app-brand-50);
  border-color: var(--app-brand-500);
}
.s-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.s-row.meta {
  margin-top: var(--space-1);
}
.ch {
  font-size: var(--text-sm);
  color: var(--el-text-color-regular);
}
.time {
  font-size: var(--text-xs);
  color: var(--el-text-color-secondary);
}
.s-last {
  margin-top: var(--space-1);
  font-size: var(--text-sm);
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.session-detail {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--radius-md);
  padding: var(--space-2);
  display: flex;
  flex-direction: column;
  height: 560px;
}
.detail-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  margin-bottom: var(--space-2);
}
.chat-scroll {
  flex: 1;
  border-top: 1px solid var(--el-border-color-lighter);
  border-bottom: 1px solid var(--el-border-color-lighter);
  padding: var(--space-2) 0;
}
.msg {
  margin-bottom: var(--space-2);
  display: flex;
  flex-direction: column;
}
.msg.user {
  align-items: flex-end;
}
.bubble {
  max-width: 70%;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-lg);
  background: var(--app-neutral-100);
  font-size: var(--text-base-sm);
  word-break: break-word;
}
.msg.user .bubble {
  background: var(--app-brand-500);
  color: var(--app-neutral-0);
}
.msg.ai .bubble {
  background: var(--app-success-50);
  border: 1px solid var(--app-success-100);
}
.msg-meta {
  font-size: var(--text-xs);
  color: var(--app-neutral-300);
  margin-top: 2px;
}
.ai-flag {
  margin-left: 6px;
  color: var(--app-success-500);
}
.chat-input {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-2);
}
.settings-card {
  max-width: 640px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--radius-md);
  padding: var(--space-4);
}
</style>
