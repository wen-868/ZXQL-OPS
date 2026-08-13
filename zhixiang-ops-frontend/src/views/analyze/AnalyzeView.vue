<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getAnalysisReport,
  getAnalysisTask,
  listInsights,
  submitAnalysis,
  type AnalysisInsight,
  type AnalysisPayload,
  type AnalysisReport,
  type AnalysisTask,
  type HumanInsight,
  type InsightQuery,
} from '@/api/analyze'
import { formatCount, formatDateTime } from '@/utils/format'
import {
  analysisStatusMeta,
  driverColors,
  driverLabels,
  driverOptions,
  emotionColors,
  emotionLabels,
  emotionOptions,
  sourceOptions,
} from './analyzeMaps'
import InsightFormDrawer from './InsightFormDrawer.vue'

// ============ 1. 分析任务 ============
const taskForm = reactive<AnalysisPayload>({
  source: 'comments',
  platform: undefined,
  commentLimit: 200,
})
const taskSubmitting = ref(false)
const tasks = ref<AnalysisTask[]>([])
const MAX_POLL = 20
const pollTimers: Record<number, ReturnType<typeof setInterval>> = {}

async function handleSubmitTask() {
  taskSubmitting.value = true
  try {
    const res = await submitAnalysis({
      source: taskForm.source,
      platform: taskForm.platform || undefined,
      commentLimit: taskForm.commentLimit,
    })
    ElMessage.success(`已发起分析任务 #${res.taskId}`)
    startPoll(res.taskId)
  } catch {
    // 拦截器已提示
  } finally {
    taskSubmitting.value = false
  }
}
function startPoll(id: number) {
  let times = 0
  pollTimers[id] = setInterval(async () => {
    times += 1
    try {
      const task = await getAnalysisTask(id)
      const exist = tasks.value.find((t) => t.id === id)
      if (exist) Object.assign(exist, task)
      else tasks.value.unshift(task)
      if (task.status === 'done' || task.status === 'failed' || times >= MAX_POLL) {
        stopPoll(id)
        if (task.status === 'done') loadReport()
      }
    } catch {
      stopPoll(id)
    }
  }, 3000)
}
function stopPoll(id: number) {
  if (pollTimers[id]) {
    clearInterval(pollTimers[id])
    delete pollTimers[id]
  }
}
const currentTask = computed<AnalysisTask | undefined>(() => tasks.value[0])

// ============ 2. 分析报告 ============
const reportLoading = ref(false)
const report = ref<AnalysisReport | null>(null)
const driverEntries = computed(() =>
  report.value
    ? Object.entries(report.value.driverCounts).sort(
        (a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0),
      )
    : [],
)
const emotionEntries = computed(() =>
  report.value
    ? Object.entries(report.value.emotionScores).sort(
        (a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0),
      )
    : [],
)
const maxDriver = computed(() =>
  driverEntries.value.reduce((m, e) => Math.max(m, Number(e[1]) || 0), 0),
)
const maxEmotion = computed(() =>
  emotionEntries.value.reduce((m, e) => Math.max(m, Number(e[1]) || 0), 0),
)

async function loadReport() {
  reportLoading.value = true
  try {
    report.value = await getAnalysisReport()
  } catch {
    // 拦截器已提示
  } finally {
    reportLoading.value = false
  }
}

// ============ 3. 洞察知识库 ============
const insightLoading = ref(false)
const insights = ref<HumanInsight[]>([])
const insightTotal = ref(0)
const insightPage = ref(1)
const insightPageSize = ref(20)
const insightFilters = reactive<InsightQuery>({
  driver: undefined,
  emotion: undefined,
  category: undefined,
})
async function loadInsights() {
  insightLoading.value = true
  try {
    const params: InsightQuery = {
      page: insightPage.value,
      pageSize: insightPageSize.value,
    }
    if (insightFilters.driver) params.driver = insightFilters.driver
    if (insightFilters.emotion) params.emotion = insightFilters.emotion
    if (insightFilters.category) params.category = insightFilters.category
    const res = await listInsights(params)
    insights.value = res.list
    insightTotal.value = res.total
  } catch {
    // 拦截器已提示
  } finally {
    insightLoading.value = false
  }
}
function handleInsightFilter() {
  insightPage.value = 1
  loadInsights()
}
function handleInsightPageChange(page: number) {
  insightPage.value = page
  loadInsights()
}
function handleInsightSizeChange(size: number) {
  insightPageSize.value = size
  insightPage.value = 1
  loadInsights()
}

