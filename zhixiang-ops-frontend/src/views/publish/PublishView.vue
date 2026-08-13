<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  publish,
  batchPublish,
  getPublish,
  getFunnel,
  type PublishTask,
  type PublishStatus,
  type PublishPayload,
  type BatchPublishItem,
  type FunnelResult,
  type PublishPlatform,
} from '@/api/publish'
import { listAccounts, type AccountView } from '@/api/accounts'
import { listScripts, type Script } from '@/api/script'
import { formatDateTime } from '@/utils/format'
import { publishStatusMeta, platformOptions, platformLabel } from './publishMaps'

// 账号名映射
const accountMap = ref<Record<number, string>>({})
// 脚本下拉
const scriptOptions = ref<{ value: number; label: string }[]>([])

async function loadAccounts() {
  try {
    const res = await listAccounts({ pageSize: 200 })
    const list: AccountView[] = Array.isArray(res) ? res : res?.list || []
    const map: Record<number, string> = {}
    for (const a of list) {
      const name = a.nickname || a.platformAccountId || `#${a.id}`
      map[a.id] = `${name}（${a.platform}）`
    }
    accountMap.value = map
  } catch {
    // 拦截器已提示
  }
}

async function loadScripts() {
  try {
    const res = await listScripts({ status: 'approved', pageSize: 200 })
    const list: Script[] = Array.isArray(res) ? res : res?.list || []
    scriptOptions.value = list.map((s) => ({ value: s.id, label: `${s.title} #${s.id}` }))
  } catch {
    // 拦截器已提示
  }
}

function accountName(id?: number): string {
  if (id == null) return '-'
  return accountMap.value[id] || `#${id}`
}

// ============ 1. 发起发布 ============
const singleForm = reactive<{
  scriptId: number | undefined
  accountIds: number[]
  platform: PublishPlatform | undefined
  scheduledAt: string
  cartProductId: string
}>({
  scriptId: undefined,
  accountIds: [],
  platform: undefined,
  scheduledAt: '',
  cartProductId: '',
})
const singleSubmitting = ref(false)

async function handleSingle() {
  if (singleForm.scriptId == null) {
    ElMessage.warning('请选择脚本（必填，须 approved/published）')
    return
  }
  if (!singleForm.accountIds.length) {
    ElMessage.warning('请至少选择一个发布账号')
    return
  }
  const payload: PublishPayload = {
    scriptId: singleForm.scriptId,
    accountIds: singleForm.accountIds,
    platform: singleForm.platform,
    scheduledAt: singleForm.scheduledAt || undefined,
    cartProductId: singleForm.cartProductId.trim() || undefined,
  }
  singleSubmitting.value = true
  try {
    const res = await publish(payload)
    pushTaskIds(res.taskIds)
    ElMessage.success(`已创建 ${res.taskIds.length} 条发布任务（traceId=${res.traceId}）`)
  } catch {
    // 拦截器已提示（含 high 合规拦截、脚本状态校验）
  } finally {
    singleSubmitting.value = false
  }
}

// ============ 2. 批量分发 ============
const batchRows = ref<BatchPublishItem[]>([
  { scriptId: undefined as unknown as number, accountIds: [], platform: undefined },
])
const batchSubmitting = ref(false)

function addBatchRow() {
  batchRows.value.push({ scriptId: undefined as unknown as number, accountIds: [], platform: undefined })
}
function removeBatchRow(idx: number) {
  if (batchRows.value.length <= 1) return
  batchRows.value.splice(idx, 1)
}

async function handleBatch() {
  const tasks = batchRows.value
    .filter((r) => r.scriptId != null && r.accountIds.length)
    .map((r) => ({
      scriptId: r.scriptId,
      accountIds: r.accountIds,
      platform: r.platform,
    }))
  if (!tasks.length) {
    ElMessage.warning('请至少配置一条有效的 脚本+账号 分发任务')
    return
  }
  batchSubmitting.value = true
  try {
    const res = await batchPublish({ tasks })
    pushTaskIds(res.taskIds)
    ElMessage.success(`批量分发已创建 ${res.taskIds.length} 条任务（traceId=${res.traceId}）`)
  } catch {
    // 拦截器已提示
  } finally {
    batchSubmitting.value = false
  }
}

// ============ 3. 我的发布任务（前端维护，后端无 list 接口）============
const taskIds = ref<number[]>([])
const tasks = ref<PublishTask[]>([])
const taskLoadingIds = ref<Set<number>>(new Set())
const funnelMap = ref<Record<number, FunnelResult>>({})
const funnelLoadingIds = ref<Set<number>>(new Set())
const expandedIds = ref<Set<number>>(new Set())

function pushTaskIds(ids: number[]) {
  for (const id of ids) {
    if (!taskIds.value.includes(id)) taskIds.value.push(id)
  }
  refreshTasks()
}

