<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createDashboard,
  deleteDashboard,
  getDashboardStats,
  getDashboardTodos,
  getDashboardTrend,
  listDashboards,
  type DashboardStats,
  type DashboardTodoItem,
} from '@/api/dashboard'

const router = useRouter()
const loading = ref(false)
const stats = ref<DashboardStats>({
  accounts: 0,
  scripts: 0,
  materials: 0,
  videos: 0,
  publishes: 0,
  topics: 0,
  intels: 0,
  liveOnline: 0,
  todayOrders: 0,
  pendingTickets: 0,
  pendingReviews: 0,
})

// 总览卡片组（与 UI 原型一致）
const statCards = [
  { key: 'topics', label: '选题库' },
  { key: 'scripts', label: '待拍脚本' },
  { key: 'liveOnline', label: '直播在线' },
  { key: 'todayOrders', label: '今日订单' },
  { key: 'pendingTickets', label: '待审工单' },
  { key: 'pendingReviews', label: '待复盘' },
] as const

// ===== 可视化布局调整：卡片显隐即时生效（localStorage 持久化），可另存为看板配置 =====
const editMode = ref(false)
const HIDDEN_KEY = 'ops_home_hidden_cards'
function loadHidden(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]')
    return Array.isArray(raw) ? raw.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}
const hiddenCards = ref<string[]>(loadHidden())
const visibleCards = computed(() => statCards.filter((c) => !hiddenCards.value.includes(c.key)))
function persistHidden() {
  localStorage.setItem(HIDDEN_KEY, JSON.stringify(hiddenCards.value))
}
function toggleCard(key: string) {
  if (!editMode.value) return
  const list = hiddenCards.value
  const idx = list.indexOf(key)
  if (idx >= 0) list.splice(idx, 1)
  else if (list.length < statCards.length - 1) list.push(key) // 至少保留 1 张卡
  else ElMessage.info('至少保留一张卡片')
  persistHidden()
}

// ===== 看板配置（后端 ops/dashboard/configs 持久化，可跨设备） =====
interface SavedConfig {
  id: number
  name: string
  widgets: string[]
}
const savedConfigs = ref<SavedConfig[]>([])
const activeConfigId = ref<number | null>(null)

async function loadConfigs() {
  try {
    const list = await listDashboards()
    savedConfigs.value = list.map((c) => ({
      id: Number(c.id),
      name: c.name,
      widgets: Array.isArray(c.widgets) ? (c.widgets as string[]).filter((x) => typeof x === 'string') : [],
    }))
  } catch {
    // 后端不可用时下拉为空，布局调整仍可用（localStorage）
  }
}

async function onSaveConfig() {
  try {
    const { value } = await ElMessageBox.prompt('给当前布局起个名字', '保存看板配置', {
      inputValue: activeConfigId.value ? savedConfigs.value.find((c) => c.id === activeConfigId.value)?.name : '',
      inputPattern: /\S+/,
      inputErrorMessage: '名称不能为空',
    })
    const widgets = statCards.filter((c) => !hiddenCards.value.includes(c.key)).map((c) => c.key)
    if (activeConfigId.value) {
      const target = savedConfigs.value.find((c) => c.id === activeConfigId.value)
      if (target) {
        const { updateDashboard } = await import('@/api/dashboard')
        await updateDashboard(activeConfigId.value, { name: value, widgets })
        target.name = value
        target.widgets = widgets
        ElMessage.success('看板配置已更新')
        return
      }
    }
    const created = await createDashboard({ name: value, widgets })
    savedConfigs.value.push({ id: Number(created.id), name: created.name, widgets })
    activeConfigId.value = Number(created.id)
    ElMessage.success('看板配置已保存')
  } catch {
    // 用户取消或保存失败（失败已由拦截器提示）
  }
}