// 洞察卡片标签渲染
function insightDriverTags(item: AnalysisInsight): Array<{ label: string; color: string }> {
  return [
    { label: driverLabels[item.driver], color: driverColors[item.driver] },
    { label: emotionLabels[item.emotion], color: emotionColors[item.emotion] },
  ]
}

const insightDrawer = ref(false)

onBeforeUnmount(() => {
  Object.keys(pollTimers).forEach((k) => clearInterval(pollTimers[Number(k)]))
})
</script>

<template>
  <div class="page-container" aria-label="D 人性分析与洞察">
    <!-- 页面标题区 -->
    <div class="page-header">
      <div>
        <h1 class="page-title">D·人性分析</h1>
        <p class="page-subtitle">7×6 人性情绪聚类分析，基于脱敏评论生成洞察结论，驱动选题与脚本创作</p>
      </div>
    </div>

    <el-tabs type="border-card" aria-label="人性分析功能分区">
      <!-- ===== 1. 分析任务 ===== -->
      <el-tab-pane label="分析任务">
        <template #label><span aria-label="分析任务标签页">分析任务</span></template>
        <div class="card filter-card">
          <el-form :model="taskForm" inline @submit.prevent>
            <el-form-item label="数据源">
              <el-select v-model="taskForm.source" size="default" style="width:130px" aria-label="数据源">
                <el-option v-for="opt in sourceOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="平台">
              <el-input v-model="taskForm.platform" placeholder="可选，如 douyin" size="default" style="width:160px" aria-label="平台" clearable />
            </el-form-item>
            <el-form-item label="评论上限">
              <el-input-number v-model="taskForm.commentLimit" :min="1" :max="5000" controls-position="right" size="default" style="width:130px" aria-label="评论上限" />
            </el-form-item>
          </el-form>
          <div class="filter-actions">
            <el-button type="primary" :loading="taskSubmitting" @click="handleSubmitTask">发起分析</el-button>
            <el-button :loading="reportLoading" @click="loadReport">刷新报告</el-button>
          </div>
        </div>

        <div class="section-header">
          <h3 class="section-title">当前任务概览</h3>
        </div>
        <el-empty v-if="!currentTask" description="暂无分析任务，先发起一个吧" />
        <div v-else class="card">
          <el-descriptions :column="3" border>
            <el-descriptions-item label="任务ID">{{ currentTask.id }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="analysisStatusMeta[currentTask.status].type" size="small">{{ analysisStatusMeta[currentTask.status].label }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="进度">
              <el-progress :percentage="Math.round((currentTask.progress || 0) * 100)" :status="currentTask.status === 'failed' ? 'exception' : undefined" />
            </el-descriptions-item>
            <el-descriptions-item label="评论总量">{{ formatCount(currentTask.totalComments) }}</el-descriptions-item>
            <el-descriptions-item label="模型">{{ currentTask.modelUsed || '-' }}</el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ formatDateTime(currentTask.createdAt) }}</el-descriptions-item>
          </el-descriptions>
        </div>

        <div class="section-header">
          <h3 class="section-title">历史任务</h3>
        </div>
        <el-table v-loading="taskSubmitting" :data="tasks" stripe aria-label="分析任务列表" row-key="id">
          <template #empty>
            <el-empty description="暂无历史任务" />
          </template>
          <el-table-column prop="id" label="任务ID" width="90" />
          <el-table-column prop="source" label="数据源" width="90">
            <template #default="{ row }">{{ sourceOptions.find((s) => s.value === row.source)?.label || row.source }}</template>
          </el-table-column>
          <el-table-column label="状态" width="110">
            <template #default="{ row }">
              <el-tag :type="analysisStatusMeta[row.status as keyof typeof analysisStatusMeta].type" size="small">{{ analysisStatusMeta[row.status as keyof typeof analysisStatusMeta].label }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="进度" min-width="160">
            <template #default="{ row }">
              <el-progress :percentage="Math.round((row.progress || 0) * 100)" :status="row.status === 'failed' ? 'exception' : undefined" />
            </template>
          </el-table-column>
          <el-table-column prop="totalComments" label="评论量" width="100" align="right">
            <template #default="{ row }">{{ formatCount(row.totalComments) }}</template>
          </el-table-column>
          <el-table-column prop="createdAt" label="创建时间" min-width="170" show-overflow-tooltip>
            <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- ===== 2. 分析报告 ===== -->
      <el-tab-pane label="分析报告">
        <template #label><span aria-label="分析报告标签页">分析报告</span></template>
        <el-empty v-if="!reportLoading && !report" description="先发起分析任务，生成报告后在此查看" />
        <div v-else v-loading="reportLoading" class="report-wrap">
          <el-alert type="info" :closable="false" show-icon class="compliance-alert" title="聚合洞察结论，由 clean 评论脱敏后汇总得出，不留存单条个人信息。" />
          <!-- 人性分布 -->
          <div class="section-header"><h3 class="section-title">人性分布</h3></div>
          <div class="bar-list">
            <div v-for="[d, n] in driverEntries" :key="d" class="bar-row">
              <span class="bar-label">{{ driverLabels[d as keyof typeof driverLabels] }}</span>
              <div class="bar-track">
                <div class="bar-fill" :style="{ width: maxDriver ? `${(Number(n) / maxDriver) * 100}%` : '0%', background: driverColors[d as keyof typeof driverColors] }" />
              </div>
              <span class="bar-num">{{ formatCount(Number(n)) }}</span>
            </div>
          </div>
          <!-- 情绪强度 -->
          <div class="section-header"><h3 class="section-title">情绪强度</h3></div>
          <div class="bar-list">
            <div v-for="[e, s] in emotionEntries" :key="e" class="bar-row">
              <span class="bar-label">{{ emotionLabels[e as keyof typeof emotionLabels] }}</span>
              <div class="bar-track">
                <div class="bar-fill" :style="{ width: maxEmotion ? `${(Number(s) / maxEmotion) * 100}%` : '0%', background: emotionColors[e as keyof typeof emotionColors] }" />
              </div>
              <span class="bar-num">{{ formatCount(Number(s)) }}</span>
            </div>
          </div>
          <!-- top 高亮 -->
          <div class="top-wrap">
            <div>
              <span class="top-title">主导人性：</span>
              <el-tag v-for="d in report?.topDrivers" :key="d" :color="driverColors[d]" size="small" class="top-tag">{{ driverLabels[d] }}</el-tag>
            </div>
            <div>
              <span class="top-title">主导情绪：</span>
              <el-tag v-for="e in report?.topEmotions" :key="e" :color="emotionColors[e]" size="small" class="top-tag">{{ emotionLabels[e] }}</el-tag>
            </div>
          </div>
          <!-- 洞察卡片 -->
          <div class="section-header"><h3 class="section-title">洞察结论（{{ report?.insights.length || 0 }}）</h3></div>
          <el-empty v-if="!report?.insights.length" description="暂无洞察结论" />
          <div v-else class="insight-cards">
            <div v-for="(ins, i) in report?.insights" :key="i" class="card insight-card">
              <div class="insight-head"><span class="insight-title">{{ ins.title }}</span></div>
              <p class="insight-content">{{ ins.content }}</p>
              <div class="insight-tags">
                <el-tag v-for="t in insightDriverTags(ins)" :key="t.label" :color="t.color" size="small" class="top-tag">{{ t.label }}</el-tag>
                <el-tag v-for="tg in ins.tags" :key="tg" size="small" type="info">{{ tg }}</el-tag>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- ===== 3. 洞察知识库 ===== -->
      <el-tab-pane label="洞察知识库">
        <template #label><span aria-label="洞察知识库标签页">洞察知识库</span></template>
        <el-alert type="info" :closable="false" show-icon class="compliance-alert" title="合规说明：仅存聚合洞察结论，不留存单条个人信息。" />
        <div class="card filter-card">
          <el-form :model="insightFilters" inline @submit.prevent>
            <el-form-item label="人性">
              <el-select v-model="insightFilters.driver" placeholder="全部" clearable size="default" style="width:130px" aria-label="人性筛选" @change="handleInsightFilter">
                <el-option v-for="opt in driverOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="情绪">
              <el-select v-model="insightFilters.emotion" placeholder="全部" clearable size="default" style="width:130px" aria-label="情绪筛选" @change="handleInsightFilter">
                <el-option v-for="opt in emotionOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="分类">
              <el-input v-model="insightFilters.category" placeholder="可选" clearable size="default" style="width:140px" aria-label="分类筛选" @keyup.enter="handleInsightFilter" @change="handleInsightFilter" />
            </el-form-item>
          </el-form>
          <div class="filter-actions">
            <el-button type="primary" @click="handleInsightFilter">查询</el-button>
            <el-button type="success" @click="insightDrawer = true">+ 新增洞察</el-button>
          </div>
        </div>
        <el-table v-loading="insightLoading" :data="insights" stripe aria-label="洞察知识库列表" row-key="id">
          <template #empty>
            <el-empty description="暂无洞察数据" />
          </template>
          <el-table-column prop="title" label="标题" min-width="180" show-overflow-tooltip />
          <el-table-column prop="content" label="内容" min-width="220" show-overflow-tooltip />
          <el-table-column label="人性/情绪" width="150">
            <template #default="{ row }">
              <el-tag :color="driverColors[row.driver as keyof typeof driverColors]" size="small" class="top-tag">{{ driverLabels[row.driver as keyof typeof driverLabels] }}</el-tag>
              <el-tag :color="emotionColors[row.emotion as keyof typeof emotionColors]" size="small" class="top-tag">{{ emotionLabels[row.emotion as keyof typeof emotionLabels] }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="category" label="分类" width="100" />
          <el-table-column prop="usageCount" label="使用次数" width="90" align="right">
            <template #default="{ row }">{{ formatCount(row.usageCount) }}</template>
          </el-table-column>
          <el-table-column prop="createdAt" label="创建时间" min-width="170" show-overflow-tooltip>
            <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!insightLoading && insights.length === 0" description="暂无数据" />
        <div class="table-pagination" v-if="insightTotal > 0">
          <el-pagination
            v-model:current-page="insightPage"
            v-model:page-size="insightPageSize"
            :total="insightTotal"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next"
            background
            aria-label="洞察分页"
            @current-change="handleInsightPageChange"
            @size-change="handleInsightSizeChange"
          />
        </div>
        <InsightFormDrawer v-model="insightDrawer" @saved="loadInsights" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
/* 页面标题区 */
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-lg); }
.page-title { font-size: var(--text-2xl); font-weight: 700; color: var(--el-text-color-primary); margin: 0 0 4px 0; }
.page-subtitle { font-size: var(--text-base); color: var(--el-text-color-secondary); margin: 0; }

