<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  fromScript,
  editVideo,
  reviewVideo,
  listVideos,
  type VideoView,
} from '@/api/videos'
import { formatDateTime } from '@/utils/format'
import {
  videoStatusMeta,
  reviewStatusMeta,
  ratioOptions,
} from './videoMaps'

// 比率标签色块样式
function ratioTagStyle(): Record<string, string> {
  return { background: 'var(--el-text-color-secondary)', color: 'var(--el-bg-color)' }
}

// 蓝色编号标签样式
function blueTagStyle(): Record<string, string> {
  return { background: 'var(--app-brand-500)', color: 'var(--el-bg-color)' }
}

// 解析逗号分隔数字
function parseIds(raw: string): number[] | undefined {
  const ids = raw
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => !Number.isNaN(n))
  return ids.length ? ids : undefined
}

// ============ 1. 视频库 ============
const libLoading = ref(false)
const videos = ref<VideoView[]>([])

function normalizeList(data: unknown): VideoView[] {
  if (!data) return []
  if (Array.isArray(data)) return data as VideoView[]
  if (typeof data === 'object' && 'list' in (data as Record<string, unknown>)) {
    return ((data as { list: VideoView[] }).list || []) as VideoView[]
  }
  return []
}

async function loadVideos() {
  libLoading.value = true
  try {
    const res = await listVideos()
    videos.value = normalizeList(res)
  } catch {
    // 拦截器已提示
  } finally {
    libLoading.value = false
  }
}

// ============ 2. 脚本转成片 ============
const genForm = reactive<{
  scriptId: number | undefined
  materialIds: string
  ratio: string
  title: string
}>({
  scriptId: undefined,
  materialIds: '',
  ratio: '',
  title: '',
})
const genSubmitting = ref(false)
const genResult = ref<VideoView | null>(null)

async function handleGenerate() {
  if (genForm.scriptId == null || Number.isNaN(genForm.scriptId)) {
    ElMessage.warning('请输入脚本 ID（必填）')
    return
  }
  genSubmitting.value = true
  try {
    const res = await fromScript({
      scriptId: genForm.scriptId,
      materialIds: parseIds(genForm.materialIds),
      ratio: genForm.ratio.trim() || undefined,
      title: genForm.title.trim() || undefined,
    })
    genResult.value = res
    ElMessage.success('已提交脚本转成片（本地 FFmpeg best-effort）')
    loadVideos()
  } catch {
    // 拦截器已提示
  } finally {
    genSubmitting.value = false
  }
}

// ============ 3. 编辑与送审 ============
const editForm = reactive<{
  videoId: number | undefined
  materialIds: string
  ratio: string
}>({
  videoId: undefined,
  materialIds: '',
  ratio: '',
})
const editSubmitting = ref(false)
const reviewSubmitting = ref(false)
const editResult = ref<VideoView | null>(null)

async function handleEdit() {
  if (editForm.videoId == null || Number.isNaN(editForm.videoId)) {
    ElMessage.warning('请输入视频 ID')
    return
  }
  editSubmitting.value = true
  try {
    const res = await editVideo(editForm.videoId, {
      materialIds: parseIds(editForm.materialIds),
      ratio: editForm.ratio.trim() || undefined,
    })
    editResult.value = res
    ElMessage.success('已提交 AI 编辑/模板化剪辑')
    loadVideos()
  } catch {
    // 拦截器已提示
  } finally {
    editSubmitting.value = false
  }
}

async function handleReview() {
  if (editForm.videoId == null || Number.isNaN(editForm.videoId)) {
    ElMessage.warning('请输入视频 ID')
    return
  }
  reviewSubmitting.value = true
  try {
    const res = await reviewVideo(editForm.videoId)
    editResult.value = res
    if (res.reviewStatus === 'rejected') {
      ElMessage.warning('合规预检未通过，已驳回')
    } else {
      ElMessage.success('送审通过，合规预检无命中')
    }
    loadVideos()
  } catch {
    // 拦截器已提示
  } finally {
    reviewSubmitting.value = false
  }
}

