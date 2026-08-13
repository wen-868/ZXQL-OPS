<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  listWorkflows,
  runWorkflow,
  type WorkflowDef,
  type WorkflowRunStatus,
  type WorkflowNodeLog,
  type WorkflowStreamEvent,
} from '@/api/workflow'
import { formatDateTime } from '@/utils/format'
import {
  nodeTypeMeta,
  triggerMeta,
  runStatusMeta,
  nodeLogStatusMeta,
  nodeTypeStageLabel,
} from './workflowMaps'
import WorkflowFormDrawer from './WorkflowFormDrawer.vue'

// ============ 1. 编排列表 ============
const list = ref<WorkflowDef[]>([])
const total = ref(0)
const listLoading = ref(false)
const page = ref(1)
const pageSize = ref(20)

// 把节点按 edges 或顺序拼成简链文本（如 C采集→D分析→E选题→F脚本→I发布）
function chainText(def: WorkflowDef): string {
  const stage = (t: string) => nodeTypeStageLabel[t as keyof typeof nodeTypeStageLabel] || t
  const order = def.nodes.map((n) => n.type)
  return order.map(stage).join(' → ')
}

async function loadList() {
  listLoading.value = true
  try {
    const res = await listWorkflows({ page: page.value, pageSize: pageSize.value })
    list.value = res.list || []
    total.value = res.total || 0
  } catch {
    // 拦截器已提示
  } finally {
    listLoading.value = false
  }
}

function onPageChange(p: number) {
  page.value = p
  loadList()
}

// ============ 2. 新建/编辑编排 ============
const drawerVisible = ref(false)
const editingDef = ref<WorkflowDef | null>(null)

function openCreate() {
  editingDef.value = null
  drawerVisible.value = true
}

function openEdit(def: WorkflowDef) {
  editingDef.value = def
  drawerVisible.value = true
}

function onSaved() {
  loadList()
}

// ============ 3. 运行监控（SSE via fetch + ReadableStream）============
const defOptions = ref<{ value: number; label: string }[]>([])
const monitorDefId = ref<number | undefined>(undefined)
const currentRunId = ref<number | undefined>(undefined)
const streamStatus = ref<WorkflowRunStatus | null>(null)
const streamProgress = ref(0)
const nodeLogs = ref<WorkflowNodeLog[]>([])
const streaming = ref(false)
const monitorHint = ref('')
let reader: ReadableStreamDefaultReader<Uint8Array> | null = null

async function startRun(defId?: number) {
  const id = defId ?? monitorDefId.value
  if (id == null) {
    ElMessage.warning('请先选择要运行的编排')
    return
  }
  monitorDefId.value = id
  streaming.value = true
  streamStatus.value = 'queued'
  streamProgress.value = 0
  nodeLogs.value = []
  monitorHint.value = '正在发起运行…'
  try {
    const res = await runWorkflow(id)
    currentRunId.value = res.runId
    monitorHint.value = `已创建运行实例 runId=${res.runId}（traceId=${res.traceId}）`
    await connectStream(res.runId)
  } catch {
    // 拦截器已提示
    streaming.value = false
  }
}

async function connectStream(runId: number) {
  const tenantId = localStorage.getItem('tenantId') || 't_dev'
  const url = `/api/ops/workflow-runs/${runId}/stream`
  const resp = await fetch(url, { headers: { tenantId } })
  if (!resp.ok || !resp.body) {
    ElMessage.error(`SSE 连接失败（HTTP ${resp.status}）`)
    streaming.value = false
    return
  }
  reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const TERMINAL: WorkflowRunStatus[] = ['success', 'failed', 'partial']
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      // 保留最后一段（可能不完整）到 buffer
      buffer = lines.pop() ?? ''
      for (const raw of lines) {
        const line = raw.trim()
        if (!line.startsWith('data:')) continue
        const jsonStr = line.slice(line.indexOf('data:') + 5).trim()
        if (!jsonStr) continue
        let evt: WorkflowStreamEvent
        try {
          evt = JSON.parse(jsonStr)
        } catch {
          // 容错：解析失败行跳过
          continue
        }
        if (evt.run) {
          streamStatus.value = evt.run.status
          streamProgress.value = evt.run.progress
        }
        if (Array.isArray(evt.logs)) {
          nodeLogs.value = evt.logs
        }
        if (evt.run && TERMINAL.includes(evt.run.status)) {
          monitorHint.value = `运行结束：${runStatusMeta[evt.run.status]?.label || evt.run.status}`
          await reader.cancel()
          streaming.value = false
          return
        }
      }
    }
  } catch {
    monitorHint.value = 'SSE 读取中断'
  } finally {
    streaming.value = false
    reader = null
  }
}