/* 区块标题 */
.section-header { margin: var(--space-md) 0 var(--space-sm); }
.section-title { font-size: var(--text-md); font-weight: 600; color: var(--el-text-color-primary); margin: 0; }

/* 筛选区 */
.filter-card { padding: var(--space-lg); margin-bottom: var(--space-md); }
.filter-card .el-form { margin-bottom: 12px; }
.filter-actions { display: flex; gap: var(--space-sm); }
.compliance-alert { margin-bottom: var(--space-md); }

/* 报告区域 */
.report-wrap { min-height: 120px; }

/* 条形图 */
.bar-list { display: flex; flex-direction: column; gap: var(--space-sm); }
.bar-row { display: flex; align-items: center; gap: var(--space-md); }
.bar-label { width: 64px; text-align: right; color: var(--el-text-color-regular); font-size: var(--text-base-sm); }
.bar-track { flex: 1; background: var(--el-fill-color); border-radius: var(--radius-md); height: 18px; overflow: hidden; }
.bar-fill { height: 100%; border-radius: var(--radius-md); transition: width 0.4s ease; }
.bar-num { width: 60px; text-align: right; font-size: var(--text-base-sm); color: var(--el-text-color-secondary); }

/* top 高亮区 */
.top-wrap { margin: var(--space-md) 0; display: flex; flex-direction: column; gap: var(--space-sm); }
.top-title { color: var(--el-text-color-primary); font-size: var(--text-base); }
.top-tag { margin-right: var(--space-sm); border: none; color: var(--el-bg-color); }

/* 洞察卡片 */
.insight-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--space-md); }
.insight-card { height: 100%; }
.insight-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-sm); }
.insight-title { font-weight: 600; color: var(--el-text-color-primary); font-size: var(--text-base); }
.insight-content { margin: 0 0 var(--space-sm); color: var(--el-text-color-regular); font-size: var(--text-base-sm); line-height: 1.6; }
.insight-tags { display: flex; flex-wrap: wrap; gap: var(--space-sm); }

/* 分页 */
.table-pagination { display: flex; justify-content: flex-end; padding-top: var(--space-md); }
</style>
