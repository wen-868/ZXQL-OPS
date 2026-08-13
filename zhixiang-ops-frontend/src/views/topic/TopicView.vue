<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  generateTopics,
  listTopics,
  createTopicAb,
  scheduleTopic,
  updateTopic,
  type Topic,
  type TopicGeneratePayload,
  type TopicQuery,
  type TopicSchedulePayload,
} from '@/api/topic'
import { formatDateTime } from '@/utils/format'
import {
  driverLabels,
  driverColors,
  driverOptions,
  emotionLabels,
  emotionColors,
  emotionOptions,
  topicStatusMeta,
  topicStatusOptions,
  topicStatusTransitions,
  topicStatusNext,
} from './topicMaps'
import TopicFormDrawer from './TopicFormDrawer.vue'

// ============ 1. 选题生成 ============
const genForm = reactive<TopicGeneratePayload>({
  driver: undefined,
  emotion: undefined,
  limit: 20,
  analysisId: undefined,
})
const genSubmitting = ref(false)
const genResult = ref<Topic[]>([])
const genTrace = ref('')

async function handleGenerate() {
  genSubmitting.value = true
  try {
    const res = await generateTopics({
      driver: genForm.driver,
      emotion: genForm.emotion,
      limit: genForm.limit,
      analysisId: genForm.analysisId || undefined,
    })
    genResult.value = res.topics
    genTrace.value = res.traceId
    ElMessage.success(`生成 ${res.topics.length} 个选题`)
    loadTopics() // 自动刷新下方列表
  } catch {
    // 拦截器已提示
  } finally {
    genSubmitting.value = false
  }
}

// ============ 2. 选题库 ============
const topicLoading = ref(false)
const topics = ref<Topic[]>([])
const topicTotal = ref(0)
const topicPage = ref(1)
const topicPageSize = ref(20)
const topicFilters = reactive<TopicQuery>({
  driver: undefined,
  emotion: undefined,
  status: undefined,
})

async function loadTopics() {
  topicLoading.value = true
  try {
    const params: TopicQuery = {
      page: topicPage.value,
      pageSize: topicPageSize.value,
    }
    if (topicFilters.driver) params.driver = topicFilters.driver
    if (topicFilters.emotion) params.emotion = topicFilters.emotion
    if (topicFilters.status) params.status = topicFilters.status
    const res = await listTopics(params)
    topics.value = res.list
    topicTotal.value = res.total
  } catch {
    // 拦截器已提示
  } finally {
    topicLoading.value = false
  }
}
function handleTopicFilter() {
  topicPage.value = 1
  loadTopics()
}
function handleTopicPageChange(page: number) {
  topicPage.value = page
  loadTopics()
}
function handleTopicSizeChange(size: number) {
  topicPageSize.value = size
  topicPage.value = 1
  loadTopics()
}

// 标签渲染
function topicTags(t: Topic): Array<{ label: string; color: string }> {
  return [
    { label: driverLabels[t.humanDriver], color: driverColors[t.humanDriver] },
    { label: emotionLabels[t.emotion], color: emotionColors[t.emotion] },
  ]
}

// 编辑抽屉
const editDrawer = ref(false)
const editingTopic = ref<Topic | null>(null)
function openEdit(t: Topic) {
  editingTopic.value = t
  editDrawer.value = true
}
function afterEdit() {
  loadTopics()
}

// A/B 变体
const abSubmitting = reactive<Record<number, boolean>>({})
async function handleCreateAb(t: Topic) {
  abSubmitting[t.id] = true
  try {
    await createTopicAb(t.id, { title: `${t.title}（B版）` })
    ElMessage.success('已创建 A/B 变体')
    loadTopics()
  } catch {
    // 拦截器已提示
  } finally {
    abSubmitting[t.id] = false
  }
}

// 排期
const scheduleDrawer = ref(false)
const scheduleTarget = ref<Topic | null>(null)
const scheduleForm = reactive<TopicSchedulePayload>({ scheduledAt: '', accountId: '' })
const scheduleSubmitting = ref(false)
function openSchedule(t: Topic) {
  scheduleTarget.value = t
  scheduleForm.scheduledAt = t.scheduledAt || ''
  scheduleForm.accountId = t.accountId || ''
  scheduleDrawer.value = true
}
async function handleSchedule() {
  if (!scheduleTarget.value) return
  if (!scheduleForm.scheduledAt) {
    ElMessage.warning('请选择排期时间')
    return
  }
  scheduleSubmitting.value = true
  try {
    await scheduleTopic(scheduleTarget.value.id, {
      scheduledAt: scheduleForm.scheduledAt,
      accountId: scheduleForm.accountId || undefined,
    })
    ElMessage.success('已排期')
    scheduleDrawer.value = false
    loadTopics()
  } catch {
    // 拦截器已提示
  } finally {
    scheduleSubmitting.value = false
  }
}

