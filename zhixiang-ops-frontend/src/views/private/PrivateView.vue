<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  upsertFans,
  listFans,
  tagFans,
  createGroup,
  pushGroup,
  distribute,
  repurchase,
  type FansProfileView,
  type PrivateGroupView,
  type FansSource,
  type PrivateGroupType,
} from '@/api/private'
import { formatDateTime, formatAmount } from '@/utils/format'
import {
  fansSourceMeta,
  fansSourceOptions,
  fansPlatformOptions,
  privateGroupTypeMeta,
  privateGroupTypeOptions,
} from './privateMaps'

// 注意：后端契约关键差异（与 S 模块不同）：
//   - 粉丝画像【有】GET /ops/fans 列表端点，前端直接调 listFans 拉取并展示（创建/打标后刷新列表）。
//   - 私域群【无】list 端点（仅 createGroup + pushGroup 按 id 操作），因此群列表必须用本地 ref 数组
//     （createGroup 后 push 返回值）维护本会话创建的群。这是后端契约的客观限制。

const activeTab = ref<'fans' | 'groups' | 'repurchase'>('fans')

// ============ 通用：逗号/换行分隔解析 ============
// 解析逗号或换行分隔的公开ID/标签；解析失败返回 null（调用方提示并报错）。
function parseLines(raw: string): string[] | null {
  const arr = raw
    .split(/[\n,，]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  return arr
}

// ============ Tab 1. 粉丝画像 ============
const fans = ref<FansProfileView[]>([])
const fansLoading = ref(false)
const fansPlatformFilter = ref<string>('') // 平台筛选（platform 为任意 string，取主流三平台）

async function loadFans() {
  fansLoading.value = true
  try {
    fans.value = await listFans(
      fansPlatformFilter.value ? String(fansPlatformFilter.value) : undefined,
    )
  } catch {
    // 拦截器已提示
    fans.value = []
  } finally {
    fansLoading.value = false
  }
}

function onChangePlatformFilter() {
  loadFans()
}

const fanDialog = ref(false)
const fanSubmitting = ref(false)
const fanForm = reactive<{
  platform: string
  publicId: string
  level: string
  source: FansSource | ''
  interactAgg: string
  tags: string
}>({
  platform: '',
  publicId: '',
  level: 'normal',
  source: '',
  interactAgg: '',
  tags: '',
})

function openCreateFan() {
  fanForm.platform = ''
  fanForm.publicId = ''
  fanForm.level = 'normal'
  fanForm.source = ''
  fanForm.interactAgg = ''
  fanForm.tags = ''
  fanDialog.value = true
}

async function confirmCreateFan() {
  if (!fanForm.platform.trim()) {
    ElMessage.warning('平台必填')
    return
  }
  if (!fanForm.publicId.trim()) {
    ElMessage.warning('公开ID必填')
    return
  }
  // interactAgg 文本域：填入后需为合法 JSON 对象
  let interactAgg: Record<string, unknown> | undefined
  if (fanForm.interactAgg.trim()) {
    try {
      const parsed = JSON.parse(fanForm.interactAgg.trim())
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('interactAgg 需为 JSON 对象')
      }
      interactAgg = parsed as Record<string, unknown>
    } catch {
      ElMessage.error('聚合分布不是合法 JSON 对象，请检查格式')
      return
    }
  }
  // tags：逗号/换行分隔转 string[]
  const tags = parseLines(fanForm.tags)
  if (tags === null) {
    ElMessage.error('标签解析失败，请检查格式（逗号或换行分隔）')
    return
  }
  fanSubmitting.value = true
  try {
    await upsertFans({
      platform: fanForm.platform.trim(),
      publicId: fanForm.publicId.trim(),
      level: fanForm.level.trim() || 'normal',
      source: fanForm.source ? (fanForm.source as FansSource) : undefined,
      interactAgg,
      tags: tags.length ? tags : undefined,
    })
    ElMessage.success('粉丝画像已创建/更新')
    fanDialog.value = false
    await loadFans() // 刷新真实列表
  } catch {
    // 拦截器已提示
  } finally {
    fanSubmitting.value = false
  }
}

