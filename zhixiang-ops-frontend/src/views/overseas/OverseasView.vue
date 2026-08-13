<template>
  <div class="page-container">
    <!-- 页面标题区 -->
    <div class="page-header">
      <div class="page-header-left">
        <h1 class="page-title">U · 出海管理</h1>
        <p class="page-subtitle">海外平台、出海视频多语言译制、译制任务与出海概览</p>
      </div>
    </div>

    <el-tabs v-model="tab" class="card">
      <!-- 概览 -->
      <el-tab-pane label="出海概览" name="overview">
        <el-skeleton v-if="summaryLoading" :rows="4" />
        <template v-else-if="summary">
          <el-descriptions :column="4" border>
            <el-descriptions-item label="平台数">{{ summary.platformCount }}</el-descriptions-item>
            <el-descriptions-item label="视频数">{{ summary.videoCount }}</el-descriptions-item>
            <el-descriptions-item label="已发布">{{ summary.publishedCount }}</el-descriptions-item>
            <el-descriptions-item label="任务数">{{ summary.taskCount }}</el-descriptions-item>
          </el-descriptions>
          <div class="status-row">
            <span class="status-label">视频状态分布：</span>
            <el-tag v-for="(v, k) in summary.byStatus" :key="k" size="small" class="perm-tag">{{ k }}: {{ v }}</el-tag>
          </div>
        </template>
        <el-empty v-else description="暂无出海数据" />
      </el-tab-pane>

      <!-- 平台 -->
      <el-tab-pane label="海外平台" name="platform">
        <div class="filter-bar">
          <el-button type="primary" @click="platformDialog=true">新建平台</el-button>
        </div>
        <el-table :data="platforms" v-loading="platformLoading" stripe class="data-table">
          <el-table-column prop="code" label="代码" width="120" />
          <el-table-column prop="name" label="名称" min-width="140" />
          <el-table-column prop="region" label="地区" width="120" />
          <el-table-column prop="baseLang" label="基准语言" width="120" />
        </el-table>
      </el-tab-pane>

      <!-- 视频 -->
      <el-tab-pane label="出海视频" name="video">
        <div class="filter-bar">
          <el-button type="primary" @click="openCreateVideo">新建视频</el-button>
        </div>
        <el-table :data="videos" v-loading="videoLoading" stripe class="data-table">
          <el-table-column prop="sourceVideoId" label="源视频ID" width="100" />
          <el-table-column prop="platformId" label="平台ID" width="90" />
          <el-table-column prop="title" label="标题" min-width="160" show-overflow-tooltip />
          <el-table-column prop="targetLang" label="目标语言" width="100" />
          <el-table-column prop="status" label="状态" width="110">
            <template #default="{ row }"><el-tag :type="videoStatusType(row.status)" size="small">{{ row.status }}</el-tag></template>
          </el-table-column>
          <el-table-column prop="url" label="链接" min-width="160" show-overflow-tooltip />
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }"><el-button link type="primary" @click="openEditVideo(row)">编辑</el-button></template>
          </el-table-column>
        </el-table>
        <el-pagination class="pager" layout="total, prev, pager, next" :total="videoTotal"
          :page-size="videoPageSize" :current-page="videoPage"
          @current-change="(p:number)=>{videoPage=p;loadVideos()}" />
      </el-tab-pane>

      <!-- 译制任务 -->
      <el-tab-pane label="译制任务" name="task">
        <div class="filter-bar">
          <el-button type="primary" @click="taskDialog=true">新建译制任务</el-button>
        </div>
        <el-table :data="tasks" v-loading="taskLoading" stripe class="data-table">
          <el-table-column prop="videoId" label="视频ID" width="90" />
          <el-table-column prop="sourceLang" label="源语言" width="90" />
          <el-table-column prop="targetLang" label="目标语言" width="100" />
          <el-table-column prop="status" label="状态" width="100">
            <template #default="{ row }"><el-tag :type="taskStatusType(row.status)" size="small">{{ row.status }}</el-tag></template>
          </el-table-column>
          <el-table-column prop="translatedScript" label="译制脚本" min-width="200" show-overflow-tooltip />
        </el-table>
        <el-pagination class="pager" layout="total, prev, pager, next" :total="taskTotal"
          :page-size="taskPageSize" :current-page="taskPage"
          @current-change="(p:number)=>{taskPage=p;loadTasks()}" />
      </el-tab-pane>
    </el-tabs>

    <!-- 平台 -->
    <el-dialog v-model="platformDialog" title="新建海外平台" width="480px">
      <el-form :model="platformForm" label-width="90px">
        <el-form-item label="代码"><el-input v-model="platformForm.code" /></el-form-item>
        <el-form-item label="名称"><el-input v-model="platformForm.name" /></el-form-item>
        <el-form-item label="地区"><el-input v-model="platformForm.region" /></el-form-item>
        <el-form-item label="基准语言"><el-input v-model="platformForm.baseLang" placeholder="如 en" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="platformDialog=false">取消</el-button>
        <el-button type="primary" @click="submitPlatform">保存</el-button>
      </template>
    </el-dialog>

    <!-- 视频 新建/编辑 -->
    <el-dialog v-model="videoDialog" :title="videoForm.id?'编辑视频':'新建视频'" width="520px">
      <el-form :model="videoForm" label-width="90px">
        <el-form-item label="源视频ID" v-if="!videoForm.id"><el-input v-model.number="videoForm.sourceVideoId" type="number" /></el-form-item>
        <el-form-item label="平台ID" v-if="!videoForm.id"><el-input v-model.number="videoForm.platformId" type="number" /></el-form-item>
        <el-form-item label="标题"><el-input v-model="videoForm.title" /></el-form-item>
        <el-form-item label="目标语言">
          <el-select v-model="videoForm.targetLang" style="width:100%">
            <el-option v-for="l in LANGS" :key="l" :label="l" :value="l" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="videoForm.status" style="width:100%">
            <el-option v-for="s in VIDEO_STATUSES" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item label="链接"><el-input v-model="videoForm.url" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="videoDialog=false">取消</el-button>
        <el-button type="primary" @click="submitVideo">保存</el-button>
      </template>
    </el-dialog>

    <!-- 译制任务 -->
    <el-dialog v-model="taskDialog" title="新建译制任务" width="520px">
      <el-form :model="taskForm" label-width="90px">
        <el-form-item label="视频ID"><el-input v-model.number="taskForm.videoId" type="number" /></el-form-item>
        <el-form-item label="源语言"><el-input v-model="taskForm.sourceLang" placeholder="默认 zh" /></el-form-item>
        <el-form-item label="目标语言">
          <el-select v-model="taskForm.targetLang" style="width:100%">
            <el-option v-for="l in LANGS" :key="l" :label="l" :value="l" />
          </el-select>
        </el-form-item>
        <el-form-item label="源文案"><el-input v-model="taskForm.sourceText" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="taskDialog=false">取消</el-button>
        <el-button type="primary" @click="submitTask">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  listPlatforms, createPlatform, listVideos, createVideo, updateVideo,
  listTasks, createTask, getSummary,
  type OverseasPlatform, type OverseasVideo, type TranslationTask, type OverseasSummary,
  type OverseasVideoStatus,
} from '@/api/overseas'