// 状态推进
const advanceSubmitting = reactive<Record<number, boolean>>({})
async function handleAdvance(t: Topic) {
  const next = topicStatusNext[t.status]
  if (!next) return
  advanceSubmitting[t.id] = true
  try {
    await updateTopic(t.id, { status: next })
    ElMessage.success(`已推进至「${topicStatusMeta[next].label}」`)
    loadTopics()
  } catch {
    // 拦截器已提示（含非法流转 400）
  } finally {
    advanceSubmitting[t.id] = false
  }
}
function nextStatusLabel(t: Topic): string {
  const n = topicStatusNext[t.status]
  return n ? topicStatusMeta[n].label : ''
}
function canAdvance(t: Topic): boolean {
  return (topicStatusTransitions[t.status] || []).length > 0
}

// ============ 3. 统计概览 ============
const statusDist = computed(() => {
  const map: Record<string, number> = {}
  for (const t of topics.value) map[t.status] = (map[t.status] || 0) + 1
  return topicStatusOptions
    .filter((o) => map[o.value])
    .map((o) => ({ ...o, count: map[o.value] }))
})
const driverDist = computed(() => {
  const map: Record<string, number> = {}
  for (const t of topics.value) map[t.humanDriver] = (map[t.humanDriver] || 0) + 1
  return driverOptions
    .filter((o) => map[o.value as string])
    .map((o) => ({
      label: o.label,
      count: map[o.value as string],
      color: driverColors[o.value as keyof typeof driverColors],
    }))
})
const emotionDist = computed(() => {
  const map: Record<string, number> = {}
  for (const t of topics.value) map[t.emotion] = (map[t.emotion] || 0) + 1
  return emotionOptions
    .filter((o) => map[o.value as string])
    .map((o) => ({
      label: o.label,
      count: map[o.value as string],
      color: emotionColors[o.value as keyof typeof emotionColors],
    }))
})
const avgScore = computed(() => {
  if (!topics.value.length) return 0
  const sum = topics.value.reduce((s, t) => s + (t.score || 0), 0)
  return Math.round(sum / topics.value.length)
})
const maxDist = computed(() =>
  Math.max(
    1,
    ...statusDist.value.map((d) => d.count),
    ...driverDist.value.map((d) => d.count),
    ...emotionDist.value.map((d) => d.count),
  ),
)

onBeforeUnmount(() => {
  // 无定时器，占位
})

// 首次加载
loadTopics()
</script>

