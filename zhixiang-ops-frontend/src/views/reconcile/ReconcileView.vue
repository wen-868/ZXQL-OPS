<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  recordRevenue,
  listRevenue,
  reconcile,
  settle,
  invoice,
  profit,
  type RevenueListView,
  type RevenueRecordView,
  type RevenueSource,
  type RevenueStatus,
  type ReconciliationView,
  type SettlementView,
  type ProfitView,
} from '@/api/reconcile'
import { formatDateTime, formatAmount } from '@/utils/format'

const activeTab = ref<'revenue' | 'reconcile' | 'profit'>('revenue')

const sourceLabels: Record<RevenueSource, string> = {
  commission: '佣金',
  slot_fee: '坑位费',
  service_fee: '服务费',
  tip: '打赏',
  subsidy: '补贴',
}
const statusLabels: Record<RevenueStatus, string> = { pending: '待结算', settled: '已结算' }

// ============ Tab 1. 收益记录 ============
const revenue = ref<RevenueRecordView[]>([])
const summary = ref<RevenueListView['summary']>([])
const revenueLoading = ref(false)
const sourceFilter = ref<RevenueSource | ''>('')

const revenueTotal = computed(() =>
  summary.value.reduce((acc, s) => acc + s.total, 0),
)
const commissionTotal = computed(() =>
  revenue.value.reduce((acc, r) => acc + r.commission, 0),
)

async function loadRevenue() {
  revenueLoading.value = true
  try {
    const res = await listRevenue(sourceFilter.value || undefined)
    revenue.value = res.items
    summary.value = res.summary
  } catch {
    revenue.value = []
    summary.value = []
  } finally {
    revenueLoading.value = false
  }
}

// 新增收益弹窗
const revDialog = ref(false)
const revSubmitting = ref(false)
const revForm = reactive({
  source: '' as RevenueSource | '',
  platform: '',
  amount: 0,
  commission: 0,
  relatedOrderId: '',
  status: '' as RevenueStatus | '',
})
function openCreateRevenue() {
  revForm.source = ''
  revForm.platform = ''
  revForm.amount = 0
  revForm.commission = 0
  revForm.relatedOrderId = ''
  revForm.status = ''
  revDialog.value = true
}
async function confirmCreateRevenue() {
  if (!revForm.source) return ElMessage.warning('收益类型必填')
  if (!revForm.platform.trim()) return ElMessage.warning('平台必填')
  revSubmitting.value = true
  try {
    await recordRevenue({
      source: revForm.source,
      platform: revForm.platform.trim(),
      amount: revForm.amount,
      commission: revForm.commission || undefined,
      relatedOrderId: revForm.relatedOrderId.trim() || undefined,
      status: revForm.status || undefined,
    })
    ElMessage.success('收益已记录')
    revDialog.value = false
    await loadRevenue()
  } catch {
    // 拦截器已提示
  } finally {
    revSubmitting.value = false
  }
}

// ============ Tab 2. 对账与分账 ============
const reconcilePeriod = ref('')
const currentReconcile = ref<ReconciliationView | null>(null)
const reconciling = ref(false)
async function doReconcile() {
  if (!reconcilePeriod.value.trim()) return ElMessage.warning('账期(YYYY-MM)必填')
  reconciling.value = true
  try {
    currentReconcile.value = await reconcile(reconcilePeriod.value.trim())
    ElMessage.success('对账已生成')
  } catch {
    // 拦截器已提示
  } finally {
    reconciling.value = false
  }
}

