<template>
  <div class="page-container">
    <!-- 页面标题区 -->
    <div class="page-header">
      <div>
        <h1 class="page-title">达人 / 商单管理</h1>
        <p class="page-subtitle">达人档案、商单（含达人分成结算进度）、经营概览</p>
      </div>
      <div class="header-actions">
        <el-button type="primary" @click="openCreateTalent">新建达人</el-button>
        <el-button type="primary" @click="openCreateOrder">新建商单</el-button>
      </div>
    </div>

    <el-tabs v-model="tab">
      <!-- 概览 -->
      <el-tab-pane label="经营概览" name="overview">
        <el-skeleton v-if="summaryLoading" :rows="4" />
        <el-descriptions v-else-if="summary" :column="3" border>
          <el-descriptions-item label="达人总数">{{ summary.talentCount }}</el-descriptions-item>
          <el-descriptions-item label="合作中达人">{{ summary.activeTalentCount }}</el-descriptions-item>
          <el-descriptions-item label="商单总数">{{ summary.orderCount }}</el-descriptions-item>
          <el-descriptions-item label="已结算商单">{{ summary.settledCount }}</el-descriptions-item>
          <el-descriptions-item label="商单总额(元)">{{ summary.totalAmount?.toFixed?.(2) }}</el-descriptions-item>
          <el-descriptions-item label="已结算金额(元)">{{ summary.settledAmount?.toFixed?.(2) }}</el-descriptions-item>
        </el-descriptions>
        <el-empty v-else description="暂无概览数据" />
      </el-tab-pane>

      <!-- 达人 -->
      <el-tab-pane label="达人档案" name="talent">
        <el-card shadow="never">
          <el-table :data="talents" v-loading="talentLoading" stripe>
            <el-table-column prop="name" label="名称" min-width="120" />
            <el-table-column prop="type" label="类型" width="100">
              <template #default="{ row }"><el-tag size="small">{{ typeLabel(row.type) }}</el-tag></template>
            </el-table-column>
            <el-table-column prop="contact" label="联系方式" min-width="140" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }"><el-tag :type="row.status==='active'?'success':'info'" size="small">{{ statusLabel(row.status) }}</el-tag></template>
            </el-table-column>
            <el-table-column label="机构分成%" width="100">
              <template #default="{ row }">{{ row.agencyShareRate ?? '-' }}</template>
            </el-table-column>
            <el-table-column label="达人分成%" width="100">
              <template #default="{ row }">{{ row.talentShareRate ?? '-' }}</template>
            </el-table-column>
            <el-table-column label="操作" width="160" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="openEditTalent(row)">编辑</el-button>
                <el-button link type="danger" @click="onDeleteTalent(row)">删除</el-button>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty description="暂无达人档案" />
            </template>
          </el-table>
          <div class="table-pagination">
            <el-pagination layout="total, prev, pager, next" :total="talentTotal"
              :page-size="talentPageSize" :current-page="talentPage"
              @current-change="(p:number)=>{talentPage=p;loadTalents()}" />
          </div>
        </el-card>
      </el-tab-pane>

      <!-- 商单 -->
      <el-tab-pane label="商单" name="order">
        <el-card shadow="never">
          <el-table :data="orders" v-loading="orderLoading" stripe>
            <el-table-column prop="advertiser" label="广告主" min-width="120" />
            <el-table-column prop="talentId" label="达人ID" width="90" />
            <el-table-column prop="amount" label="金额(元)" width="110">
              <template #default="{ row }">{{ row.amount?.toFixed?.(2) }}</template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="110">
              <template #default="{ row }"><el-tag :type="orderStatusType(row.status)" size="small">{{ row.status }}</el-tag></template>
            </el-table-column>
            <el-table-column prop="contractNo" label="合同号" min-width="120" />
            <el-table-column prop="talentShareRate" label="达人分成%" width="100" />
            <el-table-column label="操作" width="160" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" :disabled="row.status==='settled'||row.status==='cancelled'" @click="openSettle(row)">结算</el-button>
                <el-button link type="danger" @click="onDeleteOrder(row)">删除</el-button>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty description="暂无商单" />
            </template>
          </el-table>
          <div class="table-pagination">
            <el-pagination layout="total, prev, pager, next" :total="orderTotal"
              :page-size="orderPageSize" :current-page="orderPage"
              @current-change="(p:number)=>{orderPage=p;loadOrders()}" />
          </div>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <!-- 达人 新建/编辑 -->
    <el-dialog v-model="talentDialog" :title="talentForm.id?'编辑达人':'新建达人'" width="560px">
      <el-form :model="talentForm" label-width="100px">
        <el-form-item label="名称"><el-input v-model="talentForm.name" /></el-form-item>
        <el-form-item label="类型">
          <el-select v-model="talentForm.type" style="width:100%">
            <el-option label="内部" value="internal" />
            <el-option label="外部" value="external" />
            <el-option label="机构" value="agency" />
          </el-select>
        </el-form-item>
        <el-form-item label="联系方式"><el-input v-model="talentForm.contact" /></el-form-item>
        <el-form-item label="达人账号ID"><el-input v-model.number="talentForm.talentAccountId" type="number" /></el-form-item>
        <el-form-item label="数字人ID"><el-input v-model.number="talentForm.digitalHumanId" type="number" /></el-form-item>
        <el-form-item label="机构分成%"><el-input v-model.number="talentForm.agencyShareRate" type="number" /></el-form-item>
        <el-form-item label="达人分成%"><el-input v-model.number="talentForm.talentShareRate" type="number" /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="talentForm.status" style="width:100%">
            <el-option label="合作中" value="active" />
            <el-option label="停用" value="inactive" />
            <el-option label="合作终止" value="cooperation_ended" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="talentDialog=false">取消</el-button>
        <el-button type="primary" @click="submitTalent">保存</el-button>
      </template>
    </el-dialog>

    <!-- 商单 新建 -->
    <el-dialog v-model="orderDialog" title="新建商单" width="560px">
      <el-form :model="orderForm" label-width="100px">
        <el-form-item label="广告主"><el-input v-model="orderForm.advertiser" /></el-form-item>
        <el-form-item label="达人ID"><el-input v-model.number="orderForm.talentId" type="number" /></el-form-item>
        <el-form-item label="商品ID"><el-input v-model.number="orderForm.productId" type="number" /></el-form-item>
        <el-form-item label="账号ID"><el-input v-model.number="orderForm.accountId" type="number" /></el-form-item>
        <el-form-item label="视频ID"><el-input v-model.number="orderForm.videoId" type="number" /></el-form-item>
        <el-form-item label="金额(元)"><el-input v-model.number="orderForm.amount" type="number" /></el-form-item>
        <el-form-item label="机构分成%"><el-input v-model.number="orderForm.agencyShareRate" type="number" /></el-form-item>
        <el-form-item label="达人分成%"><el-input v-model.number="orderForm.talentShareRate" type="number" /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="orderForm.status" style="width:100%">
            <el-option v-for="s in ORDER_STATUSES" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item label="合同号"><el-input v-model="orderForm.contractNo" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="orderDialog=false">取消</el-button>
        <el-button type="primary" @click="submitOrder">保存</el-button>
      </template>
    </el-dialog>

    <!-- 商单结算 -->
    <el-dialog v-model="settleDialog" title="商单结算" width="480px">
      <el-form :model="settleForm" label-width="100px">
        <el-alert :title="`商单 #${settleTargetId} 结算`" type="warning" :closable="false" show-icon style="margin-bottom:12px" />
        <el-form-item label="达人分成%"><el-input v-model.number="settleForm.talentShareRate" type="number" /></el-form-item>
        <el-form-item label="目标状态">
          <el-select v-model="settleForm.toStatus" style="width:100%">
            <el-option label="completed" value="completed" />
            <el-option label="settled" value="settled" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="settleDialog=false">取消</el-button>
        <el-button type="primary" @click="submitSettle">确认结算</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  listTalents,
  createTalent,
  updateTalent,
  deleteTalent,
  listBrandOrders,
  createBrandOrder,
  settleBrandOrder,
  getTalentSummary,
  type Talent,
  type BrandOrder,
  type TalentSummary,
  type TalentType,
  type TalentStatus,
  type BrandOrderStatus,
} from '@/api/talent'

