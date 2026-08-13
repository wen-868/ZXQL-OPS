<script setup lang="ts">
import { onBeforeUnmount, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  createRecycle,
  getRecycle,
  getFeedback,
  rerunAnalysis,
  type RecycleTask,
  type FeedbackResult,
  type CreateRecyclePayload,
  type RerunAnalysisResult,
} from '@/api/recycle'
import { formatDateTime } from '@/utils/format'
import {
  recycleScopeMeta,
  recycleScopeOptions,
  recycleStatusMeta,
  reanalysisStatusMeta,
  recycleMetricMeta,
  recycleMetricOrder,
  type RecycleScope,
  type RecycleMetricKey,
} from './recycleMaps'

// ============ 1. 发起回收 ============
const form = reactive<CreateRecyclePayload>({
  scope: 'video',
  targetRef: '',
  metrics: undefined,
  comments: undefined,
})
const commentsText = ref('') // 文本域：逗号分隔转数组
const submitting = ref(false)
const taskIds = ref<number[]>([]) // 本地维护的发起任务 id 列表

function targetPlaceholder(): string {
  if (form.scope === 'all') return "全量回收请填 'all'"
  if (form.scope === 'video') return '填 I 发布任务 id'
  return '填账号 id'
}

async function onSubmit() {
  if (!form.targetRef.trim()) {
    ElMessage.warning(targetPlaceholder())
    return
  }
  // comments 文本域逗号分隔转数组
  const comments = commentsText.value
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean)
  const payload: CreateRecyclePayload = {
    scope: form.scope,
    targetRef: form.targetRef.trim(),
  }
  if (comments.length) payload.comments = comments
  submitting.value = true
  try {
    const res = await createRecycle(payload)
    ElMessage.success(`已发起回收，taskId=${res.taskId}`)
    if (!taskIds.value.includes(res.taskId)) {
      taskIds.value.unshift(res.taskId)
      startPolling(res.taskId)
    }
  } catch {
    // 拦截器已提示（如 RECYCLE_NO_DATA）
  } finally {
    submitting.value = false
  }
}

// ============ 2. 回收任务列表（本地维护 + 轮询）============
const tasks = ref<RecycleTask[]>([])
const tasksLoading = ref(false)
const pollTimers: Record<number, ReturnType<typeof setInterval>> = {}
const pollCounts: Record<number, number> = {}

function startPolling(id: number) {
  pollCounts[id] = 0
  pollTimers[id] = setInterval(async () => {
    pollCounts[id] = (pollCounts[id] || 0) + 1
    try {
      const task = await getRecycle(id)
      const idx = tasks.value.findIndex((t) => t.id === id)
      if (idx >= 0) tasks.value[idx] = task
      else tasks.value.unshift(task)
      if (task.status === 'done' || task.status === 'failed' || pollCounts[id] >= 20) {
        stopPolling(id)
      }
    } catch {
      stopPolling(id)
    }
  }, 3000)
}

function stopPolling(id: number) {
  if (pollTimers[id]) {
    clearInterval(pollTimers[id])
    delete pollTimers[id]
  }
}

async function refreshTasks() {
  tasksLoading.value = true
  try {
    const loaded: RecycleTask[] = []
    for (const id of taskIds.value) {
      try {
        loaded.push(await getRecycle(id))
      } catch {
        // 单条失败忽略
      }
    }
    tasks.value = loaded
  } catch {
    // 拦截器已提示
  } finally {
    tasksLoading.value = false
  }
}

// ============ 3. 单视频明细 ============
const videoIdInput = ref('')
const feedbackLoading = ref(false)
const feedbackData = ref<FeedbackResult | null>(null)

async function loadFeedback() {
  const vid = Number(videoIdInput.value)
  if (!vid || Number.isNaN(vid)) {
    ElMessage.warning('请输入有效的视频/发布任务 id')
    return
  }
  feedbackLoading.value = true
  feedbackData.value = null
  try {
    feedbackData.value = await getFeedback(vid)
  } catch {
    // 404 / 拦截器已提示
  } finally {
    feedbackLoading.value = false
  }
}

function metricValue(key: RecycleMetricKey): string {
  const v = feedbackData.value?.feedback.metrics?.[key]
  if (v == null) return '-'
  const meta = recycleMetricMeta[key]
  return meta.unit === '¥' ? `¥${v}` : `${v}${meta.unit}`
}

// ============ 4. 回流再分析 ============
const rerunLoading = ref(false)
const rerunResult = ref<RerunAnalysisResult | null>(null)

