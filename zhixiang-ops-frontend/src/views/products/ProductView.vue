<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  ingestProduct,
  listProducts,
  generateContent,
  getContent,
  updateStock,
  type ProductView,
  type ProductContentView,
  type CreateProductPayload,
  type GenerateContentPayload,
  type UpdateStockPayload,
} from '@/api/products'
import type { HumanDriver } from '@/api/analyze'
import { formatDateTime, formatAmount } from '@/utils/format'
import { driverLabels, driverColors, driverOptions } from '@/views/analyze/analyzeMaps'
import {
  sourceTypeMeta,
  sourceTypeOptions,
  platformOptions,

} from './productMaps'

// 人性色/标签安全取值（row.humanDriver 可能为 null）
function driverColor(d: HumanDriver | null | undefined): string {
  return d ? driverColors[d] : 'var(--app-neutral-400)'
}
function driverLabel(d: HumanDriver | null | undefined): string {
  return d ? driverLabels[d] : '-'
}
// 来源色/标签安全取值
function sourceMeta(s: ProductView['sourceType']) {
  return sourceTypeMeta[s]
}

// 当前激活 Tab（商品库 / 商品内容）
const activeTab = ref<'lib' | 'content'>('lib')

// ============ Tab 1. 商品库 ============
const categoryFilter = ref('')
const products = ref<ProductView[]>([])
const productsLoading = ref(false)

async function loadProducts() {
  productsLoading.value = true
  try {
    products.value = await listProducts(categoryFilter.value || undefined)
  } catch {
    // 拦截器已提示
  } finally {
    productsLoading.value = false
  }
}

function onCategoryChange() {
  loadProducts()
}

// 录入商品弹窗
const ingestDialog = ref(false)
const ingestSubmitting = ref(false)
const ingestForm = reactive<CreateProductPayload & { selectionProductId?: number }>({
  sourceType: 'manual',
  externalProductId: undefined,
  selectionProductId: undefined,
  title: undefined,
  stock: undefined,
  price: undefined,
  category: undefined,
  humanDriver: undefined,
})

function openIngest() {
  ingestForm.sourceType = 'manual'
  ingestForm.externalProductId = undefined
  ingestForm.selectionProductId = undefined
  ingestForm.title = undefined
  ingestForm.stock = undefined
  ingestForm.price = undefined
  ingestForm.category = undefined
  ingestForm.humanDriver = undefined
  ingestDialog.value = true
}

async function confirmIngest() {
  if (!ingestForm.sourceType) {
    ElMessage.warning('来源类型必填')
    return
  }
  ingestSubmitting.value = true
  try {
    const payload: CreateProductPayload = {
      sourceType: ingestForm.sourceType,
      externalProductId: ingestForm.externalProductId || undefined,
      selectionProductId: ingestForm.selectionProductId || undefined,
      title: ingestForm.title || undefined,
      stock: ingestForm.stock,
      price: ingestForm.price,
      category: ingestForm.category || undefined,
      humanDriver: ingestForm.humanDriver || undefined,
    }
    await ingestProduct(payload)
    ElMessage.success('商品已录入')
    ingestDialog.value = false
    loadProducts()
  } catch {
    // 拦截器已提示
  } finally {
    ingestSubmitting.value = false
  }
}

// 调整库存弹窗
const stockDialog = ref(false)
const stockSubmitting = ref(false)
const stockTarget = ref<ProductView | null>(null)
const stockForm = reactive<UpdateStockPayload>({
  delta: undefined as unknown as number,
  reason: undefined,
})

function openStock(row: ProductView) {
  stockTarget.value = row
  stockForm.delta = undefined as unknown as number
  stockForm.reason = undefined
  stockDialog.value = true
}

async function confirmStock() {
  if (!stockTarget.value) return
  if (stockForm.delta == null || Number.isNaN(stockForm.delta)) {
    ElMessage.warning('库存变动 delta 必填')
    return
  }
  stockSubmitting.value = true
  try {
    await updateStock(stockTarget.value.id, {
      delta: stockForm.delta,
      reason: stockForm.reason || undefined,
    })
    ElMessage.success('库存已调整')
    stockDialog.value = false
    loadProducts()
  } catch {
    // 拦截器已提示
  } finally {
    stockSubmitting.value = false
  }
}

