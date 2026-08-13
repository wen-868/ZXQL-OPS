<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  syncOrders,
  listOrders,
  refundOrder,
  getTrack,
  createWaybill,
  batchWaybill,
  syncInventory,
  inventoryWarn,
  type OrderView,
  type OrderStatus,
  type LogisticsTrackNode,
  type InventoryWarnItem,
} from '@/api/orders'
import { formatDateTime, formatAmount } from '@/utils/format'

const activeTab = ref<'orders' | 'inventory'>('orders')

const statusMeta: Record<OrderStatus, { label: string; color: string }> = {
  pending_payment: { label: '待付款', color: 'var(--app-warning-500)' },
  paid: { label: '已付款', color: 'var(--app-brand-500)' },
  shipped: { label: '已发货', color: 'var(--app-cat-ink)' },
  completed: { label: '已完成', color: 'var(--app-success-500)' },
  refunded: { label: '已退款', color: 'var(--app-danger-500)' },
}
const logisticsMeta: Record<string, { label: string; color: string }> = {
  pending: { label: '待发货', color: 'var(--app-cat-ink)' },
  shipped: { label: '已揽收', color: 'var(--app-brand-500)' },
  in_transit: { label: '运输中', color: 'var(--app-warning-500)' },
  delivered: { label: '已签收', color: 'var(--app-success-500)' },
  exception: { label: '异常', color: 'var(--app-danger-500)' },
}

// ============ Tab 1. 订单列表 ============
const orders = ref<OrderView[]>([])
const ordersLoading = ref(false)
const statusFilter = ref<OrderStatus | ''>('')
const platformFilter = ref('')
const batchIds = ref<number[]>([])

async function loadOrders() {
  ordersLoading.value = true
  try {
    orders.value = await listOrders({
      status: statusFilter.value || undefined,
      platform: platformFilter.value || undefined,
    })
  } catch {
    orders.value = []
  } finally {
    ordersLoading.value = false
  }
}

const syncDialog = ref(false)
const syncSubmitting = ref(false)
const syncForm = reactive({ source: '' as '' | 'management' | 'platform', ordersText: '' })
function openSync() {
  syncForm.source = ''
  syncForm.ordersText = ''
  syncDialog.value = true
}
async function confirmSync() {
  let parsed: unknown
  try {
    parsed = JSON.parse(syncForm.ordersText.trim())
  } catch {
    return ElMessage.error('订单数据不是合法 JSON 数组')
  }
  if (!Array.isArray(parsed)) return ElMessage.error('订单数据须为数组')
  syncSubmitting.value = true
  try {
    const res = await syncOrders({ source: syncForm.source || undefined, orders: parsed as never })
    ElMessage.success(`同步完成：总 ${res.total} / 新增 ${res.created} / 更新 ${res.updated}`)
    syncDialog.value = false
    await loadOrders()
  } catch {
    // 拦截器已提示
  } finally {
    syncSubmitting.value = false
  }
}

async function refund(row: OrderView) {
  try {
    await refundOrder(row.id)
    ElMessage.success('已退款（库存回写）')
    await loadOrders()
  } catch {
    // 拦截器已提示
  }
}

async function makeWaybill(row: OrderView) {
  try {
    await createWaybill(row.id)
    ElMessage.success('电子面单已生成')
    await loadOrders()
  } catch {
    // 拦截器已提示
  }
}

async function makeBatchWaybill() {
  if (!batchIds.value.length) return ElMessage.warning('请先勾选订单')
  try {
    const res = await batchWaybill(batchIds.value)
    ElMessage.success(`已批量生成 ${res.count} 张面单`)
  } catch {
    // 拦截器已提示
  }
}

const trackDialog = ref(false)
const trackLoading = ref(false)
const trackNodes = ref<LogisticsTrackNode[]>([])
const trackTitle = ref('')
async function viewTrack(row: OrderView) {
  trackTitle.value = `订单 #${row.id}（${row.orderId}）物流轨迹`
  trackDialog.value = true
  trackLoading.value = true
  try {
    trackNodes.value = await getTrack(row.id)
  } catch {
    trackNodes.value = []
  } finally {
    trackLoading.value = false
  }
}

