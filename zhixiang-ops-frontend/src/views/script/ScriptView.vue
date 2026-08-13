<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  generateScript,
  listScripts,
  updateScript,
  checkCompliance,
  versionScript,
  listTemplates,
  type Script,
  type ScriptTemplate,
  type ComplianceRisk,
} from '@/api/script'
import { formatDateTime } from '@/utils/format'
import {
  emotionLabels,
  emotionColors,
  scriptStatusMeta,
  scriptStatusOptions,
  complianceLevelMeta,
  isHighRisk,
} from './scriptMaps'
import ScriptFormDrawer from './ScriptFormDrawer.vue'

// E 选题候选（供生成选择 topicId）
const topicCandidates = ref<{ id: number; title: string }[]>([])

// ============ 1. 生成脚本 ============
const genForm = reactive<{ topicId: number | undefined; templateId: string | undefined }>({
  topicId: undefined,
  templateId: undefined,
})
const genSubmitting = ref(false)
const genResult = ref<Script | null>(null)
const genTrace = ref('')
const genTemplates = ref<ScriptTemplate[]>([])

function loadTemplates() {
  listTemplates()
    .then((r) => {
      genTemplates.value = r.templates
    })
    .catch(() => {
      // 拦截器已提示
    })
}

function loadTopicCandidates() {
  // 复用 E 选题接口取候选（idea/todo）
  import('@/api/topic')
    .then((m) =>
      m.listTopics({ page: 1, pageSize: 100, status: 'idea,todo' }).then((r) => {
        topicCandidates.value = r.list.map((t) => ({ id: t.id, title: t.title }))
      }),
    )
    .catch(() => {
      // 拦截器已提示
    })
}

async function handleGenerate() {
  if (!genForm.topicId) {
    ElMessage.warning('请选择归属选题')
    return
  }
  genSubmitting.value = true
  try {
    const res = await generateScript({
      topicId: genForm.topicId,
      templateId: genForm.templateId || undefined,
    })
    genResult.value = res.script
    genTrace.value = res.traceId
    ElMessage.success('脚本已生成')
    loadScripts() // 自动刷新下方列表
  } catch {
    // 拦截器已提示
  } finally {
    genSubmitting.value = false
  }
}

// ============ 2. 脚本库 ============
const scriptLoading = ref(false)
const scripts = ref<Script[]>([])
const scriptTotal = ref(0)
const scriptPage = ref(1)
const scriptPageSize = ref(20)
const scriptFilters = reactive<{ topicId: number | undefined; status: string | undefined }>({
  topicId: undefined,
  status: undefined,
})

async function loadScripts() {
  scriptLoading.value = true
  try {
    const params: { page: number; pageSize: number; topicId?: number; status?: string } = {
      page: scriptPage.value,
      pageSize: scriptPageSize.value,
    }
    if (scriptFilters.topicId) params.topicId = scriptFilters.topicId
    if (scriptFilters.status) params.status = scriptFilters.status
    const res = await listScripts(params)
    scripts.value = res.list
    scriptTotal.value = res.total
  } catch {
    // 拦截器已提示
  } finally {
    scriptLoading.value = false
  }
}
function handleScriptFilter() {
  scriptPage.value = 1
  loadScripts()
}
function handleScriptPageChange(page: number) {
  scriptPage.value = page
  loadScripts()
}
function handleScriptSizeChange(size: number) {
  scriptPageSize.value = size
  scriptPage.value = 1
  loadScripts()
}

// 合规级别标签渲染
function levelTag(risk?: ComplianceRisk): { label: string; color: string } {
  const lv = risk?.level || 'none'
  return { label: complianceLevelMeta[lv].label, color: complianceLevelMeta[lv].color }
}

// 编辑抽屉
const editDrawer = ref(false)
const editingScript = ref<Script | null>(null)
function openEdit(s: Script) {
  editingScript.value = s
  editDrawer.value = true
}
function afterEdit() {
  loadScripts()
}

// 合规预检（行内）
const checkSubmitting = reactive<Record<number, boolean>>({})
const checkResult = reactive<Record<number, ComplianceRisk>>({})
async function handleRowCheck(s: Script) {
  checkSubmitting[s.id] = true
  try {
    const risk = await checkCompliance(s.id)
    checkResult[s.id] = risk
    ElMessage.success('预检完成')
  } catch {
    // 拦截器已提示
  } finally {
    checkSubmitting[s.id] = false
  }
}