async function refreshTasks() {
  if (!taskIds.value.length) {
    tasks.value = []
    return
  }
  const loadSet = new Set(taskIds.value)
  taskLoadingIds.value = loadSet
  const results = await Promise.all(
    taskIds.value.map((id) =>
      getPublish(id)
        .then((t) => t)
        .catch(() => null),
    ),
  )
  tasks.value = results.filter(Boolean) as PublishTask[]
  taskLoadingIds.value = new Set()
}

async function toggleFunnel(id: number) {
  if (expandedIds.value.has(id)) {
    expandedIds.value.delete(id)
    expandedIds.value = new Set(expandedIds.value)
    return
  }
  expandedIds.value.add(id)
  expandedIds.value = new Set(expandedIds.value)
  if (!funnelMap.value[id]) {
    funnelLoadingIds.value.add(id)
    funnelLoadingIds.value = new Set(funnelLoadingIds.value)
    try {
      const f = await getFunnel(id)
      funnelMap.value[id] = f
    } catch {
      // 拦截器已提示
    } finally {
      funnelLoadingIds.value.delete(id)
      funnelLoadingIds.value = new Set(funnelLoadingIds.value)
    }
  }
}

onMounted(async () => {
  await Promise.all([loadAccounts(), loadScripts()])
})
</script>