function stopStream() {
  if (reader) {
    reader.cancel().catch(() => {})
    reader = null
  }
  streaming.value = false
}

// 列表「运行」带入 id
function runFromList(def: WorkflowDef) {
  startRun(def.id)
}

onMounted(() => {
  loadList()
})

onBeforeUnmount(() => {
  stopStream()
})
</script>

<template>
  <div class="page-container" aria-label="L 工作流编排">
    <!-- 页面标题区 -->
    <div class="page-header">
      <div>
        <h1 class="page-title">L·工作流编排</h1>
        <p class="page-subtitle">串联 C/D/E/F/I 等模块服务，支持复杂 DAG 编排、运行监控与 SSE 实时日志</p>
      </div>
    </div>

    <el-tabs type="border-card" aria-label="工作流功能分区">
      <!-- ===== 1. 编排列表 ===== -->
      <el-tab-pane label="编排列表">
        <template #label><span aria-label="编排列表标签页">编排列表</span></template>
        <div class="tab-head">
          <el-button type="primary" @click="openCreate" aria-label="新建编排">+ 新建编排</el-button>
          <el-button @click="loadList" :loading="listLoading" aria-label="刷新列表">刷新</el-button>
        </div>
        <el-empty v-if="!listLoading && !list.length" description="暂无编排，点击「新建编排」创建" />
        <el-table
          v-else
          :data="list"
          border
          v-loading="listLoading"
          aria-label="编排列表"
        >
          <el-table-column prop="name" label="名称" min-width="200" show-overflow-tooltip />
          <el-table-column label="触发" width="100">
            <template #default="{ row }">
              <el-tag :type="triggerMeta[(row.trigger as keyof typeof triggerMeta)]?.type || 'info'" size="small">
                {{ triggerMeta[(row.trigger as keyof typeof triggerMeta)]?.label || row.trigger }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="启用" width="80">
            <template #default="{ row }">
              <el-tag :type="row.enabled ? 'success' : 'info'" size="small">
                {{ row.enabled ? '开' : '关' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="链路" min-width="260" show-overflow-tooltip>
            <template #default="{ row }">{{ chainText(row) }}</template>
          </el-table-column>
          <el-table-column label="创建时间" min-width="170">
            <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="160" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="runFromList(row)" :loading="streaming" :aria-label="`运行 ${row.name}`">
                运行
              </el-button>
              <el-button link type="primary" @click="openEdit(row)" :aria-label="`编辑 ${row.name}`">
                编辑
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="pager" v-if="total > pageSize">
          <el-pagination
            layout="prev, pager, next, total"
            :total="total"
            :page-size="pageSize"
            :current-page="page"
            @current-change="onPageChange"
            aria-label="编排列表分页"
          />
        </div>
      </el-tab-pane>

      <!-- ===== 2. 新建编排 ===== -->
      <el-tab-pane label="新建编排">
        <template #label><span aria-label="新建编排标签页">新建编排</span></template>
        <el-empty description="点击右上角「新建编排」打开表单；或直接编辑已有编排。" />
      </el-tab-pane>

      <!-- ===== 3. 运行监控 ===== -->
      <el-tab-pane label="运行监控">
        <template #label><span aria-label="运行监控标签页">运行监控</span></template>
        <el-card shadow="never" class="monitor-card">
          <div class="monitor-bar">
            <el-select
              v-model="monitorDefId"
              placeholder="选择编排运行"
              filterable
              clearable
              style="width: 320px"
              aria-label="选择编排"
            >
              <el-option
                v-for="opt in defOptions.length ? defOptions : list.map((d) => ({ value: d.id, label: d.name }))"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
            <el-button type="primary" :loading="streaming" @click="startRun()" aria-label="运行编排">
              {{ streaming ? '运行中…' : '运行' }}
            </el-button>
            <el-button v-if="streaming" @click="stopStream" aria-label="停止">停止</el-button>
          </div>
          <div v-if="currentRunId != null" class="monitor-body">
            <div class="status-row">
              <span class="status-label">整体状态：</span>
              <el-tag
                :type="(streamStatus && runStatusMeta[streamStatus]?.type) || 'info'"
                size="small"
              >
                {{ (streamStatus && runStatusMeta[streamStatus]?.label) || streamStatus || '-' }}
              </el-tag>
              <span class="progress-text">进度 {{ streamProgress }}%</span>
              <el-progress
                :percentage="streamProgress"
                :status="streamStatus === 'success' ? 'success' : streamStatus === 'failed' ? 'exception' : undefined"
                style="width: 260px"
                aria-label="运行进度"
              />
            </div>
            <div v-if="monitorHint" class="monitor-hint">{{ monitorHint }}</div>
            <el-divider content-position="left">节点进度</el-divider>
            <el-empty v-if="!nodeLogs.length" description="等待节点日志…" :image-size="40" />
            <div v-else class="node-logs">
              <div v-for="log in nodeLogs" :key="log.id" class="node-log-row">
                <el-tag
                  :type="nodeTypeMeta[(log.nodeType as keyof typeof nodeTypeMeta)]?.type || 'info'"
                  size="small"
                >
                  {{ nodeTypeMeta[(log.nodeType as keyof typeof nodeTypeMeta)]?.label || log.nodeType }}
                </el-tag>
                <el-tag
                  :type="(log.status && nodeLogStatusMeta[log.status]?.type) || 'info'"
                  size="small"
                >
                  {{ (log.status && nodeLogStatusMeta[log.status]?.label) || log.status }}
                </el-tag>
                <span class="node-id">#{{ log.nodeId }}</span>
              </div>
            </div>
          </div>
          <el-empty v-else description="选择编排并点击「运行」查看实时进度" />
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <WorkflowFormDrawer v-model="drawerVisible" :editing="editingDef" @saved="onSaved" />
  </div>
</template>

<style scoped>
/* 页面标题区 */
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-lg); }
.page-title { font-size: var(--text-2xl); font-weight: 700; color: var(--el-text-color-primary); margin: 0 0 4px 0; }
.page-subtitle { font-size: var(--text-base); color: var(--el-text-color-secondary); margin: 0; }

/* 标签页通用 */
.tab-head { margin-bottom: var(--space-md); display: flex; gap: var(--space-md); }
.pager { margin-top: var(--space-md); display: flex; justify-content: flex-end; }

/* 运行监控 */
.monitor-card { margin-top: var(--space-sm); }
.monitor-bar { display: flex; gap: var(--space-md); align-items: center; margin-bottom: var(--space-lg); }
.monitor-body { display: flex; flex-direction: column; gap: 10px; }
.status-row { display: flex; align-items: center; gap: var(--space-md); flex-wrap: wrap; }
.status-label { font-size: var(--text-base-sm); color: var(--el-text-color-primary); }
.progress-text { font-size: var(--text-base-sm); color: var(--el-text-color-secondary); }
.monitor-hint { font-size: var(--text-sm); color: var(--el-text-color-placeholder); }
.node-logs { display: flex; flex-direction: column; gap: var(--space-sm); }
.node-log-row { display: flex; align-items: center; gap: 10px; }
.node-id { font-size: var(--text-sm); color: var(--el-text-color-placeholder); }
</style>