<template>
  <div class="page-container" aria-label="E 选题引擎">
    <!-- 页面标题区 -->
    <div class="page-header">
      <div class="page-header-left">
        <h1 class="page-title">E·选题策划</h1>
        <p class="page-subtitle">基于人性洞察库自动生成选题，支持状态流转、A/B变体与排期，驱动脚本创作</p>
      </div>
    </div>

    <el-tabs type="border-card" aria-label="选题功能分区">
      <!-- ===== 1. 选题生成 ===== -->
      <el-tab-pane label="选题生成">
        <template #label><span aria-label="选题生成标签页">选题生成</span></template>
        <div class="card">
          <el-form :inline="true" @submit.prevent>
            <el-form-item label="人性">
              <el-select
                v-model="genForm.driver"
                placeholder="全部"
                clearable
                size="default"
                style="width: 130px"
                aria-label="人性倾向"
              >
                <el-option v-for="opt in driverOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="情绪">
              <el-select
                v-model="genForm.emotion"
                placeholder="全部"
                clearable
                size="default"
                style="width: 130px"
                aria-label="情绪倾向"
              >
                <el-option v-for="opt in emotionOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="数量">
              <el-input-number
                v-model="genForm.limit"
                :min="1"
                :max="50"
                controls-position="right"
                size="default"
                style="width: 120px"
                aria-label="生成数量"
              />
            </el-form-item>
            <el-form-item label="洞察分析ID">
              <el-input
                v-model="genForm.analysisId"
                placeholder="可选"
                type="number"
                size="default"
                style="width: 130px"
                aria-label="洞察分析ID"
                clearable
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="genSubmitting" @click="handleGenerate">
                聚合生成选题
              </el-button>
            </el-form-item>
          </el-form>
        </div>

        <el-alert
          v-if="genTrace"
          type="success"
          :closable="false"
          show-icon
          class="trace-alert"
          :title="`本次生成 traceId：${genTrace}（共 ${genResult.length} 条）`"
        />

        <div class="section-header">
          <h3 class="section-title">本次生成结果</h3>
        </div>
        <el-empty v-if="!genResult.length" description="点击生成，消费 D 洞察库产出选题" />
        <div v-else class="topic-cards">
          <div v-for="t in genResult" :key="t.id" class="card topic-card">
            <div class="topic-title">{{ t.title }}</div>
            <div class="topic-meta">
              <el-tag
                v-for="tg in topicTags(t)"
                :key="tg.label"
                :color="tg.color"
                size="small"
                class="top-tag"
              >{{ tg.label }}</el-tag>
              <el-tag :type="topicStatusMeta[t.status].type" size="small">
                {{ topicStatusMeta[t.status].label }}
              </el-tag>
              <span class="score">score {{ t.score }}</span>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- ===== 2. 选题库 ===== -->
      <el-tab-pane label="选题库">
        <template #label><span aria-label="选题库标签页">选题库</span></template>
        <div class="card filter-section">
          <el-form :inline="true" @submit.prevent>
            <el-form-item label="人性">
              <el-select
                v-model="topicFilters.driver"
                placeholder="全部"
                clearable
                size="default"
                style="width: 130px"
                aria-label="人性筛选"
                @change="handleTopicFilter"
              >
                <el-option v-for="opt in driverOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="情绪">
              <el-select
                v-model="topicFilters.emotion"
                placeholder="全部"
                clearable
                size="default"
                style="width: 130px"
                aria-label="情绪筛选"
                @change="handleTopicFilter"
              >
                <el-option v-for="opt in emotionOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="状态">
              <el-select
                v-model="topicFilters.status"
                placeholder="全部"
                clearable
                size="default"
                style="width: 130px"
                aria-label="状态筛选"
                @change="handleTopicFilter"
              >
                <el-option v-for="opt in topicStatusOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="handleTopicFilter">查询</el-button>
              <el-button @click="loadTopics">刷新</el-button>
            </el-form-item>
          </el-form>
        </div>
        <el-table
          v-loading="topicLoading"
          :data="topics"
          stripe
          aria-label="选题库列表"
          row-key="id"
        >
          <template #empty>
            <el-empty description="暂无选题数据" />
          </template>
          <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
          <el-table-column label="人性/情绪" width="160">
            <template #default="{ row }">
              <el-tag
                v-for="tg in topicTags(row as Topic)"
                :key="tg.label"
                :color="tg.color"
                size="small"
                class="top-tag"
              >{{ tg.label }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="score" label="评分" width="90" align="right" sortable />
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="topicStatusMeta[(row as Topic).status].type" size="small">
                {{ topicStatusMeta[(row as Topic).status].label }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="变体" width="90">
            <template #default="{ row }">
              <el-tag v-if="(row as Topic).abVariantOf" type="warning" size="small">A/B</el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column prop="scheduledAt" label="排期" min-width="170" show-overflow-tooltip>
            <template #default="{ row }">{{ formatDateTime((row as Topic).scheduledAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" min-width="280" fixed="right" align="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openEdit(row as Topic)">编辑</el-button>
              <el-button link type="warning" :loading="abSubmitting[(row as Topic).id]" @click="handleCreateAb(row as Topic)">A/B变体</el-button>
              <el-button link type="success" @click="openSchedule(row as Topic)">排期</el-button>
              <el-button
                v-if="canAdvance(row as Topic)"
                link
                type="primary"
                :loading="advanceSubmitting[(row as Topic).id]"
                @click="handleAdvance(row as Topic)"
              >推进→{{ nextStatusLabel(row as Topic) }}</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="pager">
          <el-pagination
            :current-page="topicPage"
            :page-size="topicPageSize"
            :total="topicTotal"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next"
            background
            aria-label="选题分页"
            @current-change="handleTopicPageChange"
            @size-change="handleTopicSizeChange"
          />
        </div>
      </el-tab-pane>

      <!-- ===== 3. 统计概览 ===== -->
      <el-tab-pane label="统计概览">
        <template #label><span aria-label="统计概览标签页">统计概览</span></template>
        <el-alert
          type="info"
          :closable="false"
          show-icon
          class="compliance-alert"
          title="合规说明：仅存聚合洞察结论与选题元数据，不留存个人信息。"
        />
        <el-empty v-if="!topics.length && !topicLoading" description="暂无选题数据" />
        <div v-else v-loading="topicLoading" class="stat-wrap">
          <div class="stat-cards">
            <div class="card stat-card">
              <div class="stat-num">{{ topicTotal }}</div>
              <div class="stat-label">选题总数</div>
            </div>
            <div class="card stat-card">
              <div class="stat-num">{{ avgScore }}</div>
              <div class="stat-label">平均评分</div>
            </div>
            <div class="card stat-card">
              <div class="stat-num">{{ statusDist.length }}</div>
              <div class="stat-label">状态分布数</div>
            </div>
          </div>

          <div class="section-header">
            <h3 class="section-title">状态分布</h3>
          </div>
          <div class="bar-list">
            <div v-for="d in statusDist" :key="d.value" class="bar-row">
              <span class="bar-label">{{ d.label }}</span>
              <div class="bar-track">
                <div class="bar-fill" :style="{ width: `${(d.count / maxDist) * 100}%`, background: 'var(--app-brand-400)' }" />
              </div>
              <span class="bar-num">{{ d.count }}</span>
            </div>
          </div>

          <div class="section-header">
            <h3 class="section-title">人性分布</h3>
          </div>
          <div class="bar-list">
            <div v-for="d in driverDist" :key="d.label" class="bar-row">
              <span class="bar-label">{{ d.label }}</span>
              <div class="bar-track">
                <div class="bar-fill" :style="{ width: `${(d.count / maxDist) * 100}%`, background: d.color }" />
              </div>
              <span class="bar-num">{{ d.count }}</span>
            </div>
          </div>

          <div class="section-header">
            <h3 class="section-title">情绪分布</h3>
          </div>
          <div class="bar-list">
            <div v-for="d in emotionDist" :key="d.label" class="bar-row">
              <span class="bar-label">{{ d.label }}</span>
              <div class="bar-track">
                <div class="bar-fill" :style="{ width: `${(d.count / maxDist) * 100}%`, background: d.color }" />
              </div>
              <span class="bar-num">{{ d.count }}</span>
            </div>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 编辑抽屉 -->
    <TopicFormDrawer v-model="editDrawer" :topic="editingTopic" @saved="afterEdit" />

    <!-- 排期抽屉 -->
    <el-drawer
      v-model="scheduleDrawer"
      title="选题排期"
      size="480px"
      aria-label="选题排期抽屉"
    >
      <el-form label-width="90px" @submit.prevent>
        <el-form-item label="排期时间">
          <el-date-picker
            v-model="scheduleForm.scheduledAt"
            type="datetime"
            placeholder="选择排期时间"
            value-format="YYYY-MM-DDTHH:mm:ss"
            style="width: 100%"
            aria-label="排期时间"
          />
        </el-form-item>
        <el-form-item label="账号ID">
          <el-input v-model="scheduleForm.accountId" placeholder="可选，目标账号" size="default" aria-label="账号ID" clearable />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="scheduleDrawer = false">取消</el-button>
        <el-button type="primary" :loading="scheduleSubmitting" @click="handleSchedule">确认排期</el-button>
      </template>
    </el-drawer>
  </div>
</template>

<style scoped>
.topic-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.form-card,
.filter-card {
  margin-bottom: 12px;
}
.trace-alert {
  margin-bottom: 12px;
}
.sub-title {
  margin: 16px 0 12px;
  font-size: 15px;
  color: var(--app-neutral-700);
}
.compliance-alert {
  margin-bottom: 12px;
}
.topic-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
}
.topic-card {
  height: 100%;
}
.topic-title {
  font-weight: 600;
  color: var(--app-neutral-800);
  margin-bottom: 8px;
}
.topic-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.status-tag {
  border: none;
}
.score {
  font-size: 12px;
  color: var(--app-neutral-400);
}
.mini-tag {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 12px;
  line-height: 18px;
  color: #fff;
  margin-right: 4px;
}
.stat-wrap {
  min-height: 120px;
}
.stat-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
.stat-card {
  text-align: center;
}
.stat-num {
  font-size: 28px;
  font-weight: 700;
  color: var(--app-brand-600);
}
.stat-label {
  font-size: 13px;
  color: var(--app-neutral-400);
  margin-top: 4px;
}
.bar-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.bar-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.bar-label {
  width: 64px;
  text-align: right;
  color: var(--app-neutral-500);
  font-size: 13px;
}
.bar-track {
  flex: 1;
  background: var(--app-neutral-100);
  border-radius: 6px;
  height: 18px;
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  border-radius: 6px;
  transition: width 0.4s ease;
}
.bar-num {
  width: 60px;
  text-align: right;
  font-size: 13px;
  color: var(--app-neutral-400);
}
.pager {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