onMounted(() => {
  loadVideos()
})
</script>

<template>
  <div class="page-container" aria-label="H 智能成片">
    <!-- 页面标题区 -->
    <div class="page-header">
      <div>
        <h1 class="page-title">H·智能成片</h1>
        <p class="page-subtitle">脚本转成片、本地 FFmpeg 合成、合规预检送审，自研剪辑不依赖第三方</p>
      </div>
    </div>

    <el-tabs type="border-card" aria-label="成片功能分区">
      <!-- ===== 1. 视频库 ===== -->
      <el-tab-pane label="视频库">
        <template #label><span aria-label="视频库标签页">视频库</span></template>
        <div class="tab-head">
          <el-button @click="loadVideos" :loading="libLoading">刷新</el-button>
        </div>
        <div v-loading="libLoading" class="lib-body">
          <el-empty v-if="!libLoading && !videos.length" description="暂无成片" />
          <div v-else class="video-cards">
            <el-card
              v-for="v in videos"
              :key="v.id"
              shadow="hover"
              class="video-card"
              :aria-label="`成片 ${v.id}`"
            >
              <div class="thumb">
                <video v-if="v.url" :src="v.url" class="thumb-video" controls preload="none" />
                <div v-else class="thumb-empty">合成中 / 无地址</div>
              </div>
              <div class="m-meta">
                <div class="m-title">{{ v.title || `成片 #${v.id}` }}</div>
                <div class="m-tags">
                  <el-tag :type="videoStatusMeta[v.status].type" size="small">
                    {{ videoStatusMeta[v.status].label }}
                  </el-tag>
                  <el-tag :type="reviewStatusMeta[v.reviewStatus].type" size="small">
                    {{ reviewStatusMeta[v.reviewStatus].label }}
                  </el-tag>
                  <span v-if="v.ratio" class="mini-tag" :style="ratioTagStyle()">
                    {{ v.ratio }}
                  </span>
                </div>
                <div v-if="v.scriptId" class="m-line">脚本 #{{ v.scriptId }}</div>
                <div v-if="v.materialIds && v.materialIds.length" class="m-line">
                  素材：<el-tag
                    v-for="mid in v.materialIds"
                    :key="mid"
                    size="small"
                    type="info"
                    effect="plain"
                  >#{{ mid }}</el-tag>
                </div>
                <div v-if="v.duration != null" class="m-line">时长：{{ v.duration }}s</div>
                <div v-if="v.url" class="m-line url-line" :title="v.url">{{ v.url }}</div>
                <div class="m-time">{{ formatDateTime(v.createdAt) }}</div>
              </div>
            </el-card>
          </div>
        </div>
      </el-tab-pane>

      <!-- ===== 2. 脚本转成片 ===== -->
      <el-tab-pane label="脚本转成片">
        <template #label><span aria-label="脚本转成片标签页">脚本转成片</span></template>
        <el-alert
          type="info"
          :closable="false"
          show-icon
          class="compliance-alert"
          title="成片内容源自自有脚本/素材；本地 FFmpeg 自研剪辑不依赖第三方；合规预检内嵌基础词表。"
        />
        <el-card shadow="never" class="form-card">
          <el-form label-width="130px" @submit.prevent>
            <el-form-item label="脚本 ID" required>
              <el-input
                v-model.number="genForm.scriptId"
                type="number"
                placeholder="必填，关联脚本编号"
                style="width: 240px"
                aria-label="脚本id"
                clearable
              />
            </el-form-item>
            <el-form-item label="素材 IDs">
              <el-input
                v-model="genForm.materialIds"
                placeholder="可选，逗号分隔，如 11,12,13"
                style="width: 320px"
                aria-label="素材id列表"
                clearable
              />
            </el-form-item>
            <el-form-item label="比例 ratio">
              <el-select
                v-model="genForm.ratio"
                placeholder="可选"
                clearable
                style="width: 220px"
                aria-label="成片比例"
              >
                <el-option v-for="opt in ratioOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="标题 title">
              <el-input
                v-model="genForm.title"
                placeholder="可选"
                style="width: 320px"
                aria-label="成片标题"
                clearable
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="genSubmitting" @click="handleGenerate">生成成片</el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <h4 class="sub-title">生成结果</h4>
        <el-empty v-if="!genResult" description="填写脚本 ID 并提交，经本地 FFmpeg 合成成片" />
        <el-card v-else shadow="hover" class="result-card">
          <div class="res-meta">
            <span class="mini-tag" :style="blueTagStyle()">#{{ genResult.id }}</span>
            <el-tag :type="videoStatusMeta[genResult.status].type" size="small">{{ videoStatusMeta[genResult.status].label }}</el-tag>
            <el-tag :type="reviewStatusMeta[genResult.reviewStatus].type" size="small">
              {{ reviewStatusMeta[genResult.reviewStatus].label }}
            </el-tag>
          </div>
          <div v-if="genResult.title" class="res-block">
            <div class="res-label">标题</div>
            <div>{{ genResult.title }}</div>
          </div>
          <div class="res-block">
            <div class="res-label">地址</div>
            <div v-if="genResult.url">
              <a :href="genResult.url" target="_blank" rel="noopener">{{ genResult.url }}</a>
            </div>
            <div v-else class="placeholder-hint">MinIO 占位地址，本地 FFmpeg best-effort 合成</div>
          </div>
          <div v-if="genResult.scriptId" class="res-block">脚本 #{{ genResult.scriptId }}</div>
          <div v-if="genResult.ratio" class="res-block">比例：{{ genResult.ratio }}</div>
          <div v-if="genResult.meta" class="res-block">
            <div class="res-label">元信息</div>
            <pre class="meta-pre">{{ JSON.stringify(genResult.meta, null, 2) }}</pre>
          </div>
          <div class="m-time">{{ formatDateTime(genResult.createdAt) }}</div>
        </el-card>
      </el-tab-pane>

      <!-- ===== 3. 编辑与送审 ===== -->
      <el-tab-pane label="编辑与送审">
        <template #label><span aria-label="编辑与送审标签页">编辑与送审</span></template>
        <el-alert
          type="info"
          :closable="false"
          show-icon
          class="compliance-alert"
          title="成片内容源自自有脚本/素材；本地 FFmpeg 自研剪辑不依赖第三方；合规预检内嵌基础词表。"
        />
        <el-card shadow="never" class="form-card">
          <el-form label-width="130px" @submit.prevent>
            <el-form-item label="视频 ID" required>
              <el-input
                v-model.number="editForm.videoId"
                type="number"
                placeholder="必填，待编辑/送审成片编号"
                style="width: 240px"
                aria-label="视频id"
                clearable
              />
            </el-form-item>
            <el-form-item label="素材 IDs">
              <el-input
                v-model="editForm.materialIds"
                placeholder="可选，逗号分隔"
                style="width: 320px"
                aria-label="编辑素材id列表"
                clearable
              />
            </el-form-item>
            <el-form-item label="比例 ratio">
              <el-select
                v-model="editForm.ratio"
                placeholder="可选"
                clearable
                style="width: 220px"
                aria-label="编辑成片比例"
              >
                <el-option v-for="opt in ratioOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="editSubmitting" @click="handleEdit">编辑（AI 剪辑）</el-button>
              <el-button type="warning" :loading="reviewSubmitting" @click="handleReview">送审合规预检</el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <h4 class="sub-title">操作回显</h4>
        <el-empty v-if="!editResult" description="选择视频 ID，进行 AI 编辑或送审合规预检" />
        <el-card v-else shadow="hover" class="result-card">
          <el-alert
            v-if="editResult.reviewStatus === 'rejected'"
            type="error"
            :closable="false"
            show-icon
            title="已驳回：合规预检命中敏感词，请修改后重新送审。"
          />
          <div class="res-meta">
            <span class="mini-tag" :style="blueTagStyle()">#{{ editResult.id }}</span>
            <el-tag :type="videoStatusMeta[editResult.status].type" size="small">{{ videoStatusMeta[editResult.status].label }}</el-tag>
            <el-tag :type="reviewStatusMeta[editResult.reviewStatus].type" size="small">
              {{ reviewStatusMeta[editResult.reviewStatus].label }}
            </el-tag>
          </div>
          <div v-if="editResult.title" class="res-block">
            <div class="res-label">标题</div>
            <div>{{ editResult.title }}</div>
          </div>
          <div v-if="editResult.url" class="res-block">
            <div class="res-label">地址</div>
            <a :href="editResult.url" target="_blank" rel="noopener">{{ editResult.url }}</a>
          </div>
          <div v-if="editResult.meta && editResult.meta.compliance" class="res-block">
            <div class="res-label">合规预检</div>
            <pre class="meta-pre">{{ JSON.stringify(editResult.meta.compliance, null, 2) }}</pre>
          </div>
          <div class="m-time">{{ formatDateTime(editResult.updatedAt) }}</div>
        </el-card>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
