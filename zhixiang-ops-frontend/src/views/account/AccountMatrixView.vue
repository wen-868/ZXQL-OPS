<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  deleteAccount,
  getAccount,
  getHealthSummary,
  listAccounts,
  type AccountQuery,
  type AccountView,
  type HealthSummary,
} from '@/api/accounts'
import { formatCount, formatDateTime } from '@/utils/format'
import {
  identityLabels,
  platformLabels,
  stageLabels,
  statusMeta,
} from './accountMaps'
import { identityOptions, platformOptions, stageOptions, statusOptions } from './accountMaps'
import AccountFormDrawer from './AccountFormDrawer.vue'

// ===== 状态 =====
const loading = ref(false)
const error = ref<string | null>(null)
const list = ref<AccountView[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)

const health = ref<HealthSummary | null>(null)

// 筛选条件
const filters = reactive<AccountQuery>({
  platform: undefined,
  identity: undefined,
  stage: undefined,
  status: undefined,
  keyword: '',
  page: 1,
  pageSize: 20,
})

// 抽屉
const drawerVisible = ref(false)
const editingAccount = ref<AccountView | null>(null)

// 详情
const detailVisible = ref(false)
const detail = ref<AccountView | null>(null)

// ===== 数据加载 =====
async function loadList() {
  loading.value = true
  error.value = null
  try {
    const params: AccountQuery = {
      page: currentPage.value,
      pageSize: pageSize.value,
    }
    if (filters.platform) params.platform = filters.platform
    if (filters.identity) params.identity = filters.identity
    if (filters.stage) params.stage = filters.stage
    if (filters.status) params.status = filters.status
    if (filters.keyword) params.keyword = filters.keyword
    const res = await listAccounts(params)
    list.value = res.list
    total.value = res.total
  } catch {
    error.value = '账号列表加载失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

async function loadHealth() {
  try {
    health.value = await getHealthSummary()
  } catch {
    // 健康看板失败不阻断列表
  }
}

function loadAll() {
  loadList()
  loadHealth()
}

// ===== 筛选交互 =====
function handleSearch() {
  currentPage.value = 1
  filters.page = 1
  loadList()
}
function handleReset() {
  filters.platform = undefined
  filters.identity = undefined
  filters.stage = undefined
  filters.status = undefined
  filters.keyword = ''
  currentPage.value = 1
  filters.page = 1
  loadList()
}
function handlePageChange(page: number) {
  currentPage.value = page
  filters.page = page
  loadList()
}
function handleSizeChange(size: number) {
  pageSize.value = size
  filters.pageSize = size
  currentPage.value = 1
  filters.page = 1
  loadList()
}

// ===== 新增/编辑 =====
function openCreate() {
  editingAccount.value = null
  drawerVisible.value = true
}
function openEdit(row: AccountView) {
  editingAccount.value = row
  drawerVisible.value = true
}

// ===== 详情 =====
async function openDetail(row: AccountView) {
  try {
    detail.value = await getAccount(row.id)
    detailVisible.value = true
  } catch {
    // 拦截器已提示
  }
}

// ===== 删除（二次确认）=====
async function handleDelete(row: AccountView) {
  try {
    await ElMessageBox.confirm(
      `确认删除账号「${row.nickname || row.platformAccountId}」？此操作为软删除，可恢复。`,
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  } catch {
    return // 用户取消
  }
  try {
    await deleteAccount(row.id)
    ElMessage.success('已删除')
    loadAll()
  } catch {
    // 拦截器已提示
  }
}

onMounted(loadAll)
</script>

<template>
  <div class="page-container" aria-label="B 账号矩阵">
    <!-- 页面标题区 -->
    <div class="page-header">
      <div>
        <h1 class="page-title">B·账号矩阵</h1>
        <p class="page-subtitle">管理多平台矩阵账号，实时监控账号健康状态与Token有效性</p>
      </div>
      <el-button type="primary" @click="openCreate">+ 新建账号</el-button>
    </div>

    <!-- 健康看板卡片 -->
    <div class="health-cards" aria-label="矩阵健康看板">
      <div class="health-card">
        <div class="hc-label">账号总数</div>
        <div class="hc-value">{{ health ? health.total : '-' }}</div>
      </div>
      <div class="health-card">
        <div class="hc-label">正常</div>
        <div class="hc-value hc-success">{{ health?.byStatus?.normal ?? 0 }}</div>
      </div>
      <div class="health-card">
        <div class="hc-label">预警/风险</div>
        <div class="hc-value hc-warning">{{ (health?.byStatus?.warning ?? 0) + (health?.byStatus?.risk ?? 0) }}</div>
      </div>
      <div class="health-card">
        <div class="hc-label">未签约</div>
        <div class="hc-value hc-info">{{ health?.byStatus?.unsigned ?? 0 }}</div>
      </div>
      <div class="health-card">
        <div class="hc-label">掉签账号</div>
        <div class="hc-value hc-danger">{{ health?.unsignedAccounts?.length ?? 0 }}</div>
      </div>
    </div>

    <!-- 筛选区 -->
    <div class="card filter-card">
      <el-form :model="filters" inline @submit.prevent>
        <el-form-item label="平台">
          <el-select v-model="filters.platform" placeholder="全部" clearable size="default" style="width:130px" aria-label="按平台筛选">
            <el-option v-for="opt in platformOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="身份">
          <el-select v-model="filters.identity" placeholder="全部" clearable size="default" style="width:120px" aria-label="按身份筛选">
            <el-option v-for="opt in identityOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="阶段">
          <el-select v-model="filters.stage" placeholder="全部" clearable size="default" style="width:120px" aria-label="按阶段筛选">
            <el-option v-for="opt in stageOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="全部" clearable size="default" style="width:120px" aria-label="按状态筛选">
            <el-option v-for="opt in statusOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键词">
          <el-input v-model="filters.keyword" placeholder="昵称/账号ID" clearable size="default" style="width:180px" aria-label="关键词搜索" @keyup.enter="handleSearch" />
        </el-form-item>
      </el-form>
      <div class="filter-actions">
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="handleReset">重置</el-button>
      </div>
    </div>

    <!-- 表格区 -->
    <div class="card">
      <div v-if="error" role="alert" class="error-box">
        <el-alert type="error" :closable="false" :title="error">
          <template #default>
            <el-button size="small" @click="loadAll">重试</el-button>
          </template>
        </el-alert>
      </div>

      <el-table v-loading="loading" :data="list" stripe aria-label="账号列表" row-key="id">
        <template #empty>
          <el-empty description="暂无账号数据，点击「新建账号」开始" />
        </template>
        <el-table-column prop="nickname" label="昵称" min-width="140">
          <template #default="{ row }">
            <span class="nick">{{ row.nickname || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="platform" label="平台" width="100">
          <template #default="{ row }">
            {{ platformLabels[row.platform as keyof typeof platformLabels] }}
          </template>
        </el-table-column>
        <el-table-column prop="platformAccountId" label="平台账号ID" min-width="160" show-overflow-tooltip />
        <el-table-column prop="identity" label="身份" width="90">
          <template #default="{ row }">
            {{ identityLabels[row.identity as keyof typeof identityLabels] || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="stage" label="阶段" width="100">
          <template #default="{ row }">
            {{ stageLabels[row.stage as keyof typeof stageLabels] || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="fansCount" label="粉丝数" width="110" align="right">
          <template #default="{ row }">
            {{ formatCount(row.fansCount) }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="statusMeta[row.status as keyof typeof statusMeta].type" size="small" :disabled="row.status === 'banned'">
              {{ statusMeta[row.status as keyof typeof statusMeta].label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" min-width="170" show-overflow-tooltip>
          <template #default="{ row }">
            {{ formatDateTime(row.updatedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openDetail(row)">详情</el-button>
            <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && list.length === 0" description="暂无数据" />
      <div class="table-pagination" v-if="total > 0">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          background
          aria-label="分页"
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    </div>

    <!-- 新建/编辑抽屉 -->
    <AccountFormDrawer v-model="drawerVisible" :account="editingAccount" @saved="loadAll" />

    <!-- 详情抽屉 -->
    <el-drawer v-model="detailVisible" title="账号详情" size="480px" destroy-on-close aria-label="账号详情">
      <el-descriptions v-if="detail" :column="1" border>
        <el-descriptions-item label="ID">{{ detail.id }}</el-descriptions-item>
        <el-descriptions-item label="昵称">{{ detail.nickname || '-' }}</el-descriptions-item>
        <el-descriptions-item label="平台">{{ platformLabels[detail.platform] }}</el-descriptions-item>
        <el-descriptions-item label="平台账号ID">{{ detail.platformAccountId }}</el-descriptions-item>
        <el-descriptions-item label="身份">{{ identityLabels[detail.identity || 'matrix'] }}</el-descriptions-item>
        <el-descriptions-item label="赛道">{{ detail.track || '-' }}</el-descriptions-item>
        <el-descriptions-item label="阶段">{{ stageLabels[detail.stage || 'nurturing'] }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="statusMeta[detail.status].type" size="small" :disabled="detail.status === 'banned'">
            {{ statusMeta[detail.status].label }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="粉丝数">{{ formatCount(detail.fansCount) }}</el-descriptions-item>
        <el-descriptions-item label="关注数">{{ formatCount(detail.followCount) }}</el-descriptions-item>
        <el-descriptions-item label="获赞数">{{ formatCount(detail.likeCount) }}</el-descriptions-item>
        <el-descriptions-item label="Token过期">{{ formatDateTime(detail.tokenExpireAt) }}</el-descriptions-item>
        <el-descriptions-item label="最后同步">{{ formatDateTime(detail.lastSyncAt) }}</el-descriptions-item>
        <el-descriptions-item label="最后活跃">{{ formatDateTime(detail.lastActiveAt) }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ formatDateTime(detail.createdAt) }}</el-descriptions-item>
        <el-descriptions-item label="更新时间">{{ formatDateTime(detail.updatedAt) }}</el-descriptions-item>
        <el-descriptions-item label="备注">{{ detail.remark || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-drawer>
  </div>
</template>

<style scoped>
/* 页面标题区 */
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-lg); }
.page-title { font-size: var(--text-2xl); font-weight: 700; color: var(--el-text-color-primary); margin: 0 0 4px 0; }
.page-subtitle { font-size: var(--text-base); color: var(--el-text-color-secondary); margin: 0; }

/* 健康看板卡片 */
.health-cards { display: grid; grid-template-columns: repeat(5, 1fr); gap: var(--space-md); margin-bottom: var(--space-md); }
.health-card {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: var(--radius-lg);
  padding: var(--card-padding-sm);
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--duration-normal) var(--ease-out);
}
.health-card:hover { box-shadow: var(--shadow-md); }
.health-card .hc-label { font-size: var(--text-base-sm); color: var(--el-text-color-secondary); }
.health-card .hc-value { font-size: var(--text-3xl); font-weight: 700; margin-top: var(--space-sm); font-family: var(--font-number); color: var(--el-text-color-primary); }
.hc-success { color: var(--app-success-600); }
.hc-warning { color: var(--app-warning-600); }
.hc-info { color: var(--app-brand-600); }
.hc-danger { color: var(--app-danger-600); }

/* 筛选区 */
.filter-card { padding: var(--space-lg); margin-bottom: var(--space-md); }
.filter-card .el-form { margin-bottom: 12px; }
.filter-actions { display: flex; gap: var(--space-sm); }

/* 表格区 */
.table-pagination { display: flex; justify-content: flex-end; padding-top: var(--space-md); }
.error-box { margin-bottom: var(--space-md); }
</style>
