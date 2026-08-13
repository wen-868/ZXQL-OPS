<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  deleteCompetitor,
  getCollectTask,
  getHot,
  listCollectedComments,
  listCompetitors,
  mineKeywords,
  submitCollect,
  toggleMonitor,
  type CollectPayload,
  type CollectStatus,
  type CollectedComment,
  type CommentQuery,
  type Competitor,
  type HotSnapshot,
  type HotType,
  type Platform,
} from '@/api/intel'
import { formatCount, formatDateTime } from '@/utils/format'
import {
  collectStatusMeta,
  hotTypeOptions,
  platformLabels,
  platformOptions,
  sourceLevelOptions,
} from './intelMaps'
import CompetitorFormDrawer from './CompetitorFormDrawer.vue'

// ============ 1. 竞品库 ============
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

// ============ 2. 采集任务 ============
interface MyTask extends CollectPayload {
  taskId: number
  status: CollectStatus
  progress: number
  collectedCount: number
  traceId?: string
}
const collectForm = reactive<CollectPayload>({
  type: 'comment',
  target: '',
  platform: 'douyin',
  sourceLevel: 'L1',
})
const collectSubmitting = ref(false)
const myTasks = ref<MyTask[]>([])
const MAX_POLL = 20
const pollTimers: Record<number, ReturnType<typeof setInterval>> = {}

async function handleSubmitCollect() {
  if (!collectForm.target.trim()) {
    ElMessage.warning('请输入采集目标')
    return
  }
  collectSubmitting.value = true
  try {
    const res = await submitCollect({ ...collectForm, target: collectForm.target.trim() })
    const task: MyTask = {
      ...collectForm,
      taskId: res.taskId,
      status: 'pending',
      progress: 0,
      collectedCount: 0,
      traceId: res.traceId,
    }
    myTasks.value.unshift(task)
    ElMessage.success(`已发起采集任务 #${res.taskId}`)
    startPoll(task)
  } catch {
    // 拦截器已提示
  } finally {
    collectSubmitting.value = false
  }
}
function startPoll(task: MyTask) {
  let times = 0
  pollTimers[task.taskId] = setInterval(async () => {
    times += 1
    try {
      const prog = await getCollectTask(task.taskId)
      task.status = prog.status
      task.progress = prog.progress
      task.collectedCount = prog.collectedCount
      if (prog.status === 'done' || prog.status === 'failed' || times >= MAX_POLL) {
        stopPoll(task.taskId)
      }
    } catch {
      stopPoll(task.taskId)
    }
  }, 3000)
}
function stopPoll(taskId: number) {
  if (pollTimers[taskId]) {
    clearInterval(pollTimers[taskId])
    delete pollTimers[taskId]
  }
}

// ============ 3. 采集评论 ============
const commentLoading = ref(false)
const comments = ref<CollectedComment[]>([])
const commentTotal = ref(0)
const commentPage = ref(1)
const commentPageSize = ref(20)
const commentFilters = reactive<CommentQuery>({
  isClean: true,
  platform: undefined,
})
async function loadComments() {
  commentLoading.value = true
  try {
    const params: CommentQuery = {
      page: commentPage.value,
      pageSize: commentPageSize.value,
      isClean: commentFilters.isClean,
    }
    if (commentFilters.platform) params.platform = commentFilters.platform
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

// ============ 4. 关键词挖掘 ============
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

// ============ 5. 热点榜 ============
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
  loadCompetitors()
  loadComments()
  handleGetHot()
})
onBeforeUnmount(() => {
  Object.keys(pollTimers).forEach((k) => clearInterval(pollTimers[Number(k)]))
})
</script>