// 打标弹窗
const tagDialog = ref(false)
const tagSubmitting = ref(false)
const tagTarget = ref<FansProfileView | null>(null)
const tagForm = reactive<{ tags: string }>({ tags: '' })

function openTag(row: FansProfileView) {
  tagTarget.value = row
  tagForm.tags = (row.tags || []).join('\n')
  tagDialog.value = true
}

async function confirmTag() {
  if (!tagTarget.value) return
  const tags = parseLines(tagForm.tags)
  if (tags === null) {
    ElMessage.error('标签解析失败，请检查格式（逗号或换行分隔）')
    return
  }
  tagSubmitting.value = true
  try {
    await tagFans({ id: tagTarget.value.id, tags })
    ElMessage.success('打标成功')
    tagDialog.value = false
    await loadFans() // 刷新真实列表
  } catch {
    // 拦截器已提示
  } finally {
    tagSubmitting.value = false
  }
}

// ============ Tab 2. 私域群（无 list 端点，用本地数组维护）============
const groups = ref<PrivateGroupView[]>([])
const groupsLoading = ref(false)

const groupDialog = ref(false)
const groupSubmitting = ref(false)
const groupForm = reactive<{
  name: string
  type: PrivateGroupType
  members: string
}>({
  name: '',
  type: 'wecom',
  members: '',
})

function openCreateGroup() {
  groupForm.name = ''
  groupForm.type = 'wecom'
  groupForm.members = ''
  groupDialog.value = true
}

async function confirmCreateGroup() {
  if (!groupForm.name.trim()) {
    ElMessage.warning('群名必填')
    return
  }
  const members = parseLines(groupForm.members)
  if (members === null) {
    ElMessage.error('成员解析失败，请检查格式（逗号或换行分隔公开ID）')
    return
  }
  groupSubmitting.value = true
  try {
    const g = await createGroup({
      name: groupForm.name.trim(),
      type: groupForm.type,
      members: members.length ? members : undefined,
    })
    groups.value.unshift(g) // 本地数组维护（后端无 list 端点）
    ElMessage.success('私域群已创建')
    groupDialog.value = false
  } catch {
    // 拦截器已提示
  } finally {
    groupSubmitting.value = false
  }
}

async function pushToGroup(row: PrivateGroupView) {
  groupsLoading.value = true
  try {
    const res = await pushGroup(row.id)
    ElMessage.success(`已触达 ${res.pushed} 人`)
  } catch {
    // 拦截器已提示
  } finally {
    groupsLoading.value = false
  }
}

// ============ Tab 3. 复购分销 ============
// 推客分销
const distributeDialog = ref(false)
const distributeSubmitting = ref(false)
const distributeForm = reactive<{
  publicIds: string
  planName: string
  tierCommission: number | undefined
}>({
  publicIds: '',
  planName: '',
  tierCommission: undefined,
})
const distributeResult = ref<{ planName: string; tiers: number; commission: number } | null>(null)

function openDistribute() {
  distributeForm.publicIds = ''
  distributeForm.planName = ''
  distributeForm.tierCommission = undefined
  distributeResult.value = null
  distributeDialog.value = true
}

async function confirmDistribute() {
  const publicIds = parseLines(distributeForm.publicIds)
  if (publicIds === null || !publicIds.length) {
    ElMessage.error('公开ID必填（逗号或换行分隔）')
    return
  }
  if (!distributeForm.planName.trim()) {
    ElMessage.warning('计划名称必填')
    return
  }
  if (distributeForm.tierCommission == null || distributeForm.tierCommission < 0) {
    ElMessage.warning('佣金必填且 ≥ 0')
    return
  }
  distributeSubmitting.value = true
  try {
    const res = await distribute({
      publicIds,
      planName: distributeForm.planName.trim(),
      tierCommission: distributeForm.tierCommission,
    })
    distributeResult.value = res
    ElMessage.success('分销计划已创建')
  } catch {
    // 拦截器已提示
  } finally {
    distributeSubmitting.value = false
  }
}