const tab = ref<'overview' | 'talent' | 'order'>('overview')
const ORDER_STATUSES: BrandOrderStatus[] = [
  'pending', 'negotiating', 'signed', 'delivering', 'completed', 'settled', 'cancelled',
]

// 概览
const summary = ref<TalentSummary | null>(null)
const summaryLoading = ref(false)
async function loadSummary() {
  summaryLoading.value = true
  try {
    summary.value = await getTalentSummary()
  } catch { /* */ } finally { summaryLoading.value = false }
}

// 达人
const talents = ref<Talent[]>([])
const talentLoading = ref(false)
const talentPage = ref(1)
const talentPageSize = ref(10)
const talentTotal = ref(0)
async function loadTalents() {
  talentLoading.value = true
  try {
    const res = await listTalents({ page: talentPage.value, pageSize: talentPageSize.value })
    talents.value = res.list
    talentTotal.value = res.total
  } catch { /* */ } finally { talentLoading.value = false }
}
const talentDialog = ref(false)
const talentForm = ref<{ id?: number; name: string; type?: TalentType; contact?: string; talentAccountId?: number; digitalHumanId?: number; agencyShareRate?: number; talentShareRate?: number; status?: TalentStatus }>({
  id: undefined, name: '', type: 'external', contact: '', talentAccountId: undefined, digitalHumanId: undefined, agencyShareRate: undefined, talentShareRate: undefined, status: 'active',
})
function openCreateTalent() {
  talentForm.value = { id: undefined, name: '', type: 'external', contact: '', talentAccountId: undefined, digitalHumanId: undefined, agencyShareRate: undefined, talentShareRate: undefined, status: 'active' }
  talentDialog.value = true
}
function openEditTalent(row: Talent) {
  talentForm.value = { id: row.id, name: row.name, type: row.type, contact: row.contact, talentAccountId: row.talentAccountId, digitalHumanId: row.digitalHumanId, agencyShareRate: row.agencyShareRate, talentShareRate: row.talentShareRate, status: row.status }
  talentDialog.value = true
}
async function submitTalent() {
  if (!talentForm.value.name) { ElMessage.warning('请填写名称'); return }
  try {
    if (talentForm.value.id) {
      await updateTalent(talentForm.value.id, {
        name: talentForm.value.name, type: talentForm.value.type, contact: talentForm.value.contact,
        talentAccountId: talentForm.value.talentAccountId, digitalHumanId: talentForm.value.digitalHumanId,
        agencyShareRate: talentForm.value.agencyShareRate, talentShareRate: talentForm.value.talentShareRate, status: talentForm.value.status,
      })
      ElMessage.success('已更新')
    } else {
      await createTalent({
        name: talentForm.value.name, type: talentForm.value.type, contact: talentForm.value.contact,
        talentAccountId: talentForm.value.talentAccountId, digitalHumanId: talentForm.value.digitalHumanId,
        agencyShareRate: talentForm.value.agencyShareRate, talentShareRate: talentForm.value.talentShareRate, status: talentForm.value.status,
      })
      ElMessage.success('已创建')
    }
    talentDialog.value = false
    loadTalents()
  } catch { /* */ }
}
async function onDeleteTalent(row: Talent) {
  try { await ElMessageBox.confirm(`确认删除达人「${row.name}」？`, '删除确认', { type: 'warning' }) } catch { return }
  try { await deleteTalent(row.id); ElMessage.success('已删除'); loadTalents() } catch { /* */ }
}

