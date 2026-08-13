<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  generateMaterial,
  uploadMaterial,
  listMaterials,
  addTag,
  type MaterialView,
  type MaterialType,
} from '@/api/materials'
import { formatDateTime } from '@/utils/format'
import {
  materialTypeMeta,
  materialTypeOptions,
  materialSourceMeta,
  aiSourceOptions,
  materialStatusMeta,
} from './materialMaps'

// ============ 1. 素材库 ============
const libLoading = ref(false)
const materials = ref<MaterialView[]>([])
const libFilters = reactive<{ type: MaterialType | undefined; tag: string | undefined }>({
  type: undefined,
  tag: undefined,
})

function normalizeList(data: unknown): MaterialView[] {
  if (!data) return []
  if (Array.isArray(data)) return data as MaterialView[]
  if (typeof data === 'object' && 'list' in (data as Record<string, unknown>)) {
    return ((data as { list: MaterialView[] }).list || []) as MaterialView[]
  }
  return []
}

async function loadMaterials() {
  libLoading.value = true
  try {
    const params: { type?: MaterialType; tag?: string } = {}
    if (libFilters.type) params.type = libFilters.type
    if (libFilters.tag) params.tag = libFilters.tag
    const res = await listMaterials(params)
    materials.value = normalizeList(res)
  } catch {
    // 拦截器已提示
  } finally {
    libLoading.value = false
  }
}
function handleLibFilter() {
  loadMaterials()
}

// 追加标签
const tagSubmitting = reactive<Record<number, boolean>>({})
const tagInput = reactive<Record<number, string>>({})
async function handleAddTag(m: MaterialView) {
  const raw = (tagInput[m.id] || '').trim()
  if (!raw) {
    ElMessage.warning('请输入标签（逗号分隔）')
    return
  }
  const tags = raw
    .split(/[,，]/)
    .map((t) => t.trim())
    .filter(Boolean)
  if (!tags.length) {
    ElMessage.warning('请输入有效标签')
    return
  }
  tagSubmitting[m.id] = true
  try {
    const updated = await addTag(m.id, { tags })
    const idx = materials.value.findIndex((x) => x.id === m.id)
    if (idx >= 0) materials.value[idx] = updated
    tagInput[m.id] = ''
    ElMessage.success('标签已追加')
  } catch {
    // 拦截器已提示
  } finally {
    tagSubmitting[m.id] = false
  }
}

// ============ 2. AI 生成 ============
const genForm = reactive<{
  type: 'image' | 'video'
  source: 'jimeng' | 'keling' | 'local'
  prompt: string
  relatedScriptId: number | undefined
  ratio: string
}>({
  type: 'image',
  source: 'jimeng',
  prompt: '',
  relatedScriptId: undefined,
  ratio: '',
})
const genSubmitting = ref(false)
const genResult = ref<MaterialView | null>(null)

async function handleGenerate() {
  if (!genForm.prompt.trim()) {
    ElMessage.warning('请输入生成提示词')
    return
  }
  genSubmitting.value = true
  try {
    const res = await generateMaterial({
      type: genForm.type,
      source: genForm.source,
      prompt: genForm.prompt.trim(),
      relatedScriptId: genForm.relatedScriptId || undefined,
      ratio: genForm.ratio.trim() || undefined,
    })
    genResult.value = res
    ElMessage.success('已提交 AI 生成')
    loadMaterials()
  } catch {
    // 拦截器已提示
  } finally {
    genSubmitting.value = false
  }
}

// ============ 3. 实拍上传 ============
const upForm = reactive<{
  type: MaterialType
  url: string
  relatedScriptId: number | undefined
  ratio: string
  tags: string
}>({
  type: 'image',
  url: '',
  relatedScriptId: undefined,
  ratio: '',
  tags: '',
})
const upSubmitting = ref(false)
const upResult = ref<MaterialView | null>(null)

async function handleUpload() {
  if (!upForm.url.trim()) {
    ElMessage.warning('请输入素材地址 url')
    return
  }
  const tags = upForm.tags
    .split(/[,，]/)
    .map((t) => t.trim())
    .filter(Boolean)
  upSubmitting.value = true
  try {
    const res = await uploadMaterial({
      type: upForm.type,
      source: 'upload',
      url: upForm.url.trim(),
      relatedScriptId: upForm.relatedScriptId || undefined,
      ratio: upForm.ratio.trim() || undefined,
      tags: tags.length ? tags : undefined,
    })
    upResult.value = res
    ElMessage.success('实拍素材已上传')
    loadMaterials()
  } catch {
    // 拦截器已提示
  } finally {
    upSubmitting.value = false
  }
}

onMounted(() => {
  loadMaterials()
})
</script>