/* 页面标题区 */
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-lg); }
.page-title { font-size: var(--text-2xl); font-weight: 700; color: var(--el-text-color-primary); margin: 0 0 4px 0; }
.page-subtitle { font-size: var(--text-base); color: var(--el-text-color-secondary); margin: 0; }

/* 标签页通用 */
.tab-head { margin-bottom: var(--space-md); display: flex; justify-content: flex-end; }
.filter-card, .form-card { margin-bottom: var(--space-md); }
.compliance-alert { margin-bottom: var(--space-md); }

/* 区块标题 */
.sub-title { margin: var(--space-lg) 0 var(--space-md); font-size: var(--text-lg); color: var(--el-text-color-primary); }

/* 迷你标签 */
.mini-tag {
  display: inline-block; padding: 1px 8px; border-radius: 10px;
  font-size: var(--text-sm); line-height: 18px; color: var(--el-bg-color); margin-right: 4px;
}

/* 结果卡片 */
.result-card { margin-top: var(--space-sm); }
.res-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-bottom: var(--space-md); }
.res-block { margin-bottom: 10px; }
.res-label { font-size: var(--text-base-sm); color: var(--el-text-color-secondary); margin-bottom: 4px; }
.placeholder-hint { font-size: var(--text-sm); color: var(--el-text-color-placeholder); }