const tab = ref<'overview' | 'platform' | 'video' | 'task'>('overview')
const LANGS = ['zh', 'en', 'ja', 'ko', 'es', 'fr', 'de', 'pt', 'ru', 'ar']
const VIDEO_STATUSES: OverseasVideoStatus[] = ['draft', 'translating', 'published', 'failed']

// 概览
const summary = ref<OverseasSummary | null>(null)
const summaryLoading = ref(false)
async function loadSummary() {
  summaryLoading.value = true
  try { summary.value = await getSummary() } catch { /* */ } finally { summaryLoading.value = false }
}

// 平台
const platforms = ref<OverseasPlatform[]>([])
const platformLoading = ref(false)
async function loadPlatforms() {
  platformLoading.value = true
  try { platforms.value = await listPlatforms() } catch { /* */ } finally { platformLoading.value = false }
}
const platformDialog = ref(false)
const platformForm = ref<{ code: string; name: string; region?: string; baseLang?: string }>({ code: '', name: '', region: '', baseLang: '' })
async function submitPlatform() {
  if (!platformForm.value.code || !platformForm.value.name) { ElMessage.warning('请填写代码和名称'); return }
  try { await createPlatform({ code: platformForm.value.code, name: platformForm.value.name, region: platformForm.value.region, baseLang: platformForm.value.baseLang }); ElMessage.success('已创建'); platformDialog.value = false; loadPlatforms() } catch { /* */ }
}