// 复购 CRM
const repurchaseDialog = ref(false)
const repurchaseSubmitting = ref(false)
const repurchaseForm = reactive<{
  publicId: string
  products: string
  amount: number | undefined
}>({
  publicId: '',
  products: '',
  amount: undefined,
})
const repurchaseResult = ref<{ publicId: string; amount: number } | null>(null)

function openRepurchase() {
  repurchaseForm.publicId = ''
  repurchaseForm.products = ''
  repurchaseForm.amount = undefined
  repurchaseResult.value = null
  repurchaseDialog.value = true
}

async function confirmRepurchase() {
  if (!repurchaseForm.publicId.trim()) {
    ElMessage.warning('公开ID必填')
    return
  }
  const products = parseLines(repurchaseForm.products)
  if (products === null) {
    ElMessage.error('商品解析失败，请检查格式（逗号分隔）')
    return
  }
  repurchaseSubmitting.value = true
  try {
    const res = await repurchase({
      publicId: repurchaseForm.publicId.trim(),
      products: products.length ? products : undefined,
      amount: repurchaseForm.amount ?? undefined,
    })
    repurchaseResult.value = res
    ElMessage.success('复购记录已创建')
  } catch {
    // 拦截器已提示
  } finally {
    repurchaseSubmitting.value = false
  }
}

// ============ 初始化 ============
onMounted(() => {
  loadFans()
})
</script>

