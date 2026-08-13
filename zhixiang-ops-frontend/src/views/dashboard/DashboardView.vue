<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getOverview,
  getFunnel,
  getAccountCompare,
  getTopicEfficiency,
  getHumanHook,
  listDashboards,
  createDashboard,
  updateDashboard,
  deleteDashboard,
  type OverviewCards,
  type OverviewView,
  type FunnelView,
  type AccountCompareView,
  type TopicEfficiencyView,
  type HumanHookView,
  type DashboardConfig,
} from '@/api/dashboard'
import { formatAmount } from '@/utils/format'

const activeTab = ref<'overview' | 'funnel' | 'account' | 'topic' | 'hook' | 'config'>('overview')

// ============ Tab 1. 经营概览（五维四率核心卡 + 趋势） ============
const overview = ref<OverviewView | null>(null)
const overviewLoading = ref(false)

const CARD_META: { key: keyof OverviewCards; label: string; kind: 'money' | 'rate' | 'count' | 'int' }[] = [
  { key: 'totalPlay', label: '总播放', kind: 'count' },
  { key: 'avgCompleteRate', label: '平均完播率', kind: 'rate' },
  { key: 'totalInteract', label: '总互动', kind: 'count' },
  { key: 'totalFanInc', label: '总涨粉', kind: 'count' },
  { key: 'totalCommission', label: '总佣金', kind: 'money' },
  { key: 'completeRate', label: '完播率', kind: 'rate' },
  { key: 'interactRate', label: '互动率', kind: 'rate' },
  { key: 'fanRate', label: '涨粉率', kind: 'rate' },
  { key: 'conversionRate', label: '转化率', kind: 'rate' },
  { key: 'videoCount', label: '视频数', kind: 'int' },
]

const cardList = computed(() =>
  CARD_META.map((m) => ({
    ...m,
    value: overview.value?.cards[m.key] ?? 0,
  })),
)

function formatCard(value: number, kind: 'money' | 'rate' | 'count' | 'int'): string {
  if (kind === 'money' || kind === 'count') return formatAmount(value)
  if (kind === 'rate') return `${value.toFixed(2)}%`
  return String(value)
}

async function loadOverview() {
  overviewLoading.value = true
  try {
    overview.value = await getOverview()
  } catch {
    overview.value = null
  } finally {
    overviewLoading.value = false
  }
}

// ============ Tab 2. 全链路漏斗 ============
const funnel = ref<FunnelView | null>(null)
const funnelLoading = ref(false)
const funnelMax = computed(() =>
  funnel.value && funnel.value.stages.length ? Math.max(...funnel.value.stages.map((s) => s.value), 1) : 1,
)
function funnelPct(v: number) {
  return Math.round((v / funnelMax.value) * 100)
}
async function loadFunnel() {
  funnelLoading.value = true
  try {
    funnel.value = await getFunnel()
  } catch {
    funnel.value = null
  } finally {
    funnelLoading.value = false
  }
}

// ============ Tab 3. 账号对比 ============
const accounts = ref<AccountCompareView | null>(null)
const accountLoading = ref(false)
async function loadAccounts() {
  accountLoading.value = true
  try {
    accounts.value = await getAccountCompare()
  } catch {
    accounts.value = null
  } finally {
    accountLoading.value = false
  }
}

// ============ Tab 4. 选题效能 ============
const topics = ref<TopicEfficiencyView | null>(null)
const topicLoading = ref(false)
async function loadTopics() {
  topicLoading.value = true
  try {
    topics.value = await getTopicEfficiency()
  } catch {
    topics.value = null
  } finally {
    topicLoading.value = false
  }
}

