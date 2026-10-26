<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  collectFromSource,
  controlCollectTask,
  createSource,
  deleteCompetitor,
  deleteSource,
  getCollectTask,
  getHot,
  listCollectedComments,
  listCollectTasks,
  listCompetitors,
  listSources,
  mineKeywords,
  reviewComment,
  reviewCommentsBatch,
  submitCollect,
  toggleMonitor,
  updateSource,
  type CleaningOptions,
  type CollectControlAction,
  type CollectedComment,
  type CollectPayload,
  type CollectSource,
  type CollectStatus,
  type CollectTask,
  type CommentQuery,
  type Competitor,
  type HotSnapshot,
  type HotType,
  type Platform,
  type ReviewStatus,
  type SourcePatch,
  type SourcePayload,
} from '@/api/intel'
import { formatCount, formatDateTime } from '@/utils/format'
import {
  cleaningOptionLabels,
  collectStatusMeta,
  hotTypeOptions,
  platformLabels,
  platformOptions,
  reviewStatusMeta,
  reviewStatusOptions,
  sourceLevelOptions,
  sourceModeLabels,
  sourceModeOptions,
  sourceTypeLabels,
  sourceTypeOptions,
} from './intelMaps'
import CompetitorFormDrawer from './CompetitorFormDrawer.vue'

// ============ 1. 采集源配置 ============
const sourceLoading = ref(false)
const sources = ref<CollectSource[]>([])
const sourceDialog = ref(false)
const editingSource = ref<CollectSource | null>(null)
const sourceSaving = ref(false)
const sourceCollecting = ref<Set<number>>(new Set())

const sourceForm = reactive<SourcePayload>({
  name: '',
  platform: 'douyin',
  sourceType: 'comment',
  target: '',
  mode: 'web',
  rateLimit: 10,
  cleaning: {
    dedup: true,
    piiStrip: true,
    adFilter: true,
    reviewRequired: false,
  },
})

async function loadSources() {
  sourceLoading.value = true
  try {
    sources.value = await listSources()
  } catch {
    // 拦截器已提示
  } finally {
    sourceLoading.value = false
  }
}

function resetSourceForm() {
  sourceForm.name = ''
  sourceForm.platform = 'douyin'
  sourceForm.sourceType = 'comment'
  sourceForm.target = ''
  sourceForm.mode = 'web'
  sourceForm.rateLimit = 10
  sourceForm.cleaning = {
    dedup: true,
    piiStrip: true,
    adFilter: true,
    reviewRequired: false,
  }
}

function openCreateSource() {
  editingSource.value = null
  resetSourceForm()
  sourceDialog.value = true
}

function openEditSource(row: CollectSource) {
  editingSource.value = row
  sourceForm.name = row.name
  sourceForm.platform = row.platform
  sourceForm.sourceType = row.sourceType
  sourceForm.target = row.target
  sourceForm.mode = row.mode
  sourceForm.rateLimit = row.rateLimit
  sourceForm.cleaning = { ...(row.cleaning ?? {}) }
  sourceDialog.value = true
}

async function handleSaveSource() {
  if (!sourceForm.name.trim() || !sourceForm.target.trim()) {
    ElMessage.warning('请填写名称与采集目标')
    return
  }
  sourceSaving.value = true
  try {
    if (editingSource.value) {
      await updateSource(editingSource.value.id, { ...sourceForm } as SourcePatch)
      ElMessage.success('已更新采集源')
    } else {
      await createSource({ ...sourceForm })
      ElMessage.success('已创建采集源')
    }
    sourceDialog.value = false
    loadSources()
  } catch {
    // 拦截器已提示
  } finally {
    sourceSaving.value = false
  }
}

async function handleToggleSourceEnabled(row: CollectSource) {
  try {
    const updated = await updateSource(row.id, { enabled: !row.enabled })
    row.enabled = updated.enabled
    ElMessage.success(updated.enabled ? '已启用' : '已停用')
  } catch {
    // 拦截器已提示
  }
}