<template>
  <div class="page-container">
    <!-- 页面标题区 -->
    <div class="page-header">
      <div class="page-header-left">
        <h1 class="page-title">S · 私域用户</h1>
        <p class="page-subtitle">粉丝画像 / 私域群 / 复购分销，沉淀用户资产并触达转化</p>
      </div>
    </div>

    <el-tabs v-model="activeTab" class="card" aria-label="U 私域功能分区">
      <!-- ===== 1. 粉丝画像 ===== -->
      <el-tab-pane name="fans">
        <template #label><span aria-label="粉丝画像标签页">粉丝画像</span></template>
        <div class="filter-bar" aria-label="粉丝画像操作栏">
          <el-button type="primary" @click="openCreateFan" aria-label="创建或更新粉丝画像">创建/更新粉丝画像</el-button>
          <el-select
            v-model="fansPlatformFilter"
            placeholder="按平台筛选"
            clearable
            style="width: 180px"
            size="default"
            aria-label="粉丝平台筛选"
            @change="onChangePlatformFilter"
          >
            <el-option label="全部平台" value="" />
            <el-option v-for="opt in fansPlatformOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
          <el-button @click="loadFans" aria-label="刷新粉丝画像列表">刷新</el-button>
        </div>
        <el-table :data="fans" stripe v-loading="fansLoading" aria-label="粉丝画像列表" class="data-table">
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="platform" label="平台" min-width="110" show-overflow-tooltip />
          <el-table-column prop="publicId" label="公开ID" min-width="150" show-overflow-tooltip />
          <el-table-column prop="level" label="层级" width="100" />
          <el-table-column label="来源" width="100">
            <template #default="{ row }">
              <el-tag
                size="small"
                :style="{ color: fansSourceMeta[(row as FansProfileView).source].color, borderColor: fansSourceMeta[(row as FansProfileView).source].color }"
              >{{ fansSourceMeta[(row as FansProfileView).source].label }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="聚合分布" min-width="160" show-overflow-tooltip>
            <template #default="{ row }">
              <span v-if="(row as FansProfileView).interactAgg">{{ JSON.stringify((row as FansProfileView).interactAgg) }}</span>
              <span v-else class="text-muted">—</span>
            </template>
          </el-table-column>
          <el-table-column label="标签" min-width="180">
            <template #default="{ row }">
              <template v-if="(row as FansProfileView).tags && (row as FansProfileView).tags!.length">
                <el-tag
                  v-for="t in (row as FansProfileView).tags"
                  :key="t"
                  size="small"
                  type="info"
                  class="tag-item"
                >{{ t }}</el-tag>
              </template>
              <span v-else class="text-muted">—</span>
            </template>
          </el-table-column>
          <el-table-column label="创建时间" min-width="170">
            <template #default="{ row }">{{ formatDateTime((row as FansProfileView).createdAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openTag(row as FansProfileView)" :aria-label="`打标 ${(row as FansProfileView).id}`">打标</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!fansLoading && !fans.length" description="暂无粉丝画像，点击「创建/更新粉丝画像」开始" />
      </el-tab-pane>

      <!-- ===== 2. 私域群 ===== -->
      <el-tab-pane name="groups">
        <template #label><span aria-label="私域群标签页">私域群</span></template>
        <div class="filter-bar" aria-label="私域群操作栏">
          <el-button type="primary" @click="openCreateGroup" aria-label="创建私域群">创建私域群</el-button>
          <span class="filter-tip">说明：后端无群列表端点，本页仅维护本会话创建的私域群</span>
        </div>
        <el-table :data="groups" stripe v-loading="groupsLoading" aria-label="私域群列表" class="data-table">
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="name" label="群名" min-width="150" show-overflow-tooltip />
          <el-table-column label="类型" width="100">
            <template #default="{ row }">
              <el-tag
                size="small"
                :style="{ color: privateGroupTypeMeta[(row as PrivateGroupView).type].color, borderColor: privateGroupTypeMeta[(row as PrivateGroupView).type].color }"
              >{{ privateGroupTypeMeta[(row as PrivateGroupView).type].label }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="成员数" width="100">
            <template #default="{ row }">{{ (row as PrivateGroupView).members.length }}</template>
          </el-table-column>
          <el-table-column label="创建时间" min-width="170">
            <template #default="{ row }">{{ formatDateTime((row as PrivateGroupView).createdAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <el-button link type="success" @click="pushToGroup(row as PrivateGroupView)" :aria-label="`触达 ${(row as PrivateGroupView).id}`">触达</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!groupsLoading && !groups.length" description="暂无私域群，点击「创建私域群」开始" />
      </el-tab-pane>

      <!-- ===== 3. 复购分销 ===== -->
      <el-tab-pane name="repurchase">
        <template #label><span aria-label="复购分销标签页">复购分销</span></template>
        <div class="repurchase-grid">
          <div class="card repurchase-card" aria-label="推客分销卡片">
            <div class="card-head">
              <h3 class="card-head-title">推客分销</h3>
              <el-button type="primary" @click="openDistribute" aria-label="新建推客分销">新建分销</el-button>
            </div>
            <div v-if="distributeResult" class="result-box" v-loading="distributeSubmitting">
              <el-descriptions :column="1" border size="small">
                <el-descriptions-item label="计划名称">{{ distributeResult.planName }}</el-descriptions-item>
                <el-descriptions-item label="分级层数(tiers)">{{ distributeResult.tiers }}</el-descriptions-item>
                <el-descriptions-item label="佣金(commission)">{{ formatAmount(distributeResult.commission) }}</el-descriptions-item>
              </el-descriptions>
            </div>
            <el-empty v-else :image-size="60" description="暂无分销结果，点击「新建分销」创建" />
          </div>

          <div class="card repurchase-card" aria-label="复购CRM卡片">
            <div class="card-head">
              <h3 class="card-head-title">复购 CRM</h3>
              <el-button type="success" @click="openRepurchase" aria-label="新建复购CRM">新建复购</el-button>
            </div>
            <div v-if="repurchaseResult" class="result-box" v-loading="repurchaseSubmitting">
              <el-descriptions :column="1" border size="small">
                <el-descriptions-item label="公开ID">{{ repurchaseResult.publicId }}</el-descriptions-item>
                <el-descriptions-item label="金额(amount)">{{ formatAmount(repurchaseResult.amount) }}</el-descriptions-item>
              </el-descriptions>
            </div>
            <el-empty v-else :image-size="60" description="暂无复购记录，点击「新建复购」创建" />
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 创建/更新粉丝画像弹窗 -->
    <el-dialog v-model="fanDialog" title="创建/更新粉丝画像" aria-label="创建或更新粉丝画像弹窗" width="520px">
      <el-form label-width="100px" @submit.prevent>
        <el-form-item label="平台" required>
          <el-input v-model="fanForm.platform" placeholder="平台（必填）" aria-label="粉丝平台" />
        </el-form-item>
        <el-form-item label="公开ID" required>
          <el-input v-model="fanForm.publicId" placeholder="平台公开ID（必填，禁止个体隐私字段）" aria-label="粉丝公开ID" />
        </el-form-item>
        <el-form-item label="层级">
          <el-input v-model="fanForm.level" placeholder="默认 normal" aria-label="粉丝层级" />
        </el-form-item>
        <el-form-item label="来源">
          <el-select v-model="fanForm.source" placeholder="选择来源（可选）" clearable style="width: 100%" aria-label="粉丝来源">
            <el-option v-for="opt in fansSourceOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="聚合分布">
          <el-input
            v-model="fanForm.interactAgg"
            type="textarea"
            :rows="3"
            placeholder="聚合交互分布 JSON 对象（可选），如 {&quot;like&quot;:120,&quot;comment&quot;:30}"
            aria-label="聚合分布JSON"
          />
        </el-form-item>
        <el-form-item label="标签">
          <el-input
            v-model="fanForm.tags"
            type="textarea"
            :rows="2"
            placeholder="逗号或换行分隔，如 高潜,复购客"
            aria-label="粉丝标签"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="fanDialog = false">取消</el-button>
        <el-button type="primary" :loading="fanSubmitting" @click="confirmCreateFan">确定保存</el-button>
      </template>
    </el-dialog>

    <!-- 打标弹窗 -->
    <el-dialog v-model="tagDialog" title="粉丝分层打标" aria-label="粉丝打标弹窗" width="480px">
      <el-form label-width="80px" @submit.prevent>
        <el-form-item label="目标">
          <span v-if="tagTarget" class="target-info">#{{ tagTarget.id }} · {{ tagTarget.platform }} · {{ tagTarget.publicId }}</span>
        </el-form-item>
        <el-form-item label="标签" required>
          <el-input
            v-model="tagForm.tags"
            type="textarea"
            :rows="3"
            placeholder="逗号或换行分隔，如 高潜,复购客"
            aria-label="打标标签"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="tagDialog = false">取消</el-button>
        <el-button type="primary" :loading="tagSubmitting" @click="confirmTag">确定打标</el-button>
      </template>
    </el-dialog>

    <!-- 创建私域群弹窗 -->
    <el-dialog v-model="groupDialog" title="创建私域群" aria-label="创建私域群弹窗" width="520px">
      <el-form label-width="100px" @submit.prevent>
        <el-form-item label="群名" required>
          <el-input v-model="groupForm.name" placeholder="群名称（必填）" aria-label="私域群名" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="groupForm.type" placeholder="选择类型" style="width: 100%" aria-label="私域群类型">
            <el-option v-for="opt in privateGroupTypeOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="成员">
          <el-input
            v-model="groupForm.members"
            type="textarea"
            :rows="3"
            placeholder="逗号或换行分隔公开ID（可选）"
            aria-label="私域群成员公开ID"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="groupDialog = false">取消</el-button>
        <el-button type="primary" :loading="groupSubmitting" @click="confirmCreateGroup">确定创建</el-button>
      </template>
    </el-dialog>

    <!-- 推客分销弹窗 -->
    <el-dialog v-model="distributeDialog" title="推客分销" aria-label="推客分销弹窗" width="520px">
      <el-form label-width="100px" @submit.prevent>
        <el-form-item label="公开ID" required>
          <el-input
            v-model="distributeForm.publicIds"
            type="textarea"
            :rows="3"
            placeholder="逗号或换行分隔公开ID（必填）"
            aria-label="分销公开ID"
          />
        </el-form-item>
        <el-form-item label="计划名称" required>
          <el-input v-model="distributeForm.planName" placeholder="分销计划名称（必填）" aria-label="分销计划名称" />
        </el-form-item>
        <el-form-item label="分级佣金" required>
          <el-input v-model.number="distributeForm.tierCommission" type="number" placeholder="≥0（必填）" aria-label="分级佣金" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="distributeDialog = false">取消</el-button>
        <el-button type="primary" :loading="distributeSubmitting" @click="confirmDistribute">确定创建</el-button>
      </template>
    </el-dialog>

    <!-- 复购 CRM 弹窗 -->
    <el-dialog v-model="repurchaseDialog" title="复购 CRM" aria-label="复购CRM弹窗" width="520px">
      <el-form label-width="100px" @submit.prevent>
        <el-form-item label="公开ID" required>
          <el-input v-model="repurchaseForm.publicId" placeholder="平台公开ID（必填）" aria-label="复购公开ID" />
        </el-form-item>
        <el-form-item label="商品">
          <el-input
            v-model="repurchaseForm.products"
            type="textarea"
            :rows="2"
            placeholder="逗号分隔商品名（可选）"
            aria-label="复购商品"
          />
        </el-form-item>
        <el-form-item label="金额">
          <el-input v-model.number="repurchaseForm.amount" type="number" placeholder="≥0，默认 0（可选）" aria-label="复购金额" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="repurchaseDialog = false">取消</el-button>
        <el-button type="success" :loading="repurchaseSubmitting" @click="confirmRepurchase">确定创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
/* 页面标题区 */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-6);
}
.page-header-left {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.page-title {
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--app-neutral-800);
  margin: 0;
  line-height: var(--text-2xl);
}
.page-subtitle {
  font-size: var(--text-base);
  color: var(--app-neutral-500);
  margin: 0;
  line-height: var(--text-base);
}