// ============ Tab 5. 人性钩子（items 透视：行=人性, 列=情绪, 单元=avgScore） ============
const hook = ref<HumanHookView | null>(null)
const hookLoading = ref(false)
const hookRows = ref<{ driver: string; cells: Record<string, number | null> }[]>([])
const hookEmotions = ref<string[]>([])
const hookMax = ref(0)
async function loadHook() {
  hookLoading.value = true
  try {
    hook.value = await getHumanHook()
    const items = hook.value.items
    const emotions = Array.from(new Set(items.map((i) => i.emotion)))
    const drivers = Array.from(new Set(items.map((i) => i.driver)))
    hookEmotions.value = emotions
    const rows = drivers.map((d) => ({
      driver: d,
      cells: emotions.reduce(
        (acc: Record<string, number | null>, e) => {
          const it = items.find((i) => i.driver === d && i.emotion === e)
          acc[e] = it ? it.avgConversion : null
          return acc
        },
        {},
      ),
    }))
    hookRows.value = rows
    hookMax.value = Math.max(
      0,
      ...rows.flatMap((r) => Object.values(r.cells).filter((v): v is number => v != null)),
    )
  } catch {
    hook.value = null
  } finally {
    hookLoading.value = false
  }
}
function hookScore(row: { cells?: Record<string, number | null> }, emotion: string): number | null {
  return row.cells && emotion in row.cells ? row.cells[emotion] : null
}
function hookClass(score: number): string {
  if (hookMax.value <= 0) return 'hook-low'
  const r = score / hookMax.value
  if (r >= 0.66) return 'hook-hot'
  if (r >= 0.33) return 'hook-mid'
  return 'hook-low'
}

// ============ Tab 6. 看板配置 ============
const dashboards = ref<DashboardConfig[]>([])
const dashLoading = ref(false)
async function loadDashboards() {
  dashLoading.value = true
  try {
    dashboards.value = await listDashboards()
  } catch {
    dashboards.value = []
  } finally {
    dashLoading.value = false
  }
}
const cfgDialog = ref(false)
const cfgSubmitting = ref(false)
const cfgEditing = ref<DashboardConfig | null>(null)
const cfgForm = reactive({ name: '', widgetsText: '[]' })
function openCreateCfg() {
  cfgEditing.value = null
  cfgForm.name = ''
  cfgForm.widgetsText = '[]'
  cfgDialog.value = true
}
function openEditCfg(d: DashboardConfig) {
  cfgEditing.value = d
  cfgForm.name = d.name
  cfgForm.widgetsText = JSON.stringify(d.widgets ?? [], null, 2)
  cfgDialog.value = true
}
async function saveCfg() {
  if (!cfgForm.name.trim()) return ElMessage.warning('看板名称必填')
  let widgets: unknown = []
  try {
    widgets = JSON.parse(cfgForm.widgetsText.trim())
  } catch {
    return ElMessage.error('widgets 不是合法 JSON')
  }
  cfgSubmitting.value = true
  try {
    if (cfgEditing.value) {
      await updateDashboard(cfgEditing.value.id, { name: cfgForm.name.trim(), widgets: widgets as never })
      ElMessage.success('看板已更新')
    } else {
      await createDashboard({ name: cfgForm.name.trim(), widgets: widgets as never })
      ElMessage.success('看板已创建')
    }
    cfgDialog.value = false
    await loadDashboards()
  } catch {
    // 拦截器已提示
  } finally {
    cfgSubmitting.value = false
  }
}
async function removeCfg(d: DashboardConfig) {
  try {
    await deleteDashboard(d.id)
    ElMessage.success('已删除')
    await loadDashboards()
  } catch {
    // 拦截器已提示
  }
}

onMounted(() => {
  loadOverview()
})
</script>