async function handleDeleteSource(row: CollectSource) {
  try {
    await ElMessageBox.confirm(`确认删除采集源「${row.name}」？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  try {
    await deleteSource(row.id)
    ElMessage.success('已删除')
    loadSources()
  } catch {
    // 拦截器已提示
  }
}

async function handleCollectFromSource(row: CollectSource) {
  sourceCollecting.value.add(row.id)
  try {
    const res = await collectFromSource(row.id)
    ElMessage.success(`已发起采集任务 #${res.taskId}，可在「采集任务」页查看`)
    row.lastCollectedAt = new Date().toISOString()
    loadSources()
  } catch {
    // 拦截器已提示
  } finally {
    sourceCollecting.value.delete(row.id)
  }
}

// ============ 2. 竞品库 ============
const competitorLoading = ref(false)
const competitorError = ref<string | null>(null)
const competitors = ref<Competitor[]>([])
const competitorDrawer = ref(false)
const editingCompetitor = ref<Competitor | null>(null)
const monitorSwitching = ref<Set<number>>(new Set())

async function loadCompetitors() {
  competitorLoading.value = true
  competitorError.value = null
  try {
    competitors.value = await listCompetitors()
  } catch {
    competitorError.value = '竞品列表加载失败，请稍后重试'
  } finally {
    competitorLoading.value = false
  }
}
function openCreateCompetitor() {
  editingCompetitor.value = null
  competitorDrawer.value = true
}
function openEditCompetitor(row: Competitor) {
  editingCompetitor.value = row
  competitorDrawer.value = true
}
async function handleToggleMonitor(row: Competitor) {
  monitorSwitching.value.add(row.id)
  try {
    const updated = await toggleMonitor(row.id)
    row.monitorEnabled = updated.monitorEnabled
    ElMessage.success(updated.monitorEnabled ? '已开启监控' : '已关闭监控')
  } catch {
    // 拦截器已提示；开关会自动回弹
  } finally {
    monitorSwitching.value.delete(row.id)
  }
}
async function handleDeleteCompetitor(row: Competitor) {
  try {
    await ElMessageBox.confirm(`确认删除竞品「${row.name}」？此操作为软删除。`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  try {
    await deleteCompetitor(row.id)
    ElMessage.success('已删除')
    loadCompetitors()
  } catch {
    // 拦截器已提示
  }
}

// ============ 3. 采集任务 ============
const collectForm = reactive<CollectPayload>({
  type: 'comment',
  target: '',
  platform: 'douyin',
  sourceLevel: 'L1',
})
const collectSubmitting = ref(false)
const taskLoading = ref(false)
const tasks = ref<CollectTask[]>([])
const taskTotal = ref(0)
const taskPage = ref(1)
const taskPageSize = ref(20)
const MAX_POLL = 20
const pollTimers: Record<number, ReturnType<typeof setInterval>> = {}

async function handleSubmitCollect() {
  if (!collectForm.target.trim()) {
    ElMessage.warning('请输入采集目标')
    return
  }
  collectSubmitting.value = true
  try {
    await submitCollect({ ...collectForm, target: collectForm.target.trim() })
    ElMessage.success('已发起采集任务')
    loadTasks()
  } catch {
    // 拦截器已提示
  } finally {
    collectSubmitting.value = false
  }
}

async function loadTasks() {
  taskLoading.value = true
  try {
    const res = await listCollectTasks({ page: taskPage.value, pageSize: taskPageSize.value })
    tasks.value = res.list
    taskTotal.value = res.total
    // 对运行中的任务开启轮询刷新
    for (const t of res.list) {
      if (t.status === 'pending' || t.status === 'running') startPoll(t.id)
    }
  } catch {
    // 拦截器已提示
  } finally {
    taskLoading.value = false
  }
}

function startPoll(taskId: number) {
  if (pollTimers[taskId]) return
  let times = 0
  pollTimers[taskId] = setInterval(async () => {
    times += 1
    try {
      const prog = await getCollectTask(taskId)
      const row = tasks.value.find((t) => t.id === taskId)
      if (row) {
        row.status = prog.status
        row.progress = prog.progress
        row.collectedCount = prog.collectedCount
        row.errorMsg = prog.errorMsg
      }
      if (prog.status === 'done' || prog.status === 'failed' || prog.status === 'cancelled' || times >= MAX_POLL) {
        stopPoll(taskId)
      }
    } catch {
      stopPoll(taskId)
    }
  }, 3000)
}
function stopPoll(taskId: number) {
  if (pollTimers[taskId]) {
    clearInterval(pollTimers[taskId])
    delete pollTimers[taskId]
  }
}

async function handleControlTask(row: CollectTask, action: CollectControlAction) {
  const labels: Record<CollectControlAction, string> = {
    pause: '暂停',
    resume: '恢复',
    cancel: '取消',
    retry: '重试',
  }
  if (action === 'cancel') {
    try {
      await ElMessageBox.confirm(`确认取消任务 #${row.id}？`, '取消确认', {
        type: 'warning',
        confirmButtonText: '取消任务',
        cancelButtonText: '再想想',
      })
    } catch {
      return
    }
  }
  try {
    await controlCollectTask(row.id, action)
    ElMessage.success(`已${labels[action]}`)
    loadTasks()
  } catch {
    // 拦截器已提示
  }
}

function taskActions(row: CollectTask): CollectControlAction[] {
  if (row.status === 'pending' || row.status === 'running') return ['pause', 'cancel']
  if (row.status === 'paused') return ['resume', 'cancel']
  if (row.status === 'failed' || row.status === 'cancelled') return ['retry']
  return []
}

function handleTaskPageChange(page: number) {
  taskPage.value = page
  loadTasks()
}
function handleTaskSizeChange(size: number) {
  taskPageSize.value = size
  taskPage.value = 1
  loadTasks()
}

// ============ 4. 采集评论 / 审核池 ============
const commentLoading = ref(false)
const comments = ref<CollectedComment[]>([])
const commentTotal = ref(0)
const commentPage = ref(1)
const commentPageSize = ref(20)
const commentFilters = reactive<CommentQuery>({
  isClean: true,
  platform: undefined,
  reviewStatus: 'pending',
})
const selectedComments = ref<number[]>([])
const batchReviewing = ref(false)
const reviewLoading = ref<Set<number>>(new Set())

async function loadComments() {
  commentLoading.value = true
  try {
    const params: CommentQuery = {
      page: commentPage.value,
      pageSize: commentPageSize.value,
      isClean: commentFilters.isClean,
    }
    if (commentFilters.platform) params.platform = commentFilters.platform
    if (commentFilters.reviewStatus) params.reviewStatus = commentFilters.reviewStatus
    const res = await listCollectedComments(params)
    comments.value = res.list
    commentTotal.value = res.total
  } catch {
    // 拦截器已提示
  } finally {
    commentLoading.value = false
  }
}
function handleCommentFilter() {
  commentPage.value = 1
  selectedComments.value = []
  loadComments()
}
function handleCommentPageChange(page: number) {
  commentPage.value = page
  loadComments()
}
function handleCommentSizeChange(size: number) {
  commentPageSize.value = size
  commentPage.value = 1
  loadComments()
}

async function handleReviewOne(row: CollectedComment, status: ReviewStatus) {
  reviewLoading.value.add(row.id)
  try {
    await reviewComment(row.id, status)
    ElMessage.success(status === 'approved' ? '已通过，可被分析消费' : '已驳回')
    loadComments()
  } catch {
    // 拦截器已提示
  } finally {
    reviewLoading.value.delete(row.id)
  }
}

async function handleReviewBatch(status: ReviewStatus) {
  if (!selectedComments.value.length) {
    ElMessage.warning('请先勾选评论')
    return
  }
  batchReviewing.value = true
  try {
    const res = await reviewCommentsBatch(selectedComments.value, status)
    ElMessage.success(`已${status === 'approved' ? '通过' : '驳回'} ${res.updated} 条`)
    selectedComments.value = []
    loadComments()
  } catch {
    // 拦截器已提示
  } finally {
    batchReviewing.value = false
  }
}

function onSelectionChange(rows: CollectedComment[]) {
  selectedComments.value = rows.map((r) => r.id)
}

// ============ 5. 关键词挖掘 ============
const keywordForm = reactive<{ platform: Platform; target: string }>({
  platform: 'douyin',
  target: '',
})
const keywordLoading = ref(false)
const keywords = ref<string[]>([])
async function handleMineKeywords() {
  if (!keywordForm.target.trim()) {
    ElMessage.warning('请输入挖掘目标/关键词')
    return
  }
  keywordLoading.value = true
  try {
    keywords.value = await mineKeywords({
      platform: keywordForm.platform,
      target: keywordForm.target.trim(),
    })
  } catch {
    // 拦截器已提示
  } finally {
    keywordLoading.value = false
  }
}

// ============ 6. 热点榜 ============
const hotForm = reactive<{ platform: Platform; hotType: HotType }>({
  platform: 'douyin',
  hotType: 'video',
})
const hotLoading = ref(false)
const hotList = ref<HotSnapshot[]>([])
async function handleGetHot() {
  hotLoading.value = true
  try {
    hotList.value = await getHot(hotForm.platform, hotForm.hotType)
  } catch {
    // 拦截器已提示
  } finally {
    hotLoading.value = false
  }
}

onMounted(() => {
  loadSources()
  loadCompetitors()
  loadTasks()
  loadComments()
  handleGetHot()
})
onBeforeUnmount(() => {
  Object.keys(pollTimers).forEach((k) => clearInterval(pollTimers[Number(k)]))
})

function cleaningTags(c?: CleaningOptions) {
  if (!c) return []
  return cleaningOptionLabels.filter((o) => c[o.key as keyof CleaningOptions]).map((o) => o.label)
}

function setCleaningOpt(key: string, v: boolean | string | number) {
  if (!sourceForm.cleaning) sourceForm.cleaning = {}
  ;(sourceForm.cleaning as Record<string, unknown>)[key] = Boolean(v)
}
</script>

<template>
  <div class="page-container" aria-label="情报采集">
    <!-- 页面标题区 -->
    <div class="page-header">
      <div>
        <h1 class="page-title">情报采集</h1>
        <p class="page-subtitle">采集源配置、任务调度与人工审核，为创作提供真实可控的情报支撑</p>
      </div>
    </div>

    <el-tabs type="border-card" aria-label="情报采集功能分区">
      <!-- ===== 1. 采集源配置 ===== -->
      <el-tab-pane label="采集源">
        <template #label><span aria-label="采集源标签页">采集源</span></template>
        <div class="pane-head">
          <el-button type="primary" @click="openCreateSource">+ 新建采集源</el-button>
        </div>
        <el-table v-loading="sourceLoading" :data="sources" stripe aria-label="采集源列表" row-key="id">
          <template #empty>
            <el-empty description="暂无采集源，点击「新建采集源」配置第一个（如百度搜索页）" />
          </template>
          <el-table-column prop="name" label="名称" min-width="140" show-overflow-tooltip />
          <el-table-column prop="platform" label="平台" width="90">
            <template #default="{ row }">{{ platformLabels[row.platform as Platform] }}</template>
          </el-table-column>
          <el-table-column prop="sourceType" label="类型" width="90">
            <template #default="{ row }">{{ sourceTypeLabels[row.sourceType] ?? row.sourceType }}</template>
          </el-table-column>
          <el-table-column prop="target" label="目标（URL/关键词）" min-width="220" show-overflow-tooltip />
          <el-table-column prop="mode" label="模式" width="150">
            <template #default="{ row }">{{ sourceModeLabels[row.mode] ?? row.mode }}</template>
          </el-table-column>
          <el-table-column prop="rateLimit" label="限频/分" width="80" align="right" />
          <el-table-column label="清洗开关" min-width="180">
            <template #default="{ row }">
              <template v-if="cleaningTags(row.cleaning).length">
                <el-tag v-for="t in cleaningTags(row.cleaning)" :key="t" type="info" size="small" class="mini-tag">{{ t }}</el-tag>
              </template>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="启用" width="80">
            <template #default="{ row }">
              <el-switch :model-value="row.enabled" aria-label="采集源启用开关" @change="handleToggleSourceEnabled(row)" />
            </template>
          </el-table-column>
          <el-table-column prop="collectCount" label="累计" width="80" align="right">
            <template #default="{ row }">{{ formatCount(row.collectCount) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="220" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" :loading="sourceCollecting.has(row.id)" :disabled="!row.enabled" @click="handleCollectFromSource(row)">立即采集</el-button>
              <el-button link type="primary" size="small" @click="openEditSource(row)">编辑</el-button>
              <el-button link type="danger" size="small" @click="handleDeleteSource(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- ===== 2. 竞品库 ===== -->
      <el-tab-pane label="竞品库">
        <template #label><span aria-label="竞品库标签页">竞品库</span></template>
        <div v-if="competitorError" role="alert" class="error-box">
          <el-alert type="error" :closable="false" :title="competitorError">
            <template #default>
              <el-button size="small" @click="loadCompetitors">重试</el-button>
            </template>
          </el-alert>
        </div>
        <div class="pane-head">
          <el-button type="primary" @click="openCreateCompetitor">+ 新建竞品</el-button>
        </div>
        <el-table v-loading="competitorLoading" :data="competitors" stripe aria-label="竞品列表" row-key="id">
          <template #empty>
            <el-empty description="暂无竞品数据，点击「新建竞品」开始" />
          </template>
          <el-table-column prop="name" label="竞品名称" min-width="140" />
          <el-table-column prop="platform" label="平台" width="100">
            <template #default="{ row }">
              {{ platformLabels[row.platform as Platform] }}
            </template>
          </el-table-column>
          <el-table-column prop="category" label="分类" min-width="120" />
          <el-table-column prop="url" label="主页" min-width="200" show-overflow-tooltip>
            <template #default="{ row }">
              <a :href="row.url" target="_blank" rel="noopener" class="url-link">{{ row.url }}</a>
            </template>
          </el-table-column>
          <el-table-column label="监控" width="110">
            <template #default="{ row }">
              <el-switch :model-value="row.monitorEnabled" :loading="monitorSwitching.has(row.id)" aria-label="监控开关" @change="handleToggleMonitor(row)" />
            </template>
          </el-table-column>
          <el-table-column prop="createdAt" label="创建时间" min-width="170" show-overflow-tooltip>
            <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="160" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="openEditCompetitor(row)">编辑</el-button>
              <el-button link type="danger" size="small" @click="handleDeleteCompetitor(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <CompetitorFormDrawer v-model="competitorDrawer" :competitor="editingCompetitor" @saved="loadCompetitors" />
      </el-tab-pane>

      <!-- ===== 3. 采集任务 ===== -->
      <el-tab-pane label="采集任务">
        <template #label><span aria-label="采集任务标签页">采集任务</span></template>
        <div class="card filter-card">
          <el-form :model="collectForm" inline @submit.prevent>
            <el-form-item label="目标">
              <el-input v-model="collectForm.target" placeholder="竞品主页/话题链接/关键词" size="default" style="width:240px" aria-label="采集目标" @keyup.enter="handleSubmitCollect" />
            </el-form-item>
            <el-form-item label="平台">
              <el-select v-model="collectForm.platform" size="default" style="width:130px" aria-label="采集平台">
                <el-option v-for="opt in platformOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="层级">
              <el-select v-model="collectForm.sourceLevel" size="default" style="width:160px" aria-label="采集层级">
                <el-option v-for="opt in sourceLevelOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
              </el-select>
            </el-form-item>
          </el-form>
          <div class="filter-actions">
            <el-button type="primary" :loading="collectSubmitting" @click="handleSubmitCollect">发起采集</el-button>
          </div>
        </div>

        <el-table v-loading="taskLoading" :data="tasks" stripe aria-label="采集任务列表" row-key="id">
          <template #empty>
            <el-empty description="暂无采集任务，可在「采集源」页对配置好的源一键发起" />
          </template>
          <el-table-column prop="id" label="任务号" width="80" />
          <el-table-column prop="target" label="目标" min-width="180" show-overflow-tooltip />
          <el-table-column prop="platform" label="平台" width="90">
            <template #default="{ row }">{{ platformLabels[row.platform as Platform] }}</template>
          </el-table-column>
          <el-table-column prop="sourceId" label="来源" width="80">
            <template #default="{ row }">
              <span v-if="row.sourceId">源#{{ row.sourceId }}</span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="collectStatusMeta[row.status as CollectStatus].type" size="small">
                {{ collectStatusMeta[row.status as CollectStatus].label }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="progress" label="进度" min-width="150">
            <template #default="{ row }">
              <el-progress :percentage="row.progress" :status="row.status === 'failed' ? 'exception' : undefined" />
            </template>
          </el-table-column>
          <el-table-column prop="collectedCount" label="已采集" width="90" align="right">
            <template #default="{ row }">{{ formatCount(row.collectedCount) }}</template>
          </el-table-column>
          <el-table-column label="控制" width="170" fixed="right">
            <template #default="{ row }">
              <template v-if="taskActions(row).length">
                <el-button v-for="a in taskActions(row)" :key="a" link type="primary" size="small" @click="handleControlTask(row, a)">
                  {{ a === 'pause' ? '暂停' : a === 'resume' ? '恢复' : a === 'cancel' ? '取消' : '重试' }}
                </el-button>
              </template>
              <span v-else>-</span>
            </template>
          </el-table-column>
        </el-table>
        <div class="table-pagination" v-if="taskTotal > 0">
          <el-pagination
            v-model:current-page="taskPage"
            v-model:page-size="taskPageSize"
            :total="taskTotal"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next"
            background
            aria-label="任务分页"
            @current-change="handleTaskPageChange"
            @size-change="handleTaskSizeChange"
          />
        </div>
      </el-tab-pane>

      <!-- ===== 4. 采集评论 / 审核池 ===== -->
      <el-tab-pane label="采集评论">
        <template #label><span aria-label="采集评论标签页">采集评论</span></template>
        <el-alert type="info" :closable="false" show-icon class="compliance-alert" title="合规提示：评论已按隐私白名单脱敏，命中手机/地理/设备标识 一律剥离为[已脱敏]；审核通过的评论才会被人性分析（D）消费。" />
        <div class="card filter-card">
          <el-form :model="commentFilters" inline @submit.prevent>
            <el-form-item label="审核状态">
              <el-select v-model="commentFilters.reviewStatus" placeholder="全部" clearable size="default" style="width:130px" aria-label="审核状态筛选" @change="handleCommentFilter">
                <el-option v-for="opt in reviewStatusOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="清洗状态">
              <el-radio-group v-model="commentFilters.isClean" size="default" @change="handleCommentFilter">
                <el-radio-button :value="true">已清洗</el-radio-button>
                <el-radio-button :value="false">未清洗</el-radio-button>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="平台">
              <el-select v-model="commentFilters.platform" placeholder="全部" clearable size="default" style="width:130px" aria-label="评论平台筛选" @change="handleCommentFilter">
                <el-option v-for="opt in platformOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
              </el-select>
            </el-form-item>
          </el-form>
          <div class="filter-actions">
            <el-button type="success" :loading="batchReviewing" :disabled="selectedComments.length === 0" @click="handleReviewBatch('approved')">
              批量通过（{{ selectedComments.length }}）
            </el-button>
            <el-button type="danger" :loading="batchReviewing" :disabled="selectedComments.length === 0" @click="handleReviewBatch('rejected')">
              批量驳回（{{ selectedComments.length }}）
            </el-button>
          </div>
        </div>
        <el-table
          v-loading="commentLoading"
          :data="comments"
          stripe
          aria-label="采集评论列表"
          row-key="id"
          @selection-change="onSelectionChange"
        >
          <el-table-column type="selection" width="44" />
          <template #empty>
            <el-empty description="暂无评论数据" />
          </template>
          <el-table-column prop="content" label="内容" min-width="220" show-overflow-tooltip />
          <el-table-column prop="platform" label="平台" width="80">
            <template #default="{ row }">{{ platformLabels[row.platform as Platform] }}</template>
          </el-table-column>
          <el-table-column prop="authorId" label="作者" min-width="110" show-overflow-tooltip />
          <el-table-column prop="likes" label="点赞" width="70" align="right">
            <template #default="{ row }">{{ formatCount(row.likes) }}</template>
          </el-table-column>
          <el-table-column label="审核" width="90">
            <template #default="{ row }">
              <el-tag :type="reviewStatusMeta[row.reviewStatus as ReviewStatus]?.type" size="small">
                {{ reviewStatusMeta[row.reviewStatus as ReviewStatus]?.label ?? row.reviewStatus }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="清洗" width="90">
            <template #default="{ row }">
              <el-tag :type="row.isClean ? 'success' : 'info'" size="small">{{ row.isClean ? '已清洗' : '未清洗' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="脱敏/广告" min-width="180">
            <template #default="{ row }">
              <template v-if="row.cleanResult?.piiRemoved?.length">
                <el-tag v-for="p in row.cleanResult.piiRemoved" :key="p" type="warning" size="small" class="mini-tag">已脱敏:{{ p }}</el-tag>
              </template>
              <el-tag v-if="row.cleanResult?.ad" type="danger" size="small" class="mini-tag">广告</el-tag>
              <span v-if="!row.cleanResult?.piiRemoved?.length && !row.cleanResult?.ad">-</span>
            </template>
          </el-table-column>
          <el-table-column prop="collectedAt" label="采集时间" min-width="160" show-overflow-tooltip>
            <template #default="{ row }">{{ formatDateTime(row.collectedAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="130" fixed="right">
            <template #default="{ row }">
              <el-button link type="success" size="small" :loading="reviewLoading.has(row.id)" @click="handleReviewOne(row, 'approved')">通过</el-button>
              <el-button link type="danger" size="small" :loading="reviewLoading.has(row.id)" @click="handleReviewOne(row, 'rejected')">驳回</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="table-pagination" v-if="commentTotal > 0">
          <el-pagination
            v-model:current-page="commentPage"
            v-model:page-size="commentPageSize"
            :total="commentTotal"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next"
            background
            aria-label="评论分页"
            @current-change="handleCommentPageChange"
            @size-change="handleCommentSizeChange"
          />
        </div>
      </el-tab-pane>

      <!-- ===== 5. 关键词挖掘 ===== -->
      <el-tab-pane label="关键词挖掘">
        <template #label><span aria-label="关键词挖掘标签页">关键词挖掘</span></template>
        <div class="card filter-card">
          <el-form :model="keywordForm" inline @submit.prevent>
            <el-form-item label="平台">
              <el-select v-model="keywordForm.platform" size="default" style="width:130px" aria-label="挖掘平台">
                <el-option v-for="opt in platformOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="目标/关键词">
              <el-input v-model="keywordForm.target" placeholder="如 口红" size="default" style="width:200px" aria-label="挖掘目标" @keyup.enter="handleMineKeywords" />
            </el-form-item>
          </el-form>
          <div class="filter-actions">
            <el-button type="primary" :loading="keywordLoading" @click="handleMineKeywords">挖掘</el-button>
          </div>
        </div>
        <el-empty v-if="!keywordLoading && keywords.length === 0" description="暂无关键词，输入目标后点击挖掘" />
        <div v-else class="tag-cloud">
          <el-tag v-for="(kw, i) in keywords" :key="kw + i" :type="i % 4 === 0 ? 'primary' : 'success'" size="small" class="cloud-tag">{{ kw }}</el-tag>
        </div>
      </el-tab-pane>

      <!-- ===== 6. 热点榜 ===== -->
      <el-tab-pane label="热点榜">
        <template #label><span aria-label="热点榜标签页">热点榜</span></template>
        <div class="card filter-card">
          <el-form :model="hotForm" inline @submit.prevent>
            <el-form-item label="平台">
              <el-select v-model="hotForm.platform" size="default" style="width:130px" aria-label="热点平台">
                <el-option v-for="opt in platformOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="类型">
              <el-select v-model="hotForm.hotType" size="default" style="width:130px" aria-label="热点类型">
                <el-option v-for="opt in hotTypeOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
              </el-select>
            </el-form-item>
          </el-form>
          <div class="filter-actions">
            <el-button type="primary" :loading="hotLoading" @click="handleGetHot">查询</el-button>
          </div>
        </div>
        <el-empty v-if="!hotLoading && hotList.length === 0" description="暂无热点数据" />
        <el-table v-else v-loading="hotLoading" :data="hotList" stripe aria-label="热点榜列表">
          <el-table-column prop="rank" label="排名" width="70">
            <template #default="{ row }">{{ row.rank ?? '-' }}</template>
          </el-table-column>
          <el-table-column prop="title" label="标题" min-width="220" show-overflow-tooltip>
            <template #default="{ row }">
              <a v-if="row.url" :href="row.url" target="_blank" rel="noopener" class="url-link">{{ row.title || '-' }}</a>
              <span v-else>{{ row.title || '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="platform" label="平台" width="90">
            <template #default="{ row }">{{ row.platform ? platformLabels[row.platform as Platform] : '-' }}</template>
          </el-table-column>
          <el-table-column prop="hotType" label="类型" width="90">
            <template #default="{ row }">{{ row.hotType || '-' }}</template>
          </el-table-column>
          <el-table-column prop="heat" label="热度" width="110" align="right">
            <template #default="{ row }">{{ row.heat != null ? formatCount(row.heat) : '-' }}</template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <!-- 采集源 新建/编辑 -->
    <el-dialog v-model="sourceDialog" :title="editingSource ? '编辑采集源' : '新建采集源'" width="560px" destroy-on-close>
      <el-form :model="sourceForm" label-width="110px" @submit.prevent>
        <el-form-item label="名称" required>
          <el-input v-model="sourceForm.name" placeholder="如 百度热搜关键词采集" aria-label="采集源名称" />
        </el-form-item>
        <el-form-item label="平台">
          <el-select v-model="sourceForm.platform" style="width: 100%" aria-label="采集源平台">
            <el-option v-for="opt in platformOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="内容类型">
          <el-select v-model="sourceForm.sourceType" style="width: 100%" aria-label="采集源类型">
            <el-option v-for="opt in sourceTypeOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="目标" required>
          <el-input v-model="sourceForm.target" placeholder="URL（网页抓取）或 关键词" aria-label="采集源目标" />
        </el-form-item>
        <el-form-item label="模式">
          <el-select v-model="sourceForm.mode" style="width: 100%" aria-label="采集源模式">
            <el-option v-for="opt in sourceModeOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="限频/分">
          <el-input-number v-model="sourceForm.rateLimit" :min="1" :max="600" style="width: 160px" aria-label="采集源限频" />
        </el-form-item>
        <el-form-item label="清洗开关">
          <div class="cleaning-switches">
            <el-checkbox v-for="opt in cleaningOptionLabels" :key="opt.key" :model-value="!!(sourceForm.cleaning as CleaningOptions | undefined)?.[opt.key as keyof CleaningOptions]" @change="setCleaningOpt(opt.key, $event)">
              {{ opt.label }}
            </el-checkbox>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="sourceDialog = false">取消</el-button>
        <el-button type="primary" :loading="sourceSaving" @click="handleSaveSource">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
/* 页面标题区 */
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-lg); }
.page-title { font-size: var(--text-2xl); font-weight: 700; color: var(--el-text-color-primary); margin: 0 0 4px 0; }
.page-subtitle { font-size: var(--text-base); color: var(--el-text-color-secondary); margin: 0; }

/* 标签页内区块 */
.pane-head { margin-bottom: var(--space-md); display: flex; justify-content: flex-end; }
.section-header { margin: var(--space-md) 0 var(--space-sm); }
.section-title { font-size: var(--text-md); font-weight: 600; color: var(--el-text-color-primary); margin: 0; }
.filter-card { padding: var(--space-lg); margin-bottom: var(--space-md); }
.filter-card .el-form { margin-bottom: 12px; }
.filter-actions { display: flex; gap: var(--space-sm); }
.compliance-alert { margin-bottom: var(--space-md); }

/* 链接 */
.url-link { color: var(--app-brand-600); text-decoration: none; }
.url-link:hover { text-decoration: underline; }

/* 标签 */
.mini-tag { margin-right: var(--space-1); }
.tag-cloud { display: flex; flex-wrap: wrap; gap: var(--space-sm); }
.cloud-tag { cursor: default; }
.cleaning-switches { display: flex; gap: var(--space-lg); flex-wrap: wrap; }

/* 分页 */
.table-pagination { display: flex; justify-content: flex-end; padding-top: var(--space-md); }
.error-box { margin-bottom: var(--space-md); }
</style>