function onApplyConfig(id: number | null) {
  activeConfigId.value = id
  const target = savedConfigs.value.find((c) => c.id === id)
  if (!target) return
  // 配置里存的 key 集合 = 显示集合；反推隐藏集合，立即生效
  hiddenCards.value = statCards.filter((c) => !target.widgets.includes(c.key)).map((c) => c.key)
  persistHidden()
  ElMessage.success(`已应用「${target.name}」`)
}

async function onDeleteConfig() {
  if (!activeConfigId.value) return
  const target = savedConfigs.value.find((c) => c.id === activeConfigId.value)
  if (!target) return
  try {
    await ElMessageBox.confirm(`删除看板配置「${target.name}」？`, '删除确认', { type: 'warning' })
  } catch {
    return
  }
  try {
    await deleteDashboard(activeConfigId.value)
    savedConfigs.value = savedConfigs.value.filter((c) => c.id !== activeConfigId.value)
    activeConfigId.value = null
    ElMessage.success('已删除')
  } catch {
    // 拦截器已提示
  }
}

// ===== 订单/投流趋势（真实数据；天数可切换） =====
const TREND_CHOICES = [7, 10, 14, 30] as const
const trendDays = ref<number>(10)
const chartData = ref<number[]>([])
const chartDates = ref<string[]>([])

async function loadTrend(days: number) {
  trendDays.value = days
  try {
    const trend = await getDashboardTrend(days)
    chartData.value = trend.days.map((d) => d.orders)
    chartDates.value = trend.days.map((d) => d.date)
  } catch {
    // 静默降级（保持当前数据）
  }
}

// 待办：彩色图标盒（26×26、圆角 7、14px 图标、色块背景），点击进入对应模块
// 数据来自 /ops/dashboard/todos 聚合；接口失败时保持数量 0（不展示假数据）
const TODO_META: Record<DashboardTodoItem['type'], { label: string; path: string; color: string; icon: string }> = {
  publish: {
    label: '发布审核',
    path: '/publish',
    color: '#3b82f6',
    icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="m9 15 2 2 4-4"/>',
  },
  cs: {
    label: '高风客诉',
    path: '/cs',
    color: '#f59e0b',
    icon: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  },
  reconcile: {
    label: '对账差异',
    path: '/reconcile',
    color: '#22c55e',
    icon: '<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>',
  },
  ad: {
    label: '待启投流',
    path: '/ad',
    color: '#ef4444',
    icon: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  },
}
const todoItems = ref(
  (Object.keys(TODO_META) as Array<DashboardTodoItem['type']>).map((type) => ({
    type,
    count: 0,
    ...TODO_META[type],
  })),
)

onMounted(async () => {
  loading.value = true
  try {
    stats.value = await getDashboardStats()
  } catch {
    // 静默降级，显示 0
  } finally {
    loading.value = false
  }
  void loadTrend(trendDays.value)
  // 待办聚合（失败保持 0）
  try {
    const todos = await getDashboardTodos()
    todoItems.value = todos.list.map((t) => ({ type: t.type, count: t.count, ...TODO_META[t.type] }))
  } catch {
    // 静默降级
  }
  // 已保存的看板配置
  void loadConfigs()
})
</script>