<template>
  <div class="page-container" aria-label="G 素材中心">
    <!-- 页面标题区 -->
    <div class="page-header">
      <div>
        <h1 class="page-title">G·素材中心</h1>
        <p class="page-subtitle">管理 AI 生成、实拍上传的图片/视频素材，标签化管理，源透明追溯</p>
      </div>
    </div>

    <el-tabs type="border-card" aria-label="素材功能分区">
      <!-- ===== 1. 素材库 ===== -->
      <el-tab-pane label="素材库">
        <template #label><span aria-label="素材库标签页">素材库</span></template>
        <el-card shadow="never" class="filter-card">
          <el-form :inline="true" @submit.prevent>
            <el-form-item label="类型">
              <el-select
                v-model="libFilters.type"
                placeholder="全部"
                clearable
                style="width: 140px"
                aria-label="素材类型筛选"
                @change="handleLibFilter"
              >
                <el-option v-for="opt in materialTypeOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="标签">
              <el-input
                v-model="libFilters.tag"
                placeholder="输入标签过滤"
                clearable
                style="width: 180px"
                aria-label="标签筛选"
                @keyup.enter="handleLibFilter"
                @clear="handleLibFilter"
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="handleLibFilter">查询</el-button>
              <el-button @click="loadMaterials">刷新</el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <div v-loading="libLoading" class="lib-body">
          <el-empty v-if="!libLoading && !materials.length" description="暂无素材" />
          <div v-else class="material-cards">
            <el-card
              v-for="m in materials"
              :key="m.id"
              shadow="hover"
              class="material-card"
              :aria-label="`素材 ${m.id}`"
            >
              <div class="thumb">
                <img v-if="m.url" :src="m.url" :alt="`素材 ${m.id}`" class="thumb-img" />
                <div v-else class="thumb-empty">生成中 / 无地址</div>
              </div>
              <div class="m-meta">
                <div class="m-tags">
                  <span class="mini-tag" :style="{ background: materialTypeMeta[m.type].color, color: 'var(--el-bg-color)' }">
                    {{ materialTypeMeta[m.type].label }}
                  </span>
                  <span class="mini-tag" :style="{ background: materialSourceMeta[m.source].color, color: 'var(--el-bg-color)' }">
                    {{ materialSourceMeta[m.source].label }}
                  </span>
                  <el-tag :type="materialStatusMeta[m.status].type" size="small">
                    {{ materialStatusMeta[m.status].label }}
                  </el-tag>
                </div>
                <div v-if="m.ratio" class="m-line">比例：{{ m.ratio }}</div>
                <div v-if="m.relatedScriptId" class="m-line">脚本 #{{ m.relatedScriptId }}</div>
                <div v-if="m.tags && m.tags.length" class="m-tags">
                  <el-tag
                    v-for="t in m.tags"
                    :key="t"
                    size="small"
                    type="info"
                    effect="plain"
                  >{{ t }}</el-tag>
                </div>
                <div class="m-time">{{ formatDateTime(m.createdAt) }}</div>

                <div class="m-tag-add">
                  <el-input
                    v-model="tagInput[m.id]"
                    size="small"
                    placeholder="追加标签，逗号分隔"
                    style="flex: 1"
                    aria-label="追加标签输入"
                    @keyup.enter="handleAddTag(m)"
                  />
                  <el-button
                    size="small"
                    type="primary"
                    :loading="tagSubmitting[m.id]"
                    @click="handleAddTag(m)"
                  >追加标签</el-button>
                </div>
              </div>
            </el-card>
          </div>
        </div>
      </el-tab-pane>

      <!-- ===== 2. AI 生成 ===== -->
      <el-tab-pane label="AI 生成">
        <template #label><span aria-label="AI生成标签页">AI 生成</span></template>
        <el-card shadow="never" class="form-card">
          <el-form label-width="110px" @submit.prevent>
            <el-form-item label="素材类型">
              <el-select v-model="genForm.type" style="width: 220px" aria-label="生成素材类型">
                <el-option label="图片 image" value="image" />
                <el-option label="视频 video" value="video" />
              </el-select>
            </el-form-item>
            <el-form-item label="来源 Provider">
              <el-select v-model="genForm.source" style="width: 220px" aria-label="生成来源">
                <el-option v-for="opt in aiSourceOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="提示词 prompt">
              <el-input
                v-model="genForm.prompt"
                type="textarea"
                :rows="4"
                placeholder="描述画面/视频内容"
                aria-label="生成提示词"
              />
            </el-form-item>
            <el-form-item label="关联脚本 ID">
              <el-input
                v-model.number="genForm.relatedScriptId"
                type="number"
                placeholder="可选"
                style="width: 220px"
                aria-label="关联脚本id"
                clearable
              />
            </el-form-item>
            <el-form-item label="比例 ratio">
              <el-input
                v-model="genForm.ratio"
                placeholder="可选，如 16:9"
                style="width: 220px"
                aria-label="素材比例"
                clearable
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="genSubmitting" @click="handleGenerate">提交生成</el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <h4 class="sub-title">生成结果</h4>
        <el-empty v-if="!genResult" description="填写提示词并提交，经源透明 Provider 生成素材" />
        <el-card v-else shadow="hover" class="result-card">
          <div class="res-meta">
            <span class="mini-tag" :style="{ background: materialTypeMeta[genResult.type].color, color: 'var(--el-bg-color)' }">
              {{ materialTypeMeta[genResult.type].label }}
            </span>
            <el-tag v-if="genResult.meta && genResult.meta.provider" type="warning" size="small">
              源透明：{{ genResult.meta.provider }}
            </el-tag>
            <el-tag :type="materialStatusMeta[genResult.status].type" size="small">{{ materialStatusMeta[genResult.status].label }}</el-tag>
          </div>
          <div v-if="genResult.meta && genResult.meta.prompt" class="res-block">
            <div class="res-label">提示词</div>
            <div>{{ genResult.meta.prompt }}</div>
          </div>
          <div v-if="genResult.url" class="res-block">
            <div class="res-label">地址</div>
            <a :href="genResult.url" target="_blank" rel="noopener">{{ genResult.url }}</a>
          </div>
          <div v-if="genResult.ratio" class="res-block">比例：{{ genResult.ratio }}</div>
          <div class="m-time">{{ formatDateTime(genResult.createdAt) }}</div>
        </el-card>
      </el-tab-pane>

      <!-- ===== 3. 实拍上传 ===== -->
      <el-tab-pane label="实拍上传">
        <template #label><span aria-label="实拍上传标签页">实拍上传</span></template>
        <el-alert
          type="info"
          :closable="false"
          show-icon
          class="compliance-alert"
          title="合规说明：素材源自自有脚本/AI 生成/实拍上传，源透明记录 provider，无单条个人信息。"
        />
        <el-card shadow="never" class="form-card">
          <el-form label-width="110px" @submit.prevent>
            <el-form-item label="素材类型">
              <el-select v-model="upForm.type" style="width: 220px" aria-label="上传素材类型">
                <el-option v-for="opt in materialTypeOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="来源">
              <el-input :model-value="'upload（上传）'" disabled aria-label="来源固定上传" />
            </el-form-item>
            <el-form-item label="素材地址 url">
              <el-input v-model="upForm.url" placeholder="素材可访问地址" aria-label="素材地址" />
            </el-form-item>
            <el-form-item label="关联脚本 ID">
              <el-input
                v-model.number="upForm.relatedScriptId"
                type="number"
                placeholder="可选"
                style="width: 220px"
                aria-label="关联脚本id"
                clearable
              />
            </el-form-item>
            <el-form-item label="比例 ratio">
              <el-input
                v-model="upForm.ratio"
                placeholder="可选，如 16:9"
                style="width: 220px"
                aria-label="素材比例"
                clearable
              />
            </el-form-item>
            <el-form-item label="标签 tags">
              <el-input
                v-model="upForm.tags"
                placeholder="可选，逗号分隔"
                style="width: 320px"
                aria-label="素材标签"
                clearable
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="upSubmitting" @click="handleUpload">提交上传</el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <h4 class="sub-title">上传结果</h4>
        <el-empty v-if="!upResult" description="填写素材地址并提交，记录实拍上传素材" />
        <el-card v-else shadow="hover" class="result-card">
          <div class="res-meta">
            <span class="mini-tag" :style="{ background: materialTypeMeta[upResult.type].color, color: 'var(--el-bg-color)' }">
              {{ materialTypeMeta[upResult.type].label }}
            </span>
            <span class="mini-tag" :style="{ background: materialSourceMeta.upload.color, color: 'var(--el-bg-color)' }">
              {{ materialSourceMeta.upload.label }}
            </span>
            <el-tag :type="materialStatusMeta[upResult.status].type" size="small">{{ materialStatusMeta[upResult.status].label }}</el-tag>
          </div>
          <div v-if="upResult.url" class="res-block">
            <div class="res-label">地址</div>
            <a :href="upResult.url" target="_blank" rel="noopener">{{ upResult.url }}</a>
          </div>
          <div v-if="upResult.tags && upResult.tags.length" class="res-block">
            <div class="res-label">标签</div>
            <el-tag v-for="t in upResult.tags" :key="t" size="small" type="info" effect="plain">{{ t }}</el-tag>
          </div>
          <div v-if="upResult.ratio" class="res-block">比例：{{ upResult.ratio }}</div>
          <div class="m-time">{{ formatDateTime(upResult.createdAt) }}</div>
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

/* 卡片 */
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
.m-time { font-size: var(--text-sm); color: var(--el-text-color-placeholder); margin-top: var(--space-sm); }

/* 素材卡片网格 */
.lib-body { min-height: 120px; }
.material-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: var(--space-md); }
.material-card { height: 100%; }

/* 缩略图 */
.thumb {
  width: 100%; aspect-ratio: 16 / 9;
  background: var(--el-fill-color-light); border-radius: var(--radius-md);
  overflow: hidden; display: flex; align-items: center; justify-content: center;
}
.thumb-img { width: 100%; height: 100%; object-fit: cover; }
.thumb-empty { font-size: var(--text-sm); color: var(--el-text-color-placeholder); }

/* 元信息 */
.m-meta { margin-top: 10px; display: flex; flex-direction: column; gap: 6px; }
.m-tags { display: flex; flex-wrap: wrap; gap: var(--space-xs); }
.m-line { font-size: var(--text-sm); color: var(--el-text-color-secondary); }
.m-tag-add { display: flex; gap: 6px; margin-top: 6px; }
</style>