const settleDialog = ref(false)
const settleSubmitting = ref(false)
const settlementParties = ref<{ role: string; name: string; amount: number }[]>([
  { role: 'org', name: '', amount: 0 },
  { role: 'talent', name: '', amount: 0 },
  { role: 'ad_operator', name: '', amount: 0 },
])
const settleAmount = ref(0)
const currentSettlement = ref<SettlementView | null>(null)
function openSettle() {
  settlementParties.value = [
    { role: 'org', name: '', amount: 0 },
    { role: 'talent', name: '', amount: 0 },
    { role: 'ad_operator', name: '', amount: 0 },
  ]
  settleAmount.value = 0
  settleDialog.value = true
}
async function confirmSettle() {
  const parties = settlementParties.value.filter((p) => p.name.trim())
  if (!parties.length) return ElMessage.warning('至少添加一个分账方')
  settleSubmitting.value = true
  try {
    currentSettlement.value = await settle({
      type: 'org_talent_advertiser',
      parties,
      amount: settleAmount.value,
    })
    ElMessage.success('分账已发起')
    settleDialog.value = false
  } catch {
    // 拦截器已提示
  } finally {
    settleSubmitting.value = false
  }
}
async function doInvoice() {
  if (!currentSettlement.value) return
  try {
    currentSettlement.value = await invoice(currentSettlement.value.id)
    ElMessage.success('已开票')
  } catch {
    // 拦截器已提示
  }
}

// ============ Tab 3. 利润透视 ============
const profitView = ref<ProfitView | null>(null)
const profitLoading = ref(false)
async function loadProfit() {
  profitLoading.value = true
  try {
    profitView.value = await profit()
  } catch {
    profitView.value = null
  } finally {
    profitLoading.value = false
  }
}

onMounted(() => {
  loadRevenue()
})
</script>