// 视频
const videos = ref<OverseasVideo[]>([])
const videoLoading = ref(false)
const videoPage = ref(1)
const videoPageSize = ref(10)
const videoTotal = ref(0)
async function loadVideos() {
  videoLoading.value = true
  try { const res = await listVideos({ page: videoPage.value, pageSize: videoPageSize.value }); videos.value = res.list; videoTotal.value = res.total } catch { /* */ } finally { videoLoading.value = false }
}
const videoDialog = ref(false)
const videoForm = ref<{ id?: number; sourceVideoId?: number; platformId?: number; title?: string; targetLang: string; status?: OverseasVideoStatus; url?: string }>({ sourceVideoId: undefined, platformId: undefined, title: '', targetLang: 'en', status: 'draft', url: '' })
function openCreateVideo() { videoForm.value = { sourceVideoId: undefined, platformId: undefined, title: '', targetLang: 'en', status: 'draft', url: '' }; videoDialog.value = true }
function openEditVideo(row: OverseasVideo) { videoForm.value = { id: row.id, title: row.title, targetLang: row.targetLang, status: row.status, url: row.url }; videoDialog.value = true }
async function submitVideo() {
  try {
    if (videoForm.value.id) {
      await updateVideo(videoForm.value.id, { title: videoForm.value.title, status: videoForm.value.status, url: videoForm.value.url })
      ElMessage.success('已更新')
    } else {
      if (!videoForm.value.sourceVideoId || !videoForm.value.platformId) { ElMessage.warning('请填写源视频ID与平台ID'); return }
      await createVideo({ sourceVideoId: videoForm.value.sourceVideoId!, platformId: videoForm.value.platformId!, title: videoForm.value.title, targetLang: videoForm.value.targetLang, status: videoForm.value.status })
      ElMessage.success('已创建')
    }
    videoDialog.value = false; loadVideos(); loadSummary()
  } catch { /* */ }
}

// 任务
const tasks = ref<TranslationTask[]>([])
const taskLoading = ref(false)
const taskPage = ref(1)
const taskPageSize = ref(10)
const taskTotal = ref(0)
async function loadTasks() {
  taskLoading.value = true
  try { const res = await listTasks({ page: taskPage.value, pageSize: taskPageSize.value }); tasks.value = res.list; taskTotal.value = res.total } catch { /* */ } finally { taskLoading.value = false }
}
const taskDialog = ref(false)
const taskForm = ref<{ videoId?: number; sourceLang?: string; targetLang: string; sourceText?: string }>({ videoId: undefined, sourceLang: 'zh', targetLang: 'en', sourceText: '' })
async function submitTask() {
  if (!taskForm.value.videoId) { ElMessage.warning('请填写视频ID'); return }
  try { await createTask({ videoId: taskForm.value.videoId!, sourceLang: taskForm.value.sourceLang, targetLang: taskForm.value.targetLang, sourceText: taskForm.value.sourceText }); ElMessage.success('已提交'); taskDialog.value = false; loadTasks(); loadSummary() } catch { /* */ }
}

function videoStatusType(s: string): 'success' | 'info' | 'warning' | 'danger' {
  if (s === 'published') return 'success'
  if (s === 'failed') return 'danger'
  if (s === 'translating') return 'warning'
  return 'info'
}
function taskStatusType(s: string): 'success' | 'info' | 'warning' | 'danger' | 'primary' {
  if (s === 'done') return 'success'
  if (s === 'failed') return 'danger'
  if (s === 'translating') return 'warning'
  if (s === 'queued') return 'info'
  return 'primary'
}

onMounted(() => { loadSummary(); loadPlatforms(); loadVideos(); loadTasks() })
</script>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-lg); }
.page-title { font-size: var(--text-2xl); font-weight: 700; color: var(--el-text-color-primary); margin: 0 0 4px 0; }
.page-subtitle { font-size: var(--text-base); color: var(--el-text-color-secondary); margin: 0; }
.filter-bar { display: flex; gap: var(--space-2); flex-wrap: wrap; margin-bottom: var(--space-3); align-items: center; }
.compliance-bar { margin-bottom: 14px; background: var(--app-neutral-50); border: 1px solid var(--app-neutral-200); font-size: var(--text-base-sm); color: var(--el-text-color-regular); display: flex; align-items: flex-start; gap: var(--space-2); }
.toolbar { display: flex; gap: var(--space-2); margin-bottom: var(--space-3); }
.status-row { margin-top: var(--space-3); }
.perm-tag { margin: 2px 4px 2px 0; }
.pager { margin-top: var(--space-3); justify-content: flex-end; }
.muted { color: var(--el-text-color-secondary); font-size: var(--text-base-sm); }
.data-table { margin-top: var(--space-3); }
</style>