// 行操作：切到内容 Tab
function viewContent(row: ProductView) {
  selectedProductId.value = row.id
  activeTab.value = 'content'
  loadContent()
}
function openGenerate(row: ProductView) {
  selectedProductId.value = row.id
  activeTab.value = 'content'
  openGenerateDialog(row)
}

// ============ Tab 2. 商品内容 ============
const selectedProductId = ref<number | undefined>(undefined)
const content = ref<ProductContentView | null>(null)
const contentLoading = ref(false)

async function loadContent() {
  if (!selectedProductId.value) {
    content.value = null
    return
  }
  contentLoading.value = true
  try {
    content.value = await getContent(selectedProductId.value)
  } catch {
    // 拦截器已提示（如 404 无内容）
    content.value = null
  } finally {
    contentLoading.value = false
  }
}

// AI 生成内容弹窗
const genDialog = ref(false)
const genSubmitting = ref(false)
const genForm = reactive<GenerateContentPayload & { _open: boolean }>({
  humanDriver: undefined,
  platform: undefined,
  _open: false,
})

function openGenerateDialog(row?: ProductView) {
  // humanDriver 默认沿用商品
  genForm.humanDriver = row?.humanDriver || content.value?.humanDriver || undefined
  genForm.platform = undefined
  genForm._open = true
  genDialog.value = true
}

async function confirmGenerate() {
  if (!selectedProductId.value) {
    ElMessage.warning('请先选择商品')
    return
  }
  genSubmitting.value = true
  try {
    await generateContent(selectedProductId.value, {
      humanDriver: genForm.humanDriver || undefined,
      platform: genForm.platform || undefined,
    })
    ElMessage.success('内容已生成')
    genDialog.value = false
    loadContent()
  } catch {
    // 拦截器已提示
  } finally {
    genSubmitting.value = false
  }
}

onMounted(() => {
  loadProducts()
})
</script>