// 版本 save
const saveSubmitting = reactive<Record<number, boolean>>({})
async function handleVersionSave(s: Script) {
  saveSubmitting[s.id] = true
  try {
    await versionScript(s.id, { action: 'save' })
    ElMessage.success('已存为新版本')
    loadScripts()
  } catch {
    // 拦截器已提示
  } finally {
    saveSubmitting[s.id] = false
  }
}

// 版本回滚
const rollbackSubmitting = reactive<Record<number, boolean>>({})
const rollbackTarget = reactive<Record<number, number | undefined>>({})
async function handleVersionRollback(s: Script) {
  if (!rollbackTarget[s.id]) {
    ElMessage.warning('请填写回滚目标版本 id')
    return
  }
  try {
    await ElMessageBox.confirm(
      `确认回滚到版本 ${rollbackTarget[s.id]}？将覆盖当前脚本内容`,
      '版本回滚',
      { type: 'warning' },
    )
  } catch {
    return
  }
  rollbackSubmitting[s.id] = true
  try {
    await versionScript(s.id, { action: 'rollback', sourceVersionId: rollbackTarget[s.id] })
    ElMessage.success('已回滚')
    rollbackTarget[s.id] = undefined
    loadScripts()
  } catch {
    // 拦截器已提示
  } finally {
    rollbackSubmitting[s.id] = false
  }
}

// 行内状态推进（按状态机主方向）
const statusNext: Partial<Record<Script['status'], Script['status']>> = {
  draft: 'reviewing',
  reviewing: 'approved',
  approved: 'published',
}
const advanceSubmitting = reactive<Record<number, boolean>>({})
async function handleAdvance(s: Script) {
  const next = statusNext[s.status]
  if (!next) return
  advanceSubmitting[s.id] = true
  try {
    await updateScript(s.id, { status: next })
    ElMessage.success(`已推进至「${scriptStatusMeta[next].label}」`)
    loadScripts()
  } catch {
    // 拦截器已提示
  } finally {
    advanceSubmitting[s.id] = false
  }
}
function canAdvance(s: Script): boolean {
  return !!statusNext[s.status]
}

// ============ 3. 合规预检台 ============
const deskScriptId = ref<number | undefined>(undefined)
const deskText = ref('')
const deskResult = ref<ComplianceRisk | null>(null)
const deskChecking = ref(false)
async function handleDeskCheck() {
  if (!deskScriptId.value) {
    ElMessage.warning('请选择/输入脚本 id')
    return
  }
  deskChecking.value = true
  try {
    deskResult.value = await checkCompliance(deskScriptId.value, {
      content: deskText.value || undefined,
    })
  } catch {
    // 拦截器已提示
  } finally {
    deskChecking.value = false
  }
}

// ============ 4. 模板库 ============
const templates = ref<ScriptTemplate[]>([])
function loadTemplateLib() {
  listTemplates()
    .then((r) => {
      templates.value = r.templates
    })
    .catch(() => {
      // 拦截器已提示
    })
}

onMounted(() => {
  loadTopicCandidates()
  loadTemplates()
  loadScripts()
  loadTemplateLib()
})
</script>