<template>
  <div class="page-container" aria-label="C 情报采集">
    <!-- 页面标题区 -->
    <div class="page-header">
      <div>
        <h1 class="page-title">C·情报采集</h1>
        <p class="page-subtitle">竞品监控、采集任务调度、评论清洗与关键词挖掘，为创作提供情报支撑</p>
      </div>
    </div>

    <el-tabs type="border-card" aria-label="情报采集功能分区">
      <!-- ===== 1. 竞品库 ===== -->
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

      <!-- ===== 2. 采集任务 ===== -->
      <el-tab-pane label="采集任务">
        <template #label><span aria-label="采集任务标签页">采集任务</span></template>
        <div class="card filter-card">
          <el-form :model="collectForm" inline @submit.prevent>
            <el-form-item label="目标">
              <el-input v-model="collectForm.target" placeholder="竞品主页/话题链接" size="default" style="width:240px" aria-label="采集目标" @keyup.enter="handleSubmitCollect" />
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

        <div class="section-header">
          <h3 class="section-title">我的任务</h3>
        </div>
        <el-empty v-if="myTasks.length === 0" description="暂无采集任务，填写目标后点击「发起采集」" />
        <el-table v-else :data="myTasks" stripe aria-label="我的采集任务" row-key="taskId">
          <el-table-column prop="taskId" label="任务ID" width="90" />
          <el-table-column prop="target" label="目标" min-width="180" show-overflow-tooltip />
          <el-table-column prop="platform" label="平台" width="90">
            <template #default="{ row }">{{ platformLabels[row.platform as Platform] }}</template>
          </el-table-column>
          <el-table-column prop="sourceLevel" label="层级" width="70" />
          <el-table-column label="状态" width="110">
            <template #default="{ row }">
              <el-tag :type="collectStatusMeta[row.status as CollectStatus].type" size="small">
                {{ collectStatusMeta[row.status as CollectStatus].label }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="progress" label="进度" min-width="160">
            <template #default="{ row }">
              <el-progress :percentage="Math.round((row.progress || 0) * 100)" :status="row.status === 'failed' ? 'exception' : undefined" />
            </template>
          </el-table-column>
          <el-table-column prop="collectedCount" label="已采集" width="100" align="right">
            <template #default="{ row }">{{ formatCount(row.collectedCount) }}</template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- ===== 3. 采集评论 ===== -->
      <el-tab-pane label="采集评论">
        <template #label><span aria-label="采集评论标签页">采集评论</span></template>
        <el-alert type="info" :closable="false" show-icon class="compliance-alert" title="合规提示：评论已按隐私白名单脱敏，命中手机/地理/IMEI 一律剥离为[已脱敏]。" />
        <div class="card filter-card">
          <el-form :model="commentFilters" inline @submit.prevent>
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
        </div>
        <el-table v-loading="commentLoading" :data="comments" stripe aria-label="采集评论列表" row-key="id">
          <template #empty>
            <el-empty description="暂无评论数据" />
          </template>
          <el-table-column prop="content" label="内容" min-width="220" show-overflow-tooltip />
          <el-table-column prop="platform" label="平台" width="90">
            <template #default="{ row }">{{ platformLabels[row.platform as Platform] }}</template>
          </el-table-column>
          <el-table-column prop="authorId" label="作者" min-width="120" show-overflow-tooltip />
          <el-table-column prop="likes" label="点赞" width="80" align="right">
            <template #default="{ row }">{{ formatCount(row.likes) }}</template>
          </el-table-column>
          <el-table-column label="清洗" width="90">
            <template #default="{ row }">
              <el-tag :type="row.isClean ? 'success' : 'info'" size="small">{{ row.isClean ? '已清洗' : '未清洗' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="脱敏/广告" min-width="200">
            <template #default="{ row }">
              <template v-if="row.cleanResult?.piiRemoved?.length">
                <el-tag v-for="p in row.cleanResult.piiRemoved" :key="p" type="warning" size="small" class="mini-tag">已脱敏:{{ p }}</el-tag>
              </template>
              <el-tag v-if="row.cleanResult?.ad" type="danger" size="small" class="mini-tag">广告</el-tag>
              <span v-if="!row.cleanResult?.piiRemoved?.length && !row.cleanResult?.ad">-</span>
            </template>
          </el-table-column>
          <el-table-column prop="collectedAt" label="采集时间" min-width="170" show-overflow-tooltip>
            <template #default="{ row }">{{ formatDateTime(row.collectedAt) }}</template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!commentLoading && comments.length === 0" description="暂无数据" />
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

      <!-- ===== 4. 关键词挖掘 ===== -->
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

      <!-- ===== 5. 热点榜 ===== -->
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

/* 分页 */
.table-pagination { display: flex; justify-content: flex-end; padding-top: var(--space-md); }
.error-box { margin-bottom: var(--space-md); }
</style>