<template>
  <section class="product-view" aria-label="R 商品内容中心">
    <!-- 页面标题区 -->
    <div class="page-header">
      <div>
        <h1 class="page-title">商品内容中心</h1>
        <p class="page-subtitle">商品库录入 / AI 内容生成 / 合规校验 / 详情页</p>
      </div>
      <el-button type="primary" @click="openIngest" aria-label="录入商品">录入商品</el-button>
    </div>

    <!-- 筛选区 -->
    <el-card shadow="never" class="filter-card">
      <el-form inline @submit.prevent>
        <el-form-item label="类目">
          <el-select
            v-model="categoryFilter"
            placeholder="全部类目"
            clearable
            filterable
            allow-create
            style="width: 200px"
            aria-label="类目筛选"
            @change="onCategoryChange"
          >
            <el-option
              v-for="p in products.filter((x, i, a) => x.category && a.findIndex((y) => y.category === x.category) === i)"
              :key="p.category"
              :label="p.category"
              :value="p.category"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <div class="filter-actions">
            <el-button type="primary" @click="loadProducts" :loading="productsLoading">查询</el-button>
            <el-button @click="categoryFilter = ''; loadProducts()">重置</el-button>
          </div>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 表格区 -->
    <el-card shadow="never">
      <el-table
        :data="products"
        stripe
        v-loading="productsLoading"
        aria-label="商品库列表"
      >
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
        <el-table-column label="来源" width="100">
          <template #default="{ row }">
            <el-tag
              size="small"
              :type="sourceMeta(row.sourceType).type"
              :style="{ color: sourceMeta(row.sourceType).color, borderColor: sourceMeta(row.sourceType).color }"
            >{{ sourceMeta(row.sourceType).label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="category" label="类目" width="120" />
        <el-table-column label="人性" width="100">
          <template #default="{ row }">
            <el-tag
              v-if="row.humanDriver"
              size="small"
              :style="{ color: driverColor(row.humanDriver), borderColor: driverColor(row.humanDriver) }"
            >{{ driverLabel(row.humanDriver) }}</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="价格" width="110">
          <template #default="{ row }">{{ row.price != null ? formatAmount(row.price) : '-' }}</template>
        </el-table-column>
        <el-table-column prop="stock" label="库存" width="90" />
        <el-table-column label="创建时间" min-width="170">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" min-width="240" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openGenerate(row)" :aria-label="`生成内容 ${row.title}`">生成内容</el-button>
            <el-button link type="warning" @click="openStock(row)" :aria-label="`调整库存 ${row.title}`">调整库存</el-button>
            <el-button link type="primary" @click="viewContent(row)" :aria-label="`查看内容 ${row.title}`">查看内容</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无商品，点击「录入商品」开始" />
        </template>
      </el-table>
      <div class="table-pagination">
        <!-- 分页占位，后续补充 -->
      </div>
    </el-card>

    <!-- 录入商品弹窗 -->
    <el-dialog v-model="ingestDialog" title="录入商品" aria-label="录入商品弹窗" width="520px">
      <el-form label-width="110px" @submit.prevent>
        <el-form-item label="来源类型" required>
          <el-select v-model="ingestForm.sourceType" placeholder="选择来源" style="width: 100%" aria-label="商品来源类型">
            <el-option v-for="opt in sourceTypeOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="外部商品ID">
          <el-input v-model="ingestForm.externalProductId" placeholder="如平台商品 ID（可选）" aria-label="外部商品ID" />
        </el-form-item>
        <el-form-item label="选品库ID">
          <el-input v-model.number="ingestForm.selectionProductId" type="number" placeholder="关联选品库商品 id（可选）" aria-label="选品库ID" />
        </el-form-item>
        <el-form-item label="标题">
          <el-input v-model="ingestForm.title" placeholder="商品标题（可选）" aria-label="商品标题" />
        </el-form-item>
        <el-form-item label="库存">
          <el-input v-model.number="ingestForm.stock" type="number" placeholder="库存数量（可选）" aria-label="商品库存" />
        </el-form-item>
        <el-form-item label="价格">
          <el-input v-model.number="ingestForm.price" type="number" placeholder="价格（可选）" aria-label="商品价格" />
        </el-form-item>
        <el-form-item label="类目">
          <el-input v-model="ingestForm.category" placeholder="类目（可选）" aria-label="商品类目" />
        </el-form-item>
        <el-form-item label="人性驱动">
          <el-select v-model="ingestForm.humanDriver" placeholder="选人性（可选）" clearable style="width: 100%" aria-label="商品人性驱动">
            <el-option v-for="opt in driverOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="ingestDialog = false">取消</el-button>
        <el-button type="primary" :loading="ingestSubmitting" @click="confirmIngest">确定录入</el-button>
      </template>
    </el-dialog>

    <!-- 调整库存弹窗 -->
    <el-dialog v-model="stockDialog" title="调整库存" aria-label="调整库存弹窗" width="460px">
      <el-form label-width="90px" @submit.prevent>
        <el-form-item label="商品">
          <span>{{ stockTarget ? `#${stockTarget.id} ${stockTarget.title}` : '-' }}</span>
        </el-form-item>
        <el-form-item label="变动 delta" required>
          <el-input v-model.number="stockForm.delta" type="number" placeholder="正加负减" aria-label="库存变动delta" />
        </el-form-item>
        <el-form-item label="原因">
          <el-input v-model="stockForm.reason" type="textarea" :rows="3" placeholder="调整原因（可选）" aria-label="库存调整原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="stockDialog = false">取消</el-button>
        <el-button type="primary" :loading="stockSubmitting" @click="confirmStock">确定调整</el-button>
      </template>
    </el-dialog>

    <!-- AI 生成内容弹窗 -->
    <el-dialog v-model="genDialog" title="AI 生成内容" aria-label="AI生成内容弹窗" width="460px">
      <el-form label-width="90px" @submit.prevent>
        <el-form-item label="人性驱动">
          <el-select v-model="genForm.humanDriver" placeholder="默认沿用商品" clearable style="width: 100%" aria-label="生成内容人性驱动">
            <el-option v-for="opt in driverOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="平台">
          <el-select v-model="genForm.platform" placeholder="选择平台（可选）" clearable style="width: 100%" aria-label="生成内容平台">
            <el-option v-for="opt in platformOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="genDialog = false">取消</el-button>
        <el-button type="primary" :loading="genSubmitting" @click="confirmGenerate">开始生成</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
/* 页面标题区 */
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-lg); }
.page-title { font-size: var(--text-2xl); font-weight: 700; color: var(--el-text-color-primary); margin: 0 0 4px 0; }
.page-subtitle { font-size: var(--text-base); color: var(--el-text-color-secondary); margin: 0; }

/* 筛选区 */
.filter-card { padding: var(--space-lg); margin-bottom: var(--space-md); }
.filter-card .el-form { margin-bottom: 12px; }
.filter-actions { display: flex; gap: var(--space-sm); }

/* 表格分页 */
.table-pagination { display: flex; justify-content: flex-end; padding-top: var(--space-md); }
</style>