<template>
  <div class="page-container" aria-label="F 脚本工坊">
    <!-- 页面标题区 -->
    <div class="page-header">
      <div>
        <h1 class="page-title">F·脚本工坊</h1>
        <p class="page-subtitle">消费选题智能生成脚本，合规预检与版本管理，驱动发布与分发</p>
      </div>
    </div>

    <el-tabs type="border-card" aria-label="脚本功能分区">
      <!-- ===== 1. 生成脚本 ===== -->
      <el-tab-pane label="生成脚本">
        <template #label><span aria-label="生成脚本标签页">生成脚本</span></template>
        <div class="card filter-card">
          <el-form :model="genForm" inline @submit.prevent>
            <el-form-item label="归属选题">
              <el-select v-model="genForm.topicId" placeholder="选择选题" filterable style="width:260px" aria-label="归属选题">
                <el-option v-for="t in topicCandidates" :key="t.id" :label="`#${t.id} ${t.title}`" :value="t.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="模板">
              <el-select v-model="genForm.templateId" placeholder="默认（无模板）" clearable style="width:200px" aria-label="生成模板">
                <el-option v-for="t in genTemplates" :key="t.id" :label="t.name" :value="t.id" />
              </el-select>
            </el-form-item>
          </el-form>
          <div class="filter-actions">
            <el-button type="primary" :loading="genSubmitting" @click="handleGenerate">生成脚本</el-button>
          </div>
          <div v-if="genTemplates.length" class="tmpl-preview">
            <div v-for="t in genTemplates" :key="t.id" class="tmpl-mini">
              <strong>{{ t.name }}</strong>
              <span class="tmpl-struct">{{ t.structure }}</span>
            </div>
          </div>
        </div>

        <el-alert v-if="genTrace" type="success" :closable="false" show-icon class="compliance-alert" :title="`本次生成 traceId：${genTrace}`" />

        <div class="section-header"><h3 class="section-title">生成结果</h3></div>
        <el-empty v-if="!genResult" description="选择选题与模板，点击生成消费 E 选题产出脚本" />
        <div v-else class="card result-card">
          <div class="res-title">{{ genResult.title }}</div>
          <div class="res-meta">
            <span class="mini-tag" :style="{ background: emotionColors[genResult.hookEmotion as keyof typeof emotionColors] || 'var(--el-text-color-secondary)', color: 'var(--el-bg-color)' }">
              {{ emotionLabels[genResult.hookEmotion as keyof typeof emotionLabels] || genResult.hookEmotion || '情绪未知' }}
            </span>
            <el-tag :type="scriptStatusMeta[genResult.status].type" size="small">v{{ genResult.version }} · {{ scriptStatusMeta[genResult.status].label }}</el-tag>
            <span class="mini-tag" :style="{ background: levelTag(genResult.complianceRisk).color, color: 'var(--el-bg-color)' }">合规 {{ levelTag(genResult.complianceRisk).label }}</span>
            <span class="res-model">{{ genResult.modelUsed }} / {{ genResult.promptVersion }}</span>
          </div>
          <div class="res-block">
            <div class="res-label">钩子</div>
            <div>{{ genResult.hook }}</div>
          </div>
          <div class="res-block">
            <div class="res-label">正文</div>
            <pre class="res-content">{{ genResult.content }}</pre>
          </div>
        </div>
      </el-tab-pane>

      <!-- ===== 2. 脚本库 ===== -->
      <el-tab-pane label="脚本库">
        <template #label><span aria-label="脚本库标签页">脚本库</span></template>
        <div class="card filter-card">
          <el-form :model="scriptFilters" inline @submit.prevent>
            <el-form-item label="选题">
              <el-select v-model="scriptFilters.topicId" placeholder="全部" filterable clearable style="width:220px" aria-label="选题筛选" @change="handleScriptFilter">
                <el-option v-for="t in topicCandidates" :key="t.id" :label="`#${t.id} ${t.title}`" :value="t.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="状态">
              <el-select v-model="scriptFilters.status" placeholder="全部" clearable style="width:130px" aria-label="状态筛选" @change="handleScriptFilter">
                <el-option v-for="opt in scriptStatusOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
              </el-select>
            </el-form-item>
          </el-form>
          <div class="filter-actions">
            <el-button type="primary" @click="handleScriptFilter">查询</el-button>
            <el-button @click="loadScripts">刷新</el-button>
          </div>
        </div>
        <el-table v-loading="scriptLoading" :data="scripts" stripe aria-label="脚本库列表" row-key="id">
          <template #empty>
            <el-empty description="暂无脚本" />
          </template>
          <el-table-column prop="title" label="标题" min-width="180" show-overflow-tooltip />
          <el-table-column label="正文摘要" min-width="200" show-overflow-tooltip>
            <template #default="{ row }">{{ (row as Script).content }}</template>
          </el-table-column>
          <el-table-column label="钩子情绪" width="90">
            <template #default="{ row }">
              <span class="mini-tag" :style="{ background: emotionColors[(row as Script).hookEmotion as keyof typeof emotionColors] || 'var(--el-text-color-secondary)', color: 'var(--el-bg-color)' }">{{ emotionLabels[(row as Script).hookEmotion as keyof typeof emotionLabels] || (row as Script).hookEmotion || '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="scriptStatusMeta[(row as Script).status].type" size="small">{{ scriptStatusMeta[(row as Script).status].label }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="version" label="版本" width="70" align="center" />
          <el-table-column label="合规" width="90">
            <template #default="{ row }">
              <span class="mini-tag" :style="{ background: levelTag((row as Script).complianceRisk).color, color: '#fff' }">{{ levelTag((row as Script).complianceRisk).label }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" min-width="320" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="openEdit(row as Script)">编辑</el-button>
              <el-button link type="warning" size="small" :loading="checkSubmitting[(row as Script).id]" @click="handleRowCheck(row as Script)">合规预检</el-button>
              <el-button link type="success" size="small" :loading="saveSubmitting[(row as Script).id]" @click="handleVersionSave(row as Script)">版本save</el-button>
              <el-popover placement="top" :width="260" trigger="click">
                <template #reference>
                  <el-button link type="info" size="small">版本回滚</el-button>
                </template>
                <div class="rollback-box">
                  <el-input v-model.number="rollbackTarget[(row as Script).id]" type="number" placeholder="目标版本 id" style="width:100%" aria-label="回滚目标版本id" />
                  <el-button type="primary" size="small" style="margin-top:8px" :loading="rollbackSubmitting[(row as Script).id]" @click="handleVersionRollback(row as Script)">确认回滚</el-button>
                </div>
              </el-popover>
              <el-button v-if="canAdvance(row as Script)" link type="primary" size="small" :loading="advanceSubmitting[(row as Script).id]" @click="handleAdvance(row as Script)">推进→{{ scriptStatusMeta[statusNext[(row as Script).status] as Script['status']].label }}</el-button>
            </template>
          </el-table-column>
          <el-table-column label="行内预检结果" min-width="220">
            <template #default="{ row }">
              <div v-if="checkResult[(row as Script).id]" class="row-check">
                <el-tag :type="complianceLevelMeta[checkResult[(row as Script).id].level].type" size="small">整体 {{ complianceLevelMeta[checkResult[(row as Script).id].level].label }}</el-tag>
                <span v-if="checkResult[row.id].hits.length" class="hit-words">{{ checkResult[row.id].hits.map((h: any) => h.word).join('、') }}</span>
                <span v-else class="no-hit">无命中</span>
              </div>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!scriptLoading && scripts.length === 0" description="暂无数据" />
        <div class="table-pagination" v-if="scriptTotal > 0">
          <el-pagination
            v-model:current-page="scriptPage"
            v-model:page-size="scriptPageSize"
            :total="scriptTotal"
            :page-sizes="[20, 50, 100]"
            layout="total, sizes, prev, pager, next"
            background
            aria-label="脚本分页"
            @current-change="handleScriptPageChange"
            @size-change="handleScriptSizeChange"
          />
        </div>
      </el-tab-pane>

      <!-- ===== 3. 合规预检台 ===== -->
      <el-tab-pane label="合规预检台">
        <template #label><span aria-label="合规预检台标签页">合规预检台</span></template>
        <div class="card">
          <el-form label-width="90px" @submit.prevent>
            <el-form-item label="脚本ID">
              <el-input v-model.number="deskScriptId" type="number" placeholder="目标脚本 id" style="width:220px" aria-label="预检脚本id" clearable />
            </el-form-item>
            <el-form-item label="自定义文本">
              <el-input v-model="deskText" type="textarea" :rows="5" placeholder="可选，留空则对脚本当前内容预检" aria-label="预检自定义文本" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="deskChecking" @click="handleDeskCheck">执行预检</el-button>
            </el-form-item>
          </el-form>

          <el-alert v-if="deskResult && isHighRisk(deskResult.level)" type="error" :closable="false" show-icon class="compliance-alert" title="命中高危违禁词，禁止发布" />

          <div v-if="deskResult" class="desk-result" v-loading="deskChecking">
            <div class="desk-level" :style="{ background: complianceLevelMeta[deskResult.level].color }">整体合规级别：{{ complianceLevelMeta[deskResult.level].label }}</div>
            <div class="desk-checked">预检时间：{{ formatDateTime(deskResult.checkedAt) }}</div>
            <div class="section-header"><h3 class="section-title">命中明细（{{ deskResult.hits.length }}）</h3></div>
            <el-empty v-if="!deskResult.hits.length" description="未命中违禁词" :image-size="60" />
            <div v-else class="hit-list">
              <div v-for="(h, i) in deskResult.hits" :key="i" class="hit-row">
                <span class="hit-word">{{ (h as any).word }}</span>
                <el-tag :type="(complianceLevelMeta as any)[(h as any).level].type" size="small">{{ (complianceLevelMeta as any)[(h as any).level].label }}</el-tag>
                <span class="hit-pos">位置 {{ (h as any).position }}</span>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- ===== 4. 模板库 ===== -->
      <el-tab-pane label="模板库">
        <template #label><span aria-label="模板库标签页">模板库</span></template>
        <el-alert type="info" :closable="false" show-icon class="compliance-alert" title="合规说明：仅存脚本内容/口播/字幕/合规命中，无单条个人信息落库。" />
        <el-empty v-if="!templates.length" description="暂无模板" />
        <div v-else class="tmpl-cards">
          <div v-for="t in templates" :key="t.id" class="card tmpl-card">
            <div class="tmpl-name">{{ t.name }}</div>
            <div class="tmpl-id">id: {{ t.id }}</div>
            <div class="tmpl-structure">{{ t.structure }}</div>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 编辑抽屉 -->
    <ScriptFormDrawer v-model="editDrawer" :script="editingScript" @saved="afterEdit" />
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

/* 生成结果 */
.result-card { margin-top: var(--space-sm); }
.res-title { font-weight: 600; color: var(--el-text-color-primary); margin-bottom: var(--space-sm); }
.res-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.res-model { font-size: var(--text-sm); color: var(--el-text-color-secondary); }
.res-block { margin-bottom: 10px; }
.res-label { font-size: var(--text-base-sm); color: var(--el-text-color-secondary); margin-bottom: 4px; }
.res-content {
  white-space: pre-wrap; word-break: break-word;
  background: var(--el-fill-color-light); border-radius: var(--radius-md);
  padding: 10px; font-family: inherit; font-size: var(--text-base-sm);
  color: var(--el-text-color-regular);
}

/* 迷你标签 */
.mini-tag { display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: var(--text-sm); line-height: 18px; color: var(--el-bg-color); margin-right: 4px; }

/* 模板 */
.tmpl-preview { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
.tmpl-mini { display: flex; gap: var(--space-sm); align-items: baseline; font-size: var(--text-sm); color: var(--el-text-color-regular); }
.tmpl-struct { color: var(--el-text-color-secondary); }
.tmpl-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--space-md); }
.tmpl-card { height: 100%; }
.tmpl-name { font-weight: 600; color: var(--el-text-color-primary); }
.tmpl-id { font-size: var(--text-sm); color: var(--el-text-color-placeholder); margin: 2px 0 var(--space-sm); }
.tmpl-structure { font-size: var(--text-base-sm); color: var(--el-text-color-regular); line-height: 1.6; }

/* 合规预检 */
.row-check { display: flex; flex-direction: column; gap: 4px; }
.hit-words { font-size: var(--text-sm); color: var(--app-danger-500); }
.no-hit { font-size: var(--text-sm); color: var(--app-success-500); }
.desk-level { display: inline-block; padding: 4px 14px; border-radius: var(--radius-md); color: var(--el-bg-color); font-weight: 600; }
.desk-checked { font-size: var(--text-sm); color: var(--el-text-color-secondary); margin: var(--space-sm) 0; }
.hit-list { display: flex; flex-direction: column; gap: 6px; }
.hit-row { display: flex; align-items: center; gap: 10px; padding: 6px 10px; background: var(--el-fill-color-light); border-radius: var(--radius-md); }
.hit-word { font-weight: 600; color: var(--el-text-color-primary); }
.hit-pos { font-size: var(--text-sm); color: var(--el-text-color-secondary); }
.rollback-box { display: flex; flex-direction: column; }

/* 分页 */
.table-pagination { display: flex; justify-content: flex-end; padding-top: var(--space-md); }
</style>