<template>
  <section class="dashboard-view" aria-label="M 决策看板">
    <el-alert
      type="info"
      :closable="false"
      show-icon
      class="compliance-alert"
      title="M 决策看板：核心指标卡 / 全链路漏斗 / 账号对比 / 选题效能 / 人性钩子矩阵 / 看板配置；tenantId 由统一拦截器注入。"
    />
    <el-tabs v-model="activeTab" type="border-card" aria-label="M 功能分区">
      <!-- ===== 1. 经营概览 ===== -->
      <el-tab-pane name="overview">
        <template #label><span aria-label="经营概览标签页">经营概览</span></template>
        <div class="filter-bar" aria-label="概览操作栏">
          <el-button type="primary" @click="loadOverview" :loading="overviewLoading" aria-label="加载经营概览">加载经营概览</el-button>
        </div>
        <div v-if="overview" class="metric-grid">
          <el-card v-for="c in cardList" :key="c.key" shadow="never" class="metric">
            <div class="m-label">{{ c.label }}</div>
            <div class="m-value">{{ formatCard(c.value, c.kind) }}</div>
          </el-card>
        </div>
        <el-table v-if="overview" :data="overview.trend" border class="trend-table" aria-label="近 7 日趋势">
          <el-table-column prop="date" label="日期" width="130" />
          <el-table-column label="播放" min-width="120">
            <template #default="{ row }">{{ formatAmount((row as OverviewView['trend'][number]).play) }}</template>
          </el-table-column>
          <el-table-column label="互动" min-width="120">
            <template #default="{ row }">{{ formatAmount((row as OverviewView['trend'][number]).interact) }}</template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!overviewLoading && !overview" description="点击「加载经营概览」查看核心指标与趋势" />
      </el-tab-pane>

      <!-- ===== 2. 全链路漏斗 ===== -->
      <el-tab-pane name="funnel">
        <template #label><span aria-label="全链路漏斗标签页">全链路漏斗</span></template>
        <div class="filter-bar" aria-label="漏斗操作栏">
          <el-button type="primary" @click="loadFunnel" :loading="funnelLoading" aria-label="加载全链路漏斗">加载全链路漏斗</el-button>
        </div>
        <div v-if="funnel" class="funnel-wrap" aria-label="漏斗图">
          <div v-for="(s, i) in funnel.stages" :key="i" class="funnel-row">
            <div class="f-name">{{ s.name }}</div>
            <el-progress :percentage="funnelPct(s.value)" :stroke-width="18" />
            <div class="f-meta">值 {{ formatAmount(s.value) }}</div>
          </div>
          <div class="funnel-foot">
            <span>总投入 {{ formatAmount(funnel.spend) }}</span>
            <span>ROI {{ funnel.roi }}</span>
          </div>
        </div>
        <el-empty v-if="!funnelLoading && !funnel" description="点击「加载全链路漏斗」查看 内容→分发→触达→互动→转化→收益" />
      </el-tab-pane>

      <!-- ===== 3. 账号对比 ===== -->
      <el-tab-pane name="account">
        <template #label><span aria-label="账号对比标签页">账号对比</span></template>
        <div class="filter-bar" aria-label="账号对比操作栏">
          <el-button type="primary" @click="loadAccounts" :loading="accountLoading" aria-label="加载账号对比">加载账号对比</el-button>
        </div>
        <el-table v-if="accounts" :data="accounts.accounts" border aria-label="账号对比">
          <el-table-column prop="accountId" label="账号ID" width="90" />
          <el-table-column prop="nickname" label="昵称" min-width="140" />
          <el-table-column prop="platform" label="平台" width="110" />
          <el-table-column prop="fansCount" label="粉丝" width="110" />
          <el-table-column prop="publishCount" label="发布数" width="100" />
          <el-table-column label="发布占比" width="120">
            <template #default="{ row }">{{ ((row as AccountCompareView['accounts'][number]).playShare * 100).toFixed(2) }}%</template>
          </el-table-column>
        </el-table>
        <div v-if="accounts" class="totals-line">
          合计：粉丝 {{ formatAmount(accounts.totals.fansCount) }} · 发布 {{ accounts.totals.publishCount }} · 播放 {{ formatAmount(accounts.totals.play) }}
        </div>
        <el-empty v-if="!accountLoading && !accounts" description="点击「加载账号对比」查看多账号经营差异" />
      </el-tab-pane>

      <!-- ===== 4. 选题效能 ===== -->
      <el-tab-pane name="topic">
        <template #label><span aria-label="选题效能标签页">选题效能</span></template>
        <div class="filter-bar" aria-label="选题效能操作栏">
          <el-button type="primary" @click="loadTopics" :loading="topicLoading" aria-label="加载选题效能">加载选题效能</el-button>
        </div>
        <el-table v-if="topics" :data="topics.items" border aria-label="选题效能榜">
          <el-table-column prop="driver" label="人性驱动" width="130" />
          <el-table-column prop="emotion" label="情绪" width="120" />
          <el-table-column prop="topicCount" label="选题数" width="100" />
          <el-table-column prop="avgScore" label="均分" width="100" />
          <el-table-column prop="avgPlay" label="均播" width="120" />
          <el-table-column prop="avgConversion" label="均转化" min-width="120" />
        </el-table>
        <el-empty v-if="!topicLoading && !topics" description="点击「加载选题效能」查看 人性×情绪 选题产出对比" />
      </el-tab-pane>

      <!-- ===== 5. 人性钩子 ===== -->
      <el-tab-pane name="hook">
        <template #label><span aria-label="人性钩子标签页">人性钩子</span></template>
        <div class="filter-bar" aria-label="人性钩子操作栏">
          <el-button type="primary" @click="loadHook" :loading="hookLoading" aria-label="加载人性钩子">加载人性钩子矩阵</el-button>
        </div>
        <el-table v-if="hookRows.length" :data="hookRows" border class="hook-table" aria-label="人性钩子矩阵">
          <el-table-column prop="driver" label="人性\情绪" width="130" fixed />
          <el-table-column v-for="e in hookEmotions" :key="e" :label="e" align="center">
            <template #default="{ row }">
              <span :class="hookClass(hookScore(row, e) ?? 0)" class="hook-cell">
                {{ hookScore(row, e) ?? '-' }}
              </span>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!hookLoading && !hookRows.length" description="点击「加载人性钩子」查看 人性×情绪 转化率矩阵（单元值=平均转化率，由真实数据透视）" />
      </el-tab-pane>

      <!-- ===== 6. 看板配置 ===== -->
      <el-tab-pane name="config">
        <template #label><span aria-label="看板配置标签页">看板配置</span></template>
        <div class="filter-bar" aria-label="看板配置操作栏">
          <el-button type="primary" @click="openCreateCfg" aria-label="新增看板">新增看板</el-button>
          <el-button @click="loadDashboards" :loading="dashLoading" aria-label="刷新看板列表">刷新</el-button>
        </div>
        <el-table :data="dashboards" border v-loading="dashLoading" aria-label="看板配置列表">
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="name" label="看板名称" min-width="200" />
          <el-table-column label="组件数" width="100">
            <template #default="{ row }">{{ ((row as DashboardConfig).widgets || []).length }}</template>
          </el-table-column>
          <el-table-column label="操作" width="160" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openEditCfg(row as DashboardConfig)" :aria-label="`编辑看板 ${(row as DashboardConfig).id}`">编辑</el-button>
              <el-button link type="danger" @click="removeCfg(row as DashboardConfig)" :aria-label="`删除看板 ${(row as DashboardConfig).id}`">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!dashLoading && !dashboards.length" description="暂无看板配置，点击「新增看板」" />
      </el-tab-pane>
    </el-tabs>

    <!-- 看板配置弹窗 -->
    <el-dialog v-model="cfgDialog" :title="cfgEditing ? '编辑看板' : '新增看板'" aria-label="看板配置弹窗" width="560px">
      <el-form label-width="80px" @submit.prevent>
        <el-form-item label="名称" required>
          <el-input v-model="cfgForm.name" aria-label="看板名称" />
        </el-form-item>
        <el-form-item label="widgets">
          <el-input
            v-model="cfgForm.widgetsText"
            type="textarea"
            :rows="8"
            placeholder='JSON 数组，如 [{"type":"kpi","metric":"gmv"}]'
            aria-label="看板widgets"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="cfgDialog = false">取消</el-button>
        <el-button type="primary" :loading="cfgSubmitting" @click="saveCfg">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.dashboard-view {
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
.metric-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}
.metric .m-label {
  font-size: var(--text-sm);
  color: var(--el-text-color-secondary);
}
.metric .m-value {
  font-size: var(--text-xl);
  font-weight: 700;
  margin-top: var(--space-1);
}
.trend-table {
  margin-top: var(--space-2);
}
.funnel-wrap {
  max-width: 760px;
}
.funnel-row {
  margin-bottom: 14px;
}
.f-name {
  font-weight: 600;
  margin-bottom: var(--space-1);
}
.f-meta {
  font-size: var(--text-sm);
  color: var(--el-text-color-secondary);
  margin-top: var(--space-1);
}
.funnel-foot {
  display: flex;
  gap: var(--space-6);
  margin-top: var(--space-2);
  font-weight: 600;
}
.totals-line {
  margin-top: var(--space-2);
  font-weight: 600;
}
.hook-cell {
  display: inline-block;
  min-width: 38px;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  font-weight: 600;
}
.hook-hot {
  background: var(--app-danger-500);
  color: var(--app-neutral-0);
}
.hook-mid {
  background: var(--app-warning-50);
  color: var(--app-warning-600);
}
.hook-low {
  background: var(--app-neutral-100);
  color: var(--app-neutral-400);
}
</style>