// 商单
const orders = ref<BrandOrder[]>([])
const orderLoading = ref(false)
const orderPage = ref(1)
const orderPageSize = ref(10)
const orderTotal = ref(0)
async function loadOrders() {
  orderLoading.value = true
  try {
    const res = await listBrandOrders({ page: orderPage.value, pageSize: orderPageSize.value })
    orders.value = res.list
    orderTotal.value = res.total
  } catch { /* */ } finally { orderLoading.value = false }
}
const orderDialog = ref(false)
const orderForm = ref<{ advertiser: string; talentId?: number; productId?: number; accountId?: number; videoId?: number; amount?: number; agencyShareRate?: number; talentShareRate?: number; status?: BrandOrderStatus; contractNo?: string }>({
  advertiser: '', talentId: undefined, productId: undefined, accountId: undefined, videoId: undefined, amount: undefined, agencyShareRate: undefined, talentShareRate: undefined, status: 'pending', contractNo: '',
})
function openCreateOrder() {
  orderForm.value = { advertiser: '', talentId: undefined, productId: undefined, accountId: undefined, videoId: undefined, amount: undefined, agencyShareRate: undefined, talentShareRate: undefined, status: 'pending', contractNo: '' }
  orderDialog.value = true
}
async function submitOrder() {
  if (!orderForm.value.advertiser || !orderForm.value.talentId || orderForm.value.amount == null) {
    ElMessage.warning('请填写广告主、达人ID、金额'); return
  }
  try {
    await createBrandOrder({
      advertiser: orderForm.value.advertiser, talentId: orderForm.value.talentId!, productId: orderForm.value.productId,
      accountId: orderForm.value.accountId, videoId: orderForm.value.videoId, amount: orderForm.value.amount!,
      agencyShareRate: orderForm.value.agencyShareRate, talentShareRate: orderForm.value.talentShareRate,
      status: orderForm.value.status, contractNo: orderForm.value.contractNo,
    })
    ElMessage.success('已创建')
    orderDialog.value = false
    loadOrders(); loadSummary()
  } catch { /* */ }
}
const settleDialog = ref(false)
const settleTargetId = ref<number>()
const settleForm = ref<{ talentShareRate: number; toStatus: 'completed' | 'settled' }>({ talentShareRate: 50, toStatus: 'settled' })
function openSettle(row: BrandOrder) {
  settleTargetId.value = row.id
  settleForm.value = { talentShareRate: row.talentShareRate ?? 50, toStatus: 'settled' }
  settleDialog.value = true
}
async function submitSettle() {
  if (!settleTargetId.value) return
  try {
    await settleBrandOrder(settleTargetId.value, { talentShareRate: settleForm.value.talentShareRate, toStatus: settleForm.value.toStatus })
    ElMessage.success('已结算')
    settleDialog.value = false
    loadOrders(); loadSummary()
  } catch { /* */ }
}
async function onDeleteOrder(row: BrandOrder) {
  try { await ElMessageBox.confirm(`确认删除商单「${row.advertiser}」？`, '删除确认', { type: 'warning' }) } catch { return }
  try { await deleteTalent(row.id); ElMessage.success('已删除'); loadOrders(); loadSummary() } catch { /* */ }
}

function typeLabel(t?: TalentType) { return t === 'internal' ? '内部' : t === 'agency' ? '机构' : '外部' }
function statusLabel(s?: TalentStatus) { return s === 'active' ? '合作中' : s === 'cooperation_ended' ? '合作终止' : '停用' }
function orderStatusType(s: string): 'success' | 'info' | 'warning' | 'danger' | 'primary' {
  if (s === 'settled') return 'success'
  if (s === 'cancelled') return 'info'
  if (s === 'completed') return 'primary'
  if (s === 'pending') return 'info'
  return 'warning'
}

onMounted(() => { loadSummary(); loadTalents(); loadOrders() })
</script>

<style scoped>
/* 页面标题区 */
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-lg); }
.page-title { font-size: var(--text-2xl); font-weight: 700; color: var(--el-text-color-primary); margin: 0 0 4px 0; }
.page-subtitle { font-size: var(--text-base); color: var(--el-text-color-secondary); margin: 0; }
.header-actions { display: flex; gap: var(--space-sm); }

/* 表格分页 */
.table-pagination { display: flex; justify-content: flex-end; padding-top: var(--space-md); }
</style>