<template>
  <div class="page-container" aria-label="I 发布与分发">
    <!-- 页面标题区 -->
    <div class="page-header">
      <div class="page-header-text">
        <h1 class="page-title">I·发布管理</h1>
        <p class="page-subtitle">脚本一键分发至多平台账号，支持批量分发与挂车转化漏斗追踪</p>
      </div>
    </div>

    <!-- 合规提示 -->
    <el-alert
      type="info"
      :closable="false"
      show-icon
      class="compliance-alert"
      title="attributionId 由 F 脚本透传，发布前复用脚本合规预检；挂车商品 id 经商品适配层。"
    />

    <!-- 功能分区 -->
    <el-tabs type="border-card" aria-label="发布功能分区">
      <!-- ===== 1. 发起发布 ===== -->
      <el-tab-pane label="发起发布">
        <template #label><span aria-label="发起发布标签页">发起发布</span></template>
        <div class="card">
          <el-form label-width="130px" @submit.prevent>
            <el-form-item label="脚本" required>
              <el-select
                v-model="singleForm.scriptId"
                placeholder="选择可发布脚本（approved/published）"
                filterable
                clearable
                style="width: 360px"
                size="default"
                aria-label="发布脚本"
              >
                <el-option
                  v-for="opt in scriptOptions"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="发布账号" required>
              <el-select
                v-model="singleForm.accountIds"
                placeholder="多选发布账号"
                multiple
                collapse-tags
                filterable
                style="width: 480px"
                size="default"
                aria-label="发布账号多选"
              >
                <el-option
                  v-for="(name, id) in accountMap"
                  :key="id"
                  :label="name"
                  :value="Number(id)"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="平台 platform">
              <el-select
                v-model="singleForm.platform"
                placeholder="可选，默认按账号平台"
                clearable
                style="width: 220px"
                size="default"
                aria-label="发布平台"
              >
                <el-option v-for="opt in platformOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="定时 scheduledAt">
              <el-date-picker
                v-model="singleForm.scheduledAt"
                type="datetime"
                placeholder="可选，定时发布"
                value-format="YYYY-MM-DD HH:mm:ss"
                style="width: 240px"
                aria-label="定时发布时间"
              />
            </el-form-item>
            <el-form-item label="挂车商品 id">
              <el-input
                v-model="singleForm.cartProductId"
                placeholder="可选，挂车商品编号（经商品适配层）"
                style="width: 320px"
                size="default"
                aria-label="挂车商品id"
                clearable
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="singleSubmitting" @click="handleSingle">一键分发</el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-tab-pane>

      <!-- ===== 2. 批量分发 ===== -->
      <el-tab-pane label="批量分发">
        <template #label><span aria-label="批量分发标签页">批量分发</span></template>
        <div class="card">
          <div class="section-actions">
            <el-button @click="addBatchRow">+ 新增一行</el-button>
          </div>
          <el-table :data="batchRows" stripe aria-label="批量分发任务行">
            <el-table-column type="index" label="#" width="50" />
            <el-table-column label="脚本" min-width="260">
              <template #default="{ row }">
                <el-select
                  v-model="row.scriptId"
                  placeholder="选择脚本"
                  filterable
                  clearable
                  style="width: 100%"
                  size="default"
                  aria-label="批量脚本"
                >
                  <el-option
                    v-for="opt in scriptOptions"
                    :key="opt.value"
                    :label="opt.label"
                    :value="opt.value"
                  />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="发布账号" min-width="320">
              <template #default="{ row }">
                <el-select
                  v-model="row.accountIds"
                  placeholder="多选账号"
                  multiple
                  collapse-tags
                  filterable
                  style="width: 100%"
                  size="default"
                  aria-label="批量账号多选"
                >
                  <el-option
                    v-for="(name, id) in accountMap"
                    :key="id"
                    :label="name"
                    :value="Number(id)"
                  />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="平台" min-width="160">
              <template #default="{ row }">
                <el-select
                  v-model="row.platform"
                  placeholder="可选"
                  clearable
                  style="width: 100%"
                  size="default"
                  aria-label="批量平台"
                >
                  <el-option v-for="opt in platformOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="90" fixed="right">
              <template #default="{ $index }">
                <el-button
                  type="danger"
                  link
                  :disabled="batchRows.length <= 1"
                  @click="removeBatchRow($index)"
                  aria-label="删除该行"
                >删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div class="table-footer-actions">
            <el-button type="primary" :loading="batchSubmitting" @click="handleBatch">批量分发</el-button>
          </div>
        </div>
      </el-tab-pane>

      <!-- ===== 3. 我的发布任务 ===== -->
      <el-tab-pane label="我的发布任务">
        <template #label><span aria-label="我的发布任务标签页">我的发布任务</span></template>
        <div class="section-actions">
          <el-button @click="refreshTasks" :loading="taskLoadingIds.size > 0">刷新</el-button>
        </div>
        <el-empty
          v-if="!taskIds.length"
          description="先发起发布任务"
        />
        <div v-else class="card">
          <el-table :data="tasks" stripe v-loading="taskLoadingIds.size > 0" aria-label="发布任务列表">
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="scriptId" label="脚本" width="90" />
            <el-table-column label="账号" min-width="180">
              <template #default="{ row }">{{ accountName(row.accountId) }}</template>
            </el-table-column>
            <el-table-column label="平台" width="110">
              <template #default="{ row }">{{ platformLabel[(row.platform as PublishPlatform)] || row.platform }}</template>
            </el-table-column>
            <el-table-column label="状态" width="110">
              <template #default="{ row }">
                <el-tag :type="publishStatusMeta[(row.status as PublishStatus)]?.type || 'info'" size="small">
                  {{ publishStatusMeta[(row.status as PublishStatus)]?.label || row.status }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="attributionId" label="attributionId" min-width="180" show-overflow-tooltip />
            <el-table-column label="发布时间" min-width="170">
              <template #default="{ row }">{{ formatDateTime(row.publishedAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="90" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="toggleFunnel(row.id)" :aria-label="`查看 ${row.id} 漏斗`">
                  {{ expandedIds.has(row.id) ? '收起' : '漏斗' }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column type="expand" label="详情" width="60">
              <template #default="{ row }">
                <div class="expand-body">
                  <div v-if="row.errorMsg" class="expand-error">错误：{{ row.errorMsg }}</div>
                  <div class="expand-line">任务 ID：{{ row.id }} ｜ 重试次数：{{ row.retryCount }}</div>
                  <div v-if="row.videoId" class="expand-line">成片 ID：{{ row.videoId }}</div>
                  <div v-if="row.extPostId" class="expand-line">平台帖子 ID：{{ row.extPostId }}</div>
                  <div v-if="row.cartProductId" class="expand-line">挂车商品 ID：{{ row.cartProductId }}</div>
                  <div class="expand-line">创建：{{ formatDateTime(row.createdAt) }} ｜ 更新：{{ formatDateTime(row.updatedAt) }}</div>

                  <div v-if="expandedIds.has(row.id)" class="funnel-box">
                    <el-divider content-position="left">挂车转化漏斗</el-divider>
                    <div v-loading="funnelLoadingIds.has(row.id)">
                      <template v-if="funnelMap[row.id]">
                        <el-descriptions :column="3" border size="small">
                          <el-descriptions-item label="购物车点击">
                            {{ funnelMap[row.id].cartClicks }}
                          </el-descriptions-item>
                          <el-descriptions-item label="下单转化">
                            {{ funnelMap[row.id].orderConv }}
                          </el-descriptions-item>
                          <el-descriptions-item label="转化率">
                            {{ funnelMap[row.id].conversionRate }}
                          </el-descriptions-item>
                        </el-descriptions>
                        <div class="funnel-hint">转化数据待 Y 订单回写（阶段1 cartClicks/orderConv=0）</div>
                      </template>
                      <el-empty v-else description="加载漏斗中" :image-size="40" />
                    </div>
                  </div>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </div>
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
.table-footer-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--space-3);
}
.expand-body {
  padding: var(--space-2) var(--space-3);
}
.expand-line {
  font-size: var(--text-base-sm);
  color: var(--app-neutral-500);
  margin-bottom: 6px;
}
.expand-error {
  font-size: var(--text-base-sm);
  color: var(--app-danger-600);
  margin-bottom: var(--space-2);
  font-weight: 600;
}
.funnel-box {
  margin-top: var(--space-2);
}
.funnel-hint {
  font-size: var(--text-sm);
  color: var(--app-neutral-400);
  margin-top: 6px;
}
</style>