<template>
  <section class="reconcile-view" aria-label="W 收益与对账中心">
    <el-alert
      type="info"
      :closable="false"
      show-icon
      class="compliance-alert"
      title="W 收益与对账中心：收益归集（按佣金/坑位费/服务费/打赏/补贴）/ 周期对账 / 机构-达人-投手分账 / 利润透视；tenantId 由统一拦截器注入。"
    />
    <el-tabs v-model="activeTab" type="border-card" aria-label="W 功能分区">
      <!-- ===== 1. 收益记录 ===== -->
      <el-tab-pane name="revenue">
        <template #label><span aria-label="收益记录标签页">收益记录</span></template>
        <div class="filter-bar" aria-label="收益操作栏">
          <el-button type="primary" @click="openCreateRevenue" aria-label="新增收益">新增收益</el-button>
          <el-select
            v-model="sourceFilter"
            placeholder="按收益类型筛选"
            clearable
            style="width: 200px"
            aria-label="收益类型筛选"
            @change="loadRevenue"
          >
            <el-option label="全部类型" value="" />
            <el-option v-for="(l, k) in sourceLabels" :key="k" :label="l" :value="k" />
          </el-select>
          <el-button @click="loadRevenue" aria-label="刷新收益列表">刷新</el-button>
        </div>
        <div class="summary-cards">
          <el-card shadow="never" class="sum-card">
            <div class="sum-label">收益合计</div>
            <div class="sum-value">{{ formatAmount(revenueTotal) }}</div>
          </el-card>
          <el-card shadow="never" class="sum-card">
            <div class="sum-label">佣金合计</div>
            <div class="sum-value">{{ formatAmount(commissionTotal) }}</div>
          </el-card>
        </div>
        <el-table :data="summary" border class="sub-table" aria-label="收益聚合">
          <el-table-column label="收益类型" width="120">
            <template #default="{ row }">{{ sourceLabels[(row as RevenueListView['summary'][number]).source] || (row as RevenueListView['summary'][number]).source }}</template>
          </el-table-column>
          <el-table-column label="金额" min-width="140">
            <template #default="{ row }">{{ formatAmount((row as RevenueListView['summary'][number]).total) }}</template>
          </el-table-column>
          <el-table-column prop="count" label="笔数" width="100" />
        </el-table>
        <el-table :data="revenue" border v-loading="revenueLoading" class="sub-table" aria-label="收益明细">
          <el-table-column prop="id" label="ID" width="70" />
          <el-table-column label="类型" width="100">
            <template #default="{ row }">{{ sourceLabels[(row as RevenueRecordView).source] || (row as RevenueRecordView).source }}</template>
          </el-table-column>
          <el-table-column prop="platform" label="平台" width="110" />
          <el-table-column prop="relatedOrderId" label="关联订单" min-width="140" show-overflow-tooltip />
          <el-table-column label="金额" min-width="120">
            <template #default="{ row }">{{ formatAmount((row as RevenueRecordView).amount) }}</template>
          </el-table-column>
          <el-table-column label="佣金" min-width="110">
            <template #default="{ row }">{{ formatAmount((row as RevenueRecordView).commission) }}</template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }">{{ statusLabels[(row as RevenueRecordView).status] }}</template>
          </el-table-column>
          <el-table-column label="创建时间" min-width="170">
            <template #default="{ row }">{{ formatDateTime((row as RevenueRecordView).createdAt) }}</template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!revenueLoading && !revenue.length" description="暂无收益记录，点击「新增收益」开始归集" />
      </el-tab-pane>

      <!-- ===== 2. 对账与分账 ===== -->
      <el-tab-pane name="reconcile">
        <template #label><span aria-label="对账与分账标签页">对账与分账</span></template>
        <div class="filter-bar" aria-label="对账操作栏">
          <el-input v-model="reconcilePeriod" placeholder="账期 YYYY-MM" style="width: 160px" aria-label="对账账期" />
          <el-button type="primary" :loading="reconciling" @click="doReconcile" aria-label="生成对账">生成对账</el-button>
          <el-button @click="openSettle" aria-label="发起分账">发起分账</el-button>
        </div>
        <el-card v-if="currentReconcile" shadow="never" class="block-card" aria-label="对账结果">
          <template #header><span>对账单 #{{ currentReconcile.id }}（{{ currentReconcile.period }}）</span></template>
          <el-descriptions :column="3" border size="small">
            <el-descriptions-item label="订单金额">{{ formatAmount(currentReconcile.orderAmount) }}</el-descriptions-item>
            <el-descriptions-item label="佣金金额">{{ formatAmount(currentReconcile.commissionAmount) }}</el-descriptions-item>
            <el-descriptions-item label="已结算金额">{{ formatAmount(currentReconcile.settledAmount) }}</el-descriptions-item>
            <el-descriptions-item label="差异">{{ formatAmount(currentReconcile.diff) }}</el-descriptions-item>
            <el-descriptions-item label="状态">{{ currentReconcile.status }}</el-descriptions-item>
          </el-descriptions>
        </el-card>
        <el-card v-if="currentSettlement" shadow="never" class="block-card" aria-label="分账结果">
          <template #header>
            <div class="card-head">
              <span>分账单 #{{ currentSettlement.id }}（状态：{{ currentSettlement.status }}）</span>
              <el-button
                v-if="currentSettlement.status !== 'invoiced'"
                type="success"
                size="small"
                @click="doInvoice"
                aria-label="对分账单开票"
              >开票</el-button>
            </div>
          </template>
          <el-table :data="currentSettlement.parties" border size="small" class="sub-table" aria-label="分账明细">
            <el-table-column prop="role" label="角色" />
            <el-table-column prop="name" label="参与方" />
            <el-table-column label="金额"><template #default="{ row }">{{ formatAmount((row as SettlementView['parties'][number]).amount) }}</template></el-table-column>
          </el-table>
          <div class="sum-line">分账总额：{{ formatAmount(currentSettlement.amount) }}</div>
        </el-card>
        <el-empty v-if="!currentReconcile && !currentSettlement" description="输入账期生成对账，或发起机构-达人-投手分账" />
      </el-tab-pane>

      <!-- ===== 3. 利润透视 ===== -->
      <el-tab-pane name="profit">
        <template #label><span aria-label="利润透视标签页">利润透视</span></template>
        <div class="filter-bar" aria-label="利润操作栏">
          <el-button @click="loadProfit" :loading="profitLoading" aria-label="加载利润透视">加载利润透视</el-button>
        </div>
        <div v-if="profitView" class="summary-cards">
          <el-card shadow="never" class="sum-card">
            <div class="sum-label">总营收</div>
            <div class="sum-value">{{ formatAmount(profitView.totalRevenue) }}</div>
          </el-card>
          <el-card shadow="never" class="sum-card">
            <div class="sum-label">总佣金</div>
            <div class="sum-value">{{ formatAmount(profitView.totalCommission) }}</div>
          </el-card>
          <el-card shadow="never" class="sum-card">
            <div class="sum-label">总投流成本</div>
            <div class="sum-value">{{ formatAmount(profitView.totalAdCost) }}</div>
          </el-card>
          <el-card shadow="never" class="sum-card">
            <div class="sum-label">净利润</div>
            <div class="sum-value strong">{{ formatAmount(profitView.netProfit) }}</div>
          </el-card>
        </div>
        <el-empty v-if="!profitLoading && !profitView" description="点击「加载利润透视」聚合营收-佣金-投流成本" />
      </el-tab-pane>
    </el-tabs>

    <!-- 新增收益弹窗 -->
    <el-dialog v-model="revDialog" title="新增收益" aria-label="新增收益弹窗" width="600px">
      <el-form label-width="110px" @submit.prevent>
        <el-form-item label="收益类型" required>
          <el-select v-model="revForm.source" placeholder="选择收益类型" style="width: 100%" aria-label="收益类型">
            <el-option v-for="(l, k) in sourceLabels" :key="k" :label="l" :value="k" />
          </el-select>
        </el-form-item>
        <el-form-item label="平台" required>
          <el-input v-model="revForm.platform" placeholder="如 douyin / xhs（必填）" aria-label="收益平台" />
        </el-form-item>
        <el-form-item label="金额" required>
          <el-input v-model.number="revForm.amount" type="number" aria-label="收益金额" />
        </el-form-item>
        <el-form-item label="佣金">
          <el-input v-model.number="revForm.commission" type="number" aria-label="佣金" />
        </el-form-item>
        <el-form-item label="关联订单号">
          <el-input v-model="revForm.relatedOrderId" placeholder="可选" aria-label="关联订单号" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="revForm.status" clearable placeholder="可选（默认 pending）" style="width: 100%" aria-label="收益状态">
            <el-option label="待结算 pending" value="pending" />
            <el-option label="已结算 settled" value="settled" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="revDialog = false">取消</el-button>
        <el-button type="primary" :loading="revSubmitting" @click="confirmCreateRevenue">确定保存</el-button>
      </template>
    </el-dialog>

    <!-- 发起分账弹窗 -->
    <el-dialog v-model="settleDialog" title="发起分账（机构-达人-投手）" aria-label="发起分账弹窗" width="620px">
      <el-form label-width="110px" @submit.prevent>
        <el-form-item label="分账总额" required>
          <el-input v-model.number="settleAmount" type="number" aria-label="分账总额" />
        </el-form-item>
        <el-divider>分账参与方</el-divider>
        <div v-for="(p, idx) in settlementParties" :key="idx" class="party-row">
          <el-select v-model="p.role" style="width: 150px" aria-label="分账角色">
            <el-option label="机构 org" value="org" />
            <el-option label="达人 talent" value="talent" />
            <el-option label="投手 ad_operator" value="ad_operator" />
          </el-select>
          <el-input v-model="p.name" placeholder="参与方名称" style="width: 150px" aria-label="参与方名称" />
          <el-input v-model.number="p.amount" type="number" placeholder="金额" style="width: 130px" aria-label="分账金额" />
          <el-button
            v-if="settlementParties.length > 1"
            type="danger"
            link
            @click="settlementParties.splice(idx, 1)"
            aria-label="删除参与方"
          >删除</el-button>
        </div>
        <el-button link type="primary" @click="settlementParties.push({ role: 'talent', name: '', amount: 0 })" aria-label="增加参与方">+ 增加参与方</el-button>
      </el-form>
      <template #footer>
        <el-button @click="settleDialog = false">取消</el-button>
        <el-button type="primary" :loading="settleSubmitting" @click="confirmSettle">确定发起</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.reconcile-view {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.filter-bar {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-bottom: var(--space-3);
  align-items: center;
}
.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}
.sum-card .sum-label {
  font-size: var(--text-sm);
  color: var(--el-text-color-secondary);
}
.sum-card .sum-value {
  font-size: var(--text-lg);
  font-weight: 600;
  margin-top: var(--space-1);
}
.sum-card .sum-value.strong {
  color: var(--app-success-500);
}
.block-card {
  margin-bottom: var(--space-3);
}
.sub-table {
  margin-top: var(--space-2);
}
.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
}
.sum-line {
  margin-top: var(--space-2);
  font-weight: 600;
}
.party-row {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
  align-items: center;
}
</style>