<template>
  <div class="home-page">
    <div class="ov-head">
      <div class="ov-title">运营总览 · 实时</div>
      <div class="config-bar">
        <span class="cfg-label">看板</span>
        <select
          class="cfg-select"
          :value="activeConfigId ?? ''"
          aria-label="选择看板配置"
          @change="onApplyConfig(Number(($event.target as HTMLSelectElement).value) || null)"
        >
          <option :value="''">默认布局</option>
          <option v-for="c in savedConfigs" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
        <button type="button" class="cfg-btn" @click="onSaveConfig">
          {{ activeConfigId ? '更新配置' : '保存当前布局' }}
        </button>
        <button
          v-if="activeConfigId"
          type="button"
          class="cfg-btn danger"
          @click="onDeleteConfig"
        >
          删除
        </button>
      </div>
    </div>

    <div class="cards">
      <div
        v-for="card in editMode ? statCards : visibleCards"
        :key="card.key"
        class="card"
        :class="{ dimmed: editMode && hiddenCards.includes(card.key) }"
        :title="editMode ? '点击切换显示/隐藏' : undefined"
        role="button"
        @click="toggleCard(card.key)"
      >
        <div class="k">{{ card.label }}</div>
        <div class="v">
          <template v-if="loading">—</template>
          <template v-else>{{ (stats as Record<string, number>)[card.key] }}<small> 项</small></template>
        </div>
        <span v-if="editMode" class="card-eye">{{ hiddenCards.includes(card.key) ? '＋ 显示' : '－ 隐藏' }}</span>
      </div>
    </div>
    <div class="edit-bar">
      <button type="button" class="cfg-btn" :class="{ active: editMode }" @click="editMode = !editMode">
        {{ editMode ? '✓ 完成调整' : '调整布局' }}
      </button>
      <span v-if="editMode" class="edit-hint">点击卡片可切换显示/隐藏（至少保留一张），改动即时生效</span>
    </div>

    <div class="row2">
      <div class="panel">
        <h3>
          订单/投流趋势
          <span class="trend-days">
            <button
              v-for="d in TREND_CHOICES"
              :key="d"
              type="button"
              class="day-btn"
              :class="{ active: trendDays === d }"
              @click="loadTrend(d)"
            >
              {{ d }}日
            </button>
          </span>
        </h3>
        <div class="chart" aria-label="近N日订单趋势">
          <div v-if="!chartData.length" class="chart-empty">
            暂无趋势数据
          </div>
          <div
            v-else
            v-for="(v, i) in chartData"
            :key="i"
            class="bar"
            :style="{ height: `${Math.max(v, 2)}%` }"
            :title="`${chartDates[i] ?? ''} ${v} 单`"
          >
            <span>{{ v }}</span>
          </div>
        </div>
      </div>
      <div class="panel">
        <h3>待办 <span class="tag">点击进入</span></h3>
        <div class="todo">
          <button
            v-for="item in todoItems"
            :key="item.type"
            type="button"
            class="item"
            @click="router.push(item.path)"
          >
            <span class="ic" :style="{ background: `${item.color}22`, color: item.color }">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" v-html="item.icon" />
            </span>
            <span>{{ item.label }}</span>
            <span class="meta">{{ item.count > 0 ? `${item.count} 条待处理` : '暂无' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ov-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.ov-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 14px;
}
.config-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}
.cfg-label {
  font-size: 12px;
  color: var(--app-neutral-400);
}
.cfg-select {
  height: 30px;
  border: 1px solid var(--app-neutral-200);
  border-radius: 8px;
  background: #fff;
  font-size: 12px;
  padding: 0 8px;
  color: var(--app-neutral-800);
  font-family: inherit;
}
.cfg-btn {
  height: 30px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid var(--app-neutral-200);
  background: #fff;
  color: var(--app-neutral-700);
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
}
.cfg-btn:hover {
  border-color: var(--app-brand-500);
  color: var(--app-brand-500);
}
.cfg-btn.active {
  background: var(--app-brand-500);
  border-color: var(--app-brand-500);
  color: #fff;
}
.cfg-btn.danger:hover {
  border-color: var(--app-danger-500);
  color: var(--app-danger-500);
}
.cards {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 14px;
  margin-bottom: 8px;
}
.card {
  background: #fff;
  border: 1px solid var(--app-neutral-200);
  border-radius: var(--radius-lg);
  padding: 16px;
  position: relative;
}
.card.dimmed {
  opacity: 0.45;
}
.card[role='button'] {
  cursor: pointer;
}
.card-eye {
  position: absolute;
  top: 10px;
  right: 12px;
  font-size: 11px;
  color: var(--app-brand-500);
}
.edit-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  min-height: 30px;
}
.edit-hint {
  font-size: 12px;
  color: var(--app-neutral-400);
}
.trend-days {
  display: inline-flex;
  gap: 4px;
  font-weight: 400;
}
.day-btn {
  height: 24px;
  padding: 0 8px;
  border-radius: 6px;
  border: 1px solid var(--app-neutral-200);
  background: transparent;
  font-size: 11px;
  color: var(--app-neutral-400);
  cursor: pointer;
  font-family: inherit;
}
.day-btn.active {
  background: var(--app-brand-500);
  border-color: var(--app-brand-500);
  color: #fff;
}
/* ===== 指标卡片 ===== */
.card {
  transition: box-shadow 0.18s ease, transform 0.18s ease, border-color 0.18s ease;
  overflow: hidden;
}
.card:hover {
  border-color: var(--app-neutral-300);
  box-shadow: 0 6px 18px rgba(16, 24, 40, 0.08);
  transform: translateY(-2px);
}
.card .k {
  font-size: 12px;
  color: var(--app-neutral-400);
  margin-bottom: 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card .v {
  font-size: 26px;
  font-weight: 700;
  line-height: 1.1;
  color: var(--app-neutral-900);
  letter-spacing: -0.5px;
  font-variant-numeric: tabular-nums;
}
.card .v small {
  font-size: 12px;
  font-weight: 400;
  color: var(--app-neutral-400);
  margin-left: 3px;
  letter-spacing: 0;
}
@media (max-width: 1500px) {
  .cards { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 1100px) {
  .cards { grid-template-columns: repeat(2, 1fr); }
}
/* ===== 底部面板：趋势图 + 待办 ===== */
.row2 {
  display: grid;
  grid-template-columns: 1.55fr 1fr;
  gap: 14px;
  margin-top: 14px;
  align-items: stretch;
}
@media (max-width: 1100px) {
  .row2 { grid-template-columns: 1fr; }
}
.panel {
  background: #fff;
  border: 1px solid var(--app-neutral-200);
  border-radius: var(--radius-lg);
  padding: 16px;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
  transition: box-shadow 0.18s ease, transform 0.18s ease;
}
.panel:hover {
  box-shadow: 0 8px 22px rgba(16, 24, 40, 0.08);
  transform: translateY(-1px);
}
.panel h3 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
  color: var(--app-neutral-800);
}
.panel h3 .tag {
  font-size: 11px;
  font-weight: 400;
  color: var(--app-brand-500);
  background: rgba(37, 99, 235, 0.08);
  border-radius: 6px;
  padding: 2px 8px;
}
/* 趋势柱状图 */
.chart {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 170px;
  padding-top: 22px;
}
.chart-empty {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--app-neutral-400);
  font-size: 13px;
  background: var(--app-neutral-50);
  border-radius: 8px;
}
.bar {
  flex: 1;
  min-width: 4px;
  border-radius: 4px 4px 0 0;
  background: linear-gradient(180deg, var(--app-brand-500), rgba(37, 99, 235, 0.55));
  position: relative;
  transition: height 0.4s ease, opacity 0.15s ease;
  cursor: default;
}
.bar:hover {
  opacity: 0.85;
}
.bar span {
  position: absolute;
  top: -18px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 10px;
  color: var(--app-neutral-400);
  opacity: 0;
  transition: opacity 0.15s ease;
  white-space: nowrap;
}
.bar:hover span {
  opacity: 1;
}
/* 待办列表 */
.todo {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--app-neutral-800);
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  text-align: left;
  transition: background-color 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
}
.item:hover {
  background: var(--app-neutral-50);
  border-color: var(--app-neutral-200);
}
.item:active {
  transform: scale(0.99);
}
.item .ic {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.item .ic svg {
  width: 15px;
  height: 15px;
}
.item .meta {
  margin-left: auto;
  font-size: 12px;
  color: var(--app-neutral-400);
  white-space: nowrap;
}
</style>