/* tabs 卡片包裹 */
:deep(.el-tabs) {
  padding: 0;
}
:deep(.el-tabs__header) {
  margin-bottom: var(--space-4);
  padding: 0 var(--card-padding);
  background: var(--app-neutral-0);
}
:deep(.el-tabs__content) {
  padding: 0 var(--card-padding) var(--card-padding);
}

/* 筛选区 */
.filter-bar {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-bottom: var(--space-4);
  align-items: center;
}
.filter-tip {
  font-size: var(--text-sm);
  color: var(--app-neutral-500);
  margin-left: var(--space-2);
}

/* 表格 */
.data-table {
  width: 100%;
}

/* 标签间距 */
.tag-item {
  margin: 0 4px 4px 0;
}

/* 文本占位 */
.text-muted {
  color: var(--app-neutral-400);
  font-size: var(--text-base-sm);
}

/* 复购分销网格 */
.repurchase-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: var(--space-4);
}
.repurchase-card {
  padding: var(--card-padding);
}
.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--app-neutral-100);
}
.card-head-title {
  font-size: var(--text-md);
  font-weight: 600;
  color: var(--app-neutral-800);
  margin: 0;
}
.result-box {
  min-height: 60px;
}

/* 目标信息 */
.target-info {
  color: var(--app-neutral-700);
  font-size: var(--text-base-sm);
}
</style>