// ============ Tab 2. 库存预警 ============
const warns = ref<InventoryWarnItem[]>([])
const warnLoading = ref(false)
const warnThreshold = ref(10)
async function loadWarn() {
  warnLoading.value = true
  try {
    warns.value = await inventoryWarn(warnThreshold.value)
  } catch {
    warns.value = []
  } finally {
    warnLoading.value = false
  }
}

const invDialog = ref(false)
const invSubmitting = ref(false)
const invForm = reactive({ productId: 0, delta: 0, reason: '' })
function openInv() {
  invForm.productId = 0
  invForm.delta = 0
  invForm.reason = ''
  invDialog.value = true
}
async function confirmInv() {
  if (!invForm.productId) return ElMessage.warning('商品ID必填')
  invSubmitting.value = true
  try {
    const res = await syncInventory({
      productId: invForm.productId,
      delta: invForm.delta,
      reason: invForm.reason.trim() || undefined,
    })
    ElMessage.success(`库存回写成功，当前库存 ${res.stock}`)
    invDialog.value = false
    await loadWarn()
  } catch {
    // 拦截器已提示
  } finally {
    invSubmitting.value = false
  }
}

onMounted(() => {
  loadOrders()
})
</script>

<template>
  <section class="orders-view" aria-label="Y 订单物流中心">
    <el-alert
      type="info"
      :closable="false"
      show-icon
      class="compliance-alert"
      title="Y 订单物流中心：双源订单同步 / 退款回写库存 / 物流轨迹 / 电子面单 / 库存预警回传；tenantId 由统一拦截器注入。"
    />
    <el-tabs v-model="activeTab" type="border-card" aria-label="Y 功能分区">
      <!-- ===== 1. 订单列表 ===== -->
      <el-tab-pane name="orders">
        <template #label><span aria-label="订单列表标签页">订单列表</span></template>
        <div class="filter-bar" aria-label="订单操作栏">
          <el-select v-model="statusFilter" placeholder="订单状态" clearable style="width: 150px" aria-label="订单状态筛选" @change="loadOrders">
            <el-option label="全部状态" value="" />
            <el-option v-for="(m, k) in statusMeta" :key="k" :label="m.label" :value="k" />
          </el-select>
          <el-input v-model="platformFilter" placeholder="平台（可选）" clearable style="width: 150px" aria-label="平台筛选" @keyup.enter="loadOrders" />
          <el-button type="primary" @click="openSync" aria-label="同步订单">同步订单</el-button>
          <el-button @click="makeBatchWaybill" aria-label="批量生成面单">批量面单</el-button>
          <el-button @click="loadOrders" aria-label="刷新订单">刷新</el-button>
        </div>
        <el-table :data="orders" border v-loading="ordersLoading" aria-label="订单列表" @selection-change="(rows: OrderView[]) => (batchIds = rows.map((r) => r.id))">
          <el-table-column type="selection" width="46" />
          <el-table-column prop="id" label="ID" width="70" />
          <el-table-column prop="orderId" label="订单号" min-width="150" show-overflow-tooltip />
          <el-table-column prop="platform" label="平台" width="110" />
          <el-table-column prop="source" label="来源" width="100" />
          <el-table-column prop="productId" label="商品ID" width="90" />
          <el-table-column prop="quantity" label="数量" width="80" />
          <el-table-column label="金额" min-width="110">
            <template #default="{ row }">{{ formatAmount((row as OrderView).amount) }}</template>
          </el-table-column>
          <el-table-column label="佣金" min-width="100">
            <template #default="{ row }">{{ formatAmount((row as OrderView).commission) }}</template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag size="small" :style="{ color: statusMeta[(row as OrderView).status].color, borderColor: statusMeta[(row as OrderView).status].color }">{{ statusMeta[(row as OrderView).status].label }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="物流" width="100">
            <template #default="{ row }">
              <el-tag size="small" :style="{ color: (logisticsMeta[(row as OrderView).logisticsStatus] || { color: 'var(--app-cat-ink)' }).color }">{{ (logisticsMeta[(row as OrderView).logisticsStatus] || { label: (row as OrderView).logisticsStatus }).label }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="买家" min-width="120" show-overflow-tooltip>
            <template #default="{ row }">{{ (row as OrderView).buyer?.name || '-' }}</template>
          </el-table-column>
          <el-table-column label="操作" width="220" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="viewTrack(row as OrderView)" :aria-label="`查看物流 ${(row as OrderView).id}`">物流</el-button>
              <el-button link type="success" @click="makeWaybill(row as OrderView)" :aria-label="`生成面单 ${(row as OrderView).id}`">面单</el-button>
              <el-button link type="danger" @click="refund(row as OrderView)" :aria-label="`退款 ${(row as OrderView).id}`">退款</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!ordersLoading && !orders.length" description="暂无订单，点击「同步订单」导入或调整筛选" />
      </el-tab-pane>

      <!-- ===== 2. 库存预警 ===== -->
      <el-tab-pane name="inventory">
        <template #label><span aria-label="库存预警标签页">库存预警</span></template>
        <div class="filter-bar" aria-label="库存操作栏">
          <el-input v-model.number="warnThreshold" type="number" placeholder="阈值" style="width: 130px" aria-label="库存阈值" />
          <el-button type="primary" @click="loadWarn" :loading="warnLoading" aria-label="查询库存预警">查询预警</el-button>
          <el-button @click="openInv" aria-label="库存回传">库存回传</el-button>
        </div>
        <el-table :data="warns" border v-loading="warnLoading" aria-label="库存预警列表">
          <el-table-column prop="id" label="商品ID" width="100" />
          <el-table-column prop="title" label="商品" min-width="200" show-overflow-tooltip />
          <el-table-column prop="stock" label="当前库存" width="120" />
        </el-table>
        <el-empty v-if="!warnLoading && !warns.length" description="暂无低于阈值的库存预警" />
      </el-tab-pane>
    </el-tabs>

    <!-- 同步订单弹窗 -->
    <el-dialog v-model="syncDialog" title="同步订单（双源 + 幂等）" aria-label="同步订单弹窗" width="640px">
      <el-form label-width="100px" @submit.prevent>
        <el-form-item label="来源">
          <el-select v-model="syncForm.source" clearable placeholder="可选（缺省由平台推断）" style="width: 100%" aria-label="同步来源">
            <el-option label="管理系统 management" value="management" />
            <el-option label="电商平台 platform" value="platform" />
          </el-select>
        </el-form-item>
        <el-form-item label="订单 JSON" required>
          <el-input
            v-model="syncForm.ordersText"
            type="textarea"
            :rows="10"
            placeholder='JSON 数组，如 [{"orderId":"P123","platform":"douyin","amount":99,"quantity":1,"status":"paid"}]'
            aria-label="订单JSON"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="syncDialog = false">取消</el-button>
        <el-button type="primary" :loading="syncSubmitting" @click="confirmSync">确定同步</el-button>
      </template>
    </el-dialog>

    <!-- 物流轨迹弹窗 -->
    <el-dialog v-model="trackDialog" :title="trackTitle" aria-label="物流轨迹弹窗" width="560px">
      <el-timeline v-loading="trackLoading">
        <el-timeline-item
          v-for="(n, i) in trackNodes"
          :key="i"
          :timestamp="n.ts ? formatDateTime(n.ts) : '—'"
          placement="top"
        >
          <div><b>{{ n.node }}</b></div>
          <div v-if="n.carrier" class="track-loc">承运 {{ n.carrier }} / 单号 {{ n.trackingNo }}</div>
        </el-timeline-item>
      </el-timeline>
      <el-empty v-if="!trackLoading && !trackNodes.length" description="暂无物流轨迹" />
    </el-dialog>

    <!-- 库存回传弹窗 -->
    <el-dialog v-model="invDialog" title="库存回传" aria-label="库存回传弹窗" width="520px">
      <el-form label-width="100px" @submit.prevent>
        <el-form-item label="商品ID" required>
          <el-input v-model.number="invForm.productId" type="number" aria-label="商品ID" />
        </el-form-item>
        <el-form-item label="变动(delta)" required>
          <el-input v-model.number="invForm.delta" type="number" placeholder="正=入库/回写，负=扣减" aria-label="库存变动" />
        </el-form-item>
        <el-form-item label="原因">
          <el-input v-model="invForm.reason" aria-label="库存变动原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="invDialog = false">取消</el-button>
        <el-button type="primary" :loading="invSubmitting" @click="confirmInv">确定回传</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.orders-view {
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
.track-loc {
  font-size: var(--text-sm);
  color: var(--el-text-color-secondary);
}
</style>