/* 元信息 pre */
.meta-pre {
  margin: 0; padding: var(--space-sm) 10px;
  background: var(--app-neutral-50); border-radius: var(--radius-md);
  font-size: var(--text-sm); color: var(--el-text-color-primary);
  white-space: pre-wrap; word-break: break-all;
}

/* 时间 */
.m-time { font-size: var(--text-sm); color: var(--el-text-color-placeholder); margin-top: var(--space-sm); }

/* 视频卡片网格 */
.lib-body { min-height: 120px; }
.video-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: var(--space-md); }
.video-card { height: 100%; }

/* 缩略图 */
.thumb {
  width: 100%; aspect-ratio: 16 / 9;
  background: var(--el-fill-color-light); border-radius: var(--radius-md);
  overflow: hidden; display: flex; align-items: center; justify-content: center;
}
.thumb-video { width: 100%; height: 100%; object-fit: cover; }
.thumb-empty { font-size: var(--text-sm); color: var(--el-text-color-placeholder); }

/* 元信息 */
.m-meta { margin-top: 10px; display: flex; flex-direction: column; gap: 6px; }
.m-title { font-size: var(--text-base); font-weight: 600; color: var(--el-text-color-primary); }
.m-tags { display: flex; flex-wrap: wrap; gap: var(--space-xs); align-items: center; }
.m-line { font-size: var(--text-sm); color: var(--el-text-color-secondary); }
.url-line { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
</style>