async function onRerun() {
  rerunLoading.value = true
  rerunResult.value = null
  try {
    const res = await rerunAnalysis()
    rerunResult.value = res
    ElMessage.success(`已注入 ${res.feedbackCount} 条回收评论到 D 人性分析`)
  } catch {
    // 拦截器已提示（如 RECYCLE_NO_DATA）
  } finally {
    rerunLoading.value = false
  }
}

onBeforeUnmount(() => {
  Object.values(pollTimers).forEach((t) => clearInterval(t))
})
</script>

<template>
  <div class="page-container" aria-label="J 数据监控与回收">
    <!-- 页面标题区 -->
    <div class="page-header">
      <div class="page-header-text">
        <h1 class="page-title">L·数据回收</h1>
        <p class="page-subtitle">回收发布表现数据与五维指标，回流 D 人性分析形成闭环</p>
      </div>
    </div>

    <!-- 合规提示 -->
    <el-alert
      type="info"
      :closable="false"
      show-icon
      class="compliance-alert"
      title="仅存聚合表现与回收评论文本（已脱敏），不留存单条个人信息；attributionId 由 I 透传（F→I→J 只读），禁止重生成。"
    />

    <!-- 功能分区 -->
    <el-tabs type="border-card" aria-label="数据监控与回收功能分区">
      <!-- ===== 1. 发起回收 ===== -->
      <el-tab-pane label="发起回收">
        <template #label><span aria-label="发起回收标签页">发起回收</span></template>
        <div class="card">
          <el-form :model="form" label-width="96px" aria-label="发起回收表单">
            <el-form-item label="回收范围" required>
              <el-select
                v-model="form.scope"
                placeholder="选择回收范围"
                style="width: 320px"
                size="default"
                aria-label="回收范围"
                value-key="value"
              >
                <el-option
                  v-for="opt in recycleScopeOptions"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="目标引用" required>
              <el-input
                v-model="form.targetRef"
                :placeholder="targetPlaceholder()"
                style="width: 320px"
                size="default"
                aria-label="目标引用"
              />
            </el-form-item>
            <el-form-item label="备注评论">
              <el-input
                v-model="commentsText"
                type="textarea"
                :rows="3"
                placeholder="可选；多个用逗号分隔，将转为数组提交"
                style="width: 480px"
                aria-label="备注评论"
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="submitting" @click="onSubmit" aria-label="提交回收">
                {{ submitting ? '回收中…' : '发起回收' }}
              </el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-tab-pane>

      <!-- ===== 2. 回收任务 ===== -->
      <el-tab-pane label="回收任务">
        <template #label><span aria-label="回收任务标签页">回收任务</span></template>
        <div class="section-actions">
          <el-button @click="refreshTasks" :loading="tasksLoading" aria-label="刷新任务列表">刷新</el-button>
        </div>
        <el-empty
          v-if="!tasksLoading && !tasks.length"
          description="先发起回收"
        />
        <div v-else class="card">
          <el-table
            :data="tasks"
            stripe
            v-loading="tasksLoading"
            aria-label="回收任务列表"
          >
            <el-table-column prop="id" label="ID" width="90" />
            <el-table-column label="范围" width="100">
              <template #default="{ row }">
                <el-tag :type="recycleScopeMeta[(row.scope as RecycleScope)]?.type || 'info'" size="small">
                  {{ recycleScopeMeta[(row.scope as RecycleScope)]?.label || row.scope }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="targetRef" label="目标引用" min-width="140" />
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="recycleStatusMeta[(row.status as keyof typeof recycleStatusMeta)]?.type || 'info'" size="small">
                  {{ recycleStatusMeta[(row.status as keyof typeof recycleStatusMeta)]?.label || row.status }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="进度" width="120">
              <template #default="{ row }">
                <el-progress :percentage="row.progress || 0" :stroke-width="10" aria-label="回收进度" />
              </template>
            </el-table-column>
            <el-table-column label="最后采集" min-width="170">
              <template #default="{ row }">{{ formatDateTime(row.lastCollectedAt) }}</template>
            </el-table-column>
            <el-table-column label="创建时间" min-width="170">
              <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>

      <!-- ===== 3. 单视频明细 ===== -->
      <el-tab-pane label="单视频明细">
        <template #label><span aria-label="单视频明细标签页">单视频明细</span></template>
        <div class="section-actions filter-row">
          <el-input
            v-model="videoIdInput"
            placeholder="输入视频/发布任务 id"
            style="width: 280px"
            size="default"
            aria-label="视频 id"
            @keyup.enter="loadFeedback"
          />
          <el-button type="primary" :loading="feedbackLoading" @click="loadFeedback" aria-label="查询明细">查询</el-button>
        </div>
        <el-empty v-if="!feedbackLoading && !feedbackData" description="输入视频 id 查询回收明细" />
        <div v-else-if="feedbackData" class="card" v-loading="feedbackLoading">
          <div class="fb-head">
            <span class="fb-head-title">反馈 #{{ feedbackData.feedback.id }}</span>
            <el-tag v-if="feedbackData.feedback.platform" size="small" type="info">
              {{ feedbackData.feedback.platform }}
            </el-tag>
            <el-tag size="small" type="warning">归因 {{ feedbackData.feedback.attributionId }}</el-tag>
          </div>
          <div class="fb-section">
            <span class="fb-label">五维指标：</span>
            <el-tag
              v-for="key in recycleMetricOrder"
              :key="key"
              size="small"
              :type="feedbackData.feedback.metrics?.[key] != null ? 'primary' : 'info'"
              class="fb-tag-item"
            >
              {{ recycleMetricMeta[key].label }}：{{ metricValue(key) }}
            </el-tag>
          </div>
          <div class="fb-section">
            <span class="fb-label">回收评论（已脱敏）：</span>
            <el-tag
              v-for="(c, i) in feedbackData.feedback.comments || []"
              :key="i"
              size="small"
              type="info"
              class="fb-tag-item"
            >
              {{ c }}
            </el-tag>
            <span v-if="!feedbackData.feedback.comments?.length" class="fb-empty">-</span>
          </div>
          <div class="fb-section">
            <span class="fb-label">回流再分析：</span>
            <el-tag v-if="feedbackData.feedback.reAnalysisId" size="small" type="success" class="fb-tag-item">
              reAnalysisId={{ feedbackData.feedback.reAnalysisId }}
            </el-tag>
            <el-tag
              v-if="feedbackData.reanalysisStatus"
              size="small"
              :type="reanalysisStatusMeta[feedbackData.reanalysisStatus]?.type || 'info'"
              class="fb-tag-item"
            >
              {{ reanalysisStatusMeta[feedbackData.reanalysisStatus]?.label || feedbackData.reanalysisStatus }}
            </el-tag>
            <span v-if="!feedbackData.feedback.reAnalysisId && !feedbackData.reanalysisStatus" class="fb-empty">-</span>
          </div>
          <div class="fb-time">采集时间：{{ formatDateTime(feedbackData.feedback.collectedAt) }}</div>
        </div>
      </el-tab-pane>

      <!-- ===== 4. 回流再分析 ===== -->
      <el-tab-pane label="回流再分析">
        <template #label><span aria-label="回流再分析标签页">回流再分析</span></template>
        <div class="rerun-box">
          <el-button type="primary" :loading="rerunLoading" @click="onRerun" aria-label="回流 D 再分析">
            回流 D 再分析
          </el-button>
          <span class="rerun-hint">将回收评论注入 D 人性分析形成闭环</span>
        </div>
        <div v-if="rerunResult" class="card rerun-result-card">
          <div>分析实例 analysisId：<b>{{ rerunResult.analysisId }}</b></div>
          <div>注入反馈数 feedbackCount：<b>{{ rerunResult.feedbackCount }}</b></div>
          <div class="rerun-trace">traceId：{{ rerunResult.traceId }}</div>
          <el-alert
            type="success"
            :closable="false"
            show-icon
            title="已把回收评论注入 D 人性分析形成闭环，可到 D 页查看分析结果"
          />
        </div>
        <el-empty v-else description="点击「回流 D 再分析」将回收评论回流 D 再分析" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
.page-header {
  margin-bottom: var(--space-6);
}
.page-header-text {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.page-title {
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--app-neutral-800);
  margin: 0;
}
.page-subtitle {
  font-size: var(--text-base);
  color: var(--app-neutral-500);
  margin: 0;
}
.compliance-alert {
  margin-bottom: var(--space-4);
}
.section-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: var(--space-3);
}
.filter-row {
  justify-content: flex-start;
  gap: var(--space-3);
}
.fb-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: var(--space-4);
}
.fb-head-title {
  font-size: var(--text-md);
  font-weight: 600;
  color: var(--app-neutral-800);
}
.fb-section {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.fb-label {
  font-size: var(--text-base-sm);
  color: var(--app-neutral-700);
  white-space: nowrap;
}
.fb-tag-item {
  margin: 0 2px 4px 0;
}
.fb-empty {
  font-size: var(--text-base-sm);
  color: var(--app-neutral-400);
}
.fb-time {
  font-size: var(--text-sm);
  color: var(--app-neutral-400);
}
.rerun-box {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}
.rerun-hint {
  font-size: var(--text-sm);
  color: var(--app-neutral-400);
}
.rerun-result-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.rerun-trace {
  font-size: var(--text-sm);
  color: var(--app-neutral-400);
}
</style>
