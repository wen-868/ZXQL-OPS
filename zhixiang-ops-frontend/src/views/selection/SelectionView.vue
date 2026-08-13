<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  importSelection,
  querySelection,
  getHot,
  getBlueOcean,
  createList,
  getLists,
  getList,
  removeList,
  type SelectionProductView,
  type SelectionListView,
  type SelectionListDetail,
  type SelectionSource,
  type SelectionImportItem,
  type HotItem,
} from '@/api/selection'
import type { HumanDriver } from '@/api/analyze'
import { formatDateTime, formatAmount, formatCount } from '@/utils/format'
import { driverLabels, driverColors, driverOptions } from '@/views/analyze/analyzeMaps'
import {
  selectionSourceOptions,
  blueOceanHighScoreThreshold,
} from './selectionMaps'

// 人性色/标签安全取值（row.humanDriver 可能为 null）
function driverColor(d: HumanDriver | null | undefined): string {
  return d ? driverColors[d] : 'var(--el-text-color-secondary)'
}
function driverLabel(d: HumanDriver | null | undefined): string {
  return d ? driverLabels[d] : '-'
}

// ============ 1. 选品库 ============
const filter = reactive<{
  commissionRateMin?: number
  reputationMin?: number
  salesMin?: number
  category: string
  humanDriver: HumanDriver | '' | null
  keyword: string
}>({
  commissionRateMin: undefined,
  reputationMin: undefined,
  salesMin: undefined,
  category: '',
  humanDriver: '',
  keyword: '',
})
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const products = ref<SelectionProductView[]>([])
const productsLoading = ref(false)
const selectedRows = ref<SelectionProductView[]>([])

async function loadProducts() {
  productsLoading.value = true
  try {
    const res = await querySelection({
      commissionRateMin: filter.commissionRateMin,
      reputationMin: filter.reputationMin,
      salesMin: filter.salesMin,
      category: filter.category || undefined,
      humanDriver: filter.humanDriver || undefined,
      keyword: filter.keyword || undefined,
      page: page.value,
      pageSize: pageSize.value,
    })
    products.value = res.list
    total.value = res.total
  } catch {
    // 拦截器已提示
  } finally {
    productsLoading.value = false
  }
}

function onQuery() {
  page.value = 1
  loadProducts()
}

function onPageChange(p: number) {
  page.value = p
  loadProducts()
}

// 加入清单
const addListDialog = ref(false)
const addListName = ref('')
const addListSubmitting = ref(false)
const addListErr = ref('')

function openAddList() {
  if (!selectedRows.value.length) {
    ElMessage.warning('请先在选品库勾选商品')
    return
  }
  addListName.value = ''
  addListErr.value = ''
  addListDialog.value = true
}

async function confirmAddList() {
  if (!addListName.value.trim()) {
    addListErr.value = '清单名称必填'
    return
  }
  addListSubmitting.value = true
  try {
    await createList({
      name: addListName.value.trim(),
      items: selectedRows.value.map((r) => r.id),
    })
    ElMessage.success('已新建清单并加入选品')
    addListDialog.value = false
    loadLists()
  } catch {
    // 拦截器已提示
  } finally {
    addListSubmitting.value = false
  }
}

// ============ 2. 导入选品 ============
const importForm = reactive<{
  source: SelectionSource
  platform: string
}>({
  source: 'manual',
  platform: '',
})
const importItems = ref<SelectionImportItem[]>([
  { title: '', commissionRate: undefined, reputationScore: undefined, sales30d: undefined, price: undefined, category: '', humanDriver: null, platform: '' },
])
const importSubmitting = ref(false)
const importResult = ref<SelectionProductView[]>([])

function addImportRow() {
  importItems.value.push({
    title: '', commissionRate: undefined, reputationScore: undefined, sales30d: undefined, price: undefined, category: '', humanDriver: null, platform: '',
  })
}
function removeImportRow(i: number) {
  importItems.value.splice(i, 1)
}

async function onImport() {
  if (!importItems.value.length || importItems.value.some((it) => !it.title.trim())) {
    ElMessage.warning('每条选品标题必填')
    return
  }
  importSubmitting.value = true
  importResult.value = []
  try {
    const res = await importSelection({
      source: importForm.source,
      platform: importForm.platform || undefined,
      products: importItems.value.map((it) => ({
        ...it,
        title: it.title.trim(),
        humanDriver: it.humanDriver || undefined,
      })),
    })
    importResult.value = res
    ElMessage.success(`已导入 ${res.length} 条选品`)
    loadProducts()
  } catch {
    // 拦截器已提示（如 SELECTION_IMPORT_MODE_UNSUPPORTED）
  } finally {
    importSubmitting.value = false
  }
}

// ============ 3. 飙升榜 ============
const hotLoading = ref(false)
const surging = ref<HotItem[]>([])
const darkHorse = ref<HotItem[]>([])

async function loadHot() {
  hotLoading.value = true
  try {
    const res = await getHot()
    surging.value = res.surging
    darkHorse.value = res.darkHorse
  } catch {
    // 拦截器已提示
  } finally {
    hotLoading.value = false
  }
}

// ============ 4. 蓝海词 ============
const blueLoading = ref(false)
const blueOcean = ref<{ category: string; avgCommissionRate: number; avgSales30d: number; score: number }[]>([])

async function loadBlueOcean() {
  blueLoading.value = true
  try {
    blueOcean.value = await getBlueOcean()
  } catch {
    // 拦截器已提示
  } finally {
    blueLoading.value = false
  }
}

// ============ 5. 选品清单 ============
const lists = ref<SelectionListView[]>([])
const listsLoading = ref(false)
const detailMap = reactive<Record<number, SelectionListDetail | null>>({})

async function loadLists() {
  listsLoading.value = true
  try {
    lists.value = await getLists()
  } catch {
    // 拦截器已提示
  } finally {
    listsLoading.value = false
  }
}

async function toggleDetail(row: SelectionListView) {
  if (detailMap[row.id]) {
    detailMap[row.id] = null
    return
  }
  try {
    detailMap[row.id] = await getList(row.id)
  } catch {
    // 拦截器已提示
  }
}

async function onDeleteList(row: SelectionListView) {
  try {
    await ElMessageBox.confirm(`确认删除清单「${row.name}」？删除后不可恢复（软删）。`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  try {
    await removeList(row.id)
    ElMessage.success(`已删除清单 ${row.name}`)
    delete detailMap[row.id]
    loadLists()
  } catch {
    // 拦截器已提示
  }
}

// 新建清单（从当前选品库多选）
const newListDialog = ref(false)
const newListName = ref('')
const newListErr = ref('')
const newListSelected = ref<number[]>([])

function openNewList() {
  if (!products.value.length) {
    ElMessage.warning('选品库为空，无法新建清单')
    return
  }
  newListName.value = ''
  newListErr.value = ''
  newListSelected.value = []
  newListDialog.value = true
}

async function confirmNewList() {
  if (!newListName.value.trim()) {
    newListErr.value = '清单名称必填'
    return
  }
  try {
    await createList({ name: newListName.value.trim(), items: newListSelected.value })
    ElMessage.success('已新建清单')
    newListDialog.value = false
    loadLists()
  } catch {
    // 拦截器已提示
  }
}

onMounted(() => {
  loadProducts()
  loadHot()
  loadBlueOcean()
  loadLists()
})
</script>

<template>
  <div class="page-container" aria-label="T 选品中心">
    <!-- 页面标题区 -->
    <div class="page-header">
      <div>
        <h1 class="page-title">T·选品中心</h1>
        <p class="page-subtitle">选品库 / 榜单 / 蓝海词 / 清单，humanDriver 对齐 D 人性字典；关键写操作落审计</p>
      </div>
    </div>

    <el-tabs type="border-card" aria-label="选品中心功能分区">
      <!-- ===== 1. 选品库 ===== -->
      <el-tab-pane label="选品库">
        <template #label><span aria-label="选品库标签页">选品库</span></template>
        <div class="filter-bar" aria-label="选品库筛选栏">
          <el-input v-model.number="filter.commissionRateMin" type="number" placeholder="佣金≥%" style="width: 130px" aria-label="最低佣金率" />
          <el-input v-model.number="filter.reputationMin" type="number" placeholder="口碑≥" style="width: 120px" aria-label="最低口碑分" />
          <el-input v-model.number="filter.salesMin" type="number" placeholder="销量≥" style="width: 120px" aria-label="最低销量" />
          <el-input v-model="filter.category" placeholder="类目" style="width: 140px" aria-label="类目" @keyup.enter="onQuery" />
          <el-select v-model="filter.humanDriver" placeholder="人性" clearable style="width: 140px" aria-label="人性筛选">
            <el-option v-for="opt in driverOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
          <el-input v-model="filter.keyword" placeholder="关键词" style="width: 160px" aria-label="关键词" @keyup.enter="onQuery" />
          <el-button type="primary" @click="onQuery" aria-label="查询选品库">查询</el-button>
        </div>
        <el-table
          :data="products"
          border
          v-loading="productsLoading"
          aria-label="选品库列表"
          @selection-change="(rows: SelectionProductView[]) => (selectedRows = rows)"
        >
          <el-table-column type="selection" width="46" />
          <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
          <el-table-column label="佣金%" width="90">
            <template #default="{ row }">{{ row.commissionRate != null ? row.commissionRate + '%' : '-' }}</template>
          </el-table-column>
          <el-table-column label="口碑" width="80">
            <template #default="{ row }">{{ row.reputationScore != null ? row.reputationScore : '-' }}</template>
          </el-table-column>
          <el-table-column label="销量30d" width="100">
            <template #default="{ row }">{{ formatCount(row.sales30d) }}</template>
          </el-table-column>
          <el-table-column label="价格" width="100">
            <template #default="{ row }">{{ row.price != null ? formatAmount(row.price) : '-' }}</template>
          </el-table-column>
          <el-table-column prop="category" label="类目" width="120" />
          <el-table-column label="人性" width="100">
            <template #default="{ row }">
              <el-tag v-if="row.humanDriver" size="small" :style="{ color: driverColor(row.humanDriver), borderColor: driverColor(row.humanDriver) }">
                {{ driverLabel(row.humanDriver) }}
              </el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column prop="platform" label="平台" width="100" />
          <el-table-column label="采集时间" min-width="160">
            <template #default="{ row }">{{ formatDateTime(row.collectedAt) }}</template>
          </el-table-column>
        </el-table>
        <div class="pager">
          <el-pagination
            :current-page="page"
            :page-size="pageSize"
            :total="total"
            layout="total, prev, pager, next"
            @current-change="onPageChange"
            aria-label="选品库分页"
          />
        </div>
        <div class="tab-foot">
          <el-button type="primary" :disabled="!selectedRows.length" @click="openAddList" aria-label="加入清单">
            加入清单（已选 {{ selectedRows.length }}）
          </el-button>
        </div>
      </el-tab-pane>

      <!-- ===== 2. 导入选品 ===== -->
      <el-tab-pane label="导入选品">
        <template #label><span aria-label="导入选品标签页">导入选品</span></template>
        <el-alert type="warning" :closable="false" show-icon class="hint-alert"
          title="standalone 模式直接填写下方 products；connected 对接模式可传 ids 经平台 API 批量拉取（当前独立模式不支持）。" />
        <el-form :model="importForm" label-width="80px" class="import-form">
          <el-form-item label="来源" required>
            <el-select v-model="importForm.source" :options="selectionSourceOptions as any" placeholder="选择来源" style="width: 240px" aria-label="选品来源">
              <el-option v-for="opt in selectionSourceOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="平台">
            <el-input v-model="importForm.platform" placeholder="如 douyin / xhs" style="width: 240px" aria-label="平台" />
          </el-form-item>
        </el-form>
        <el-table :data="importItems" border aria-label="导入选品行">
          <el-table-column label="标题*" min-width="180">
            <template #default="{ row }">
              <el-input v-model="row.title" placeholder="必填" :aria-label="`第${importItems.indexOf(row) + 1}行标题`" />
            </template>
          </el-table-column>
          <el-table-column label="佣金%" width="100">
            <template #default="{ row }"><el-input v-model.number="row.commissionRate" type="number" :aria-label="`第${importItems.indexOf(row) + 1}行佣金`" /></template>
          </el-table-column>
          <el-table-column label="口碑" width="90">
            <template #default="{ row }"><el-input v-model.number="row.reputationScore" type="number" :aria-label="`第${importItems.indexOf(row) + 1}行口碑`" /></template>
          </el-table-column>
          <el-table-column label="销量30d" width="100">
            <template #default="{ row }"><el-input v-model.number="row.sales30d" type="number" :aria-label="`第${importItems.indexOf(row) + 1}行销量`" /></template>
          </el-table-column>
          <el-table-column label="价格" width="100">
            <template #default="{ row }"><el-input v-model.number="row.price" type="number" :aria-label="`第${importItems.indexOf(row) + 1}行价格`" /></template>
          </el-table-column>
          <el-table-column label="类目" width="120">
            <template #default="{ row }"><el-input v-model="row.category" :aria-label="`第${importItems.indexOf(row) + 1}行类目`" /></template>
          </el-table-column>
          <el-table-column label="人性" width="130">
            <template #default="{ row }">
              <el-select v-model="row.humanDriver" placeholder="选人性" clearable style="width: 110px" :aria-label="`第${importItems.indexOf(row) + 1}行人性`">
                <el-option v-for="opt in driverOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80">
            <template #default="{ row }">
              <el-button type="danger" link :disabled="importItems.length <= 1" @click="removeImportRow(importItems.indexOf(row))" :aria-label="`删除第${importItems.indexOf(row) + 1}行`">删</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="tab-foot">
          <el-button @click="addImportRow" aria-label="新增选品行">+ 新增行</el-button>
          <el-button type="primary" :loading="importSubmitting" @click="onImport" aria-label="导入选品">导入</el-button>
        </div>
        <el-empty v-if="!importResult.length" description="导入后将在此展示返回的选品" />
        <el-table v-else :data="importResult" border class="result-table" aria-label="导入结果">
          <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
          <el-table-column label="佣金%" width="90"><template #default="{ row }">{{ row.commissionRate }}%</template></el-table-column>
          <el-table-column prop="category" label="类目" width="120" />
          <el-table-column label="人性" width="100">
            <template #default="{ row }">
              <el-tag v-if="row.humanDriver" size="small" :style="{ color: driverColor(row.humanDriver) }">{{ driverLabel(row.humanDriver) }}</el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column prop="platform" label="平台" width="100" />
        </el-table>
      </el-tab-pane>

      <!-- ===== 3. 飙升榜 ===== -->
      <el-tab-pane label="飙升榜">
        <template #label><span aria-label="飙升榜标签页">飙升榜</span></template>
        <div v-loading="hotLoading" class="hot-wrap">
          <div class="hot-col">
            <h4 class="hot-title">飙升榜（销量 Top）</h4>
            <el-empty v-if="!surging.length" description="暂无飙升商品" />
            <el-card v-for="it in surging" :key="'s' + it.id" shadow="hover" class="hot-card">
              <div class="hot-row"><b>{{ it.title }}</b></div>
              <div class="hot-meta">
                <el-tag size="small" type="success">{{ it.commissionRate }}%</el-tag>
                <span class="hot-sp">口碑 {{ it.reputationScore ?? '-' }}</span>
                <span class="hot-sp">销量 {{ formatCount(it.sales30d) }}</span>
                <el-tag v-if="it.humanDriver" size="small" :style="{ color: driverColor(it.humanDriver) }">{{ driverLabel(it.humanDriver) }}</el-tag>
              </div>
            </el-card>
          </div>
          <div class="hot-col">
            <h4 class="hot-title">黑马预警（口碑≥4.6 且销量低）</h4>
            <el-empty v-if="!darkHorse.length" description="暂无黑马商品" />
            <el-card v-for="it in darkHorse" :key="'d' + it.id" shadow="hover" class="hot-card">
              <div class="hot-row"><b>{{ it.title }}</b></div>
              <div class="hot-meta">
                <el-tag size="small" type="warning">{{ it.commissionRate }}%</el-tag>
                <span class="hot-sp">口碑 {{ it.reputationScore ?? '-' }}</span>
                <span class="hot-sp">销量 {{ formatCount(it.sales30d) }}</span>
                <el-tag v-if="it.humanDriver" size="small" :style="{ color: driverColor(it.humanDriver) }">{{ driverLabel(it.humanDriver) }}</el-tag>
              </div>
            </el-card>
          </div>
        </div>
      </el-tab-pane>

      <!-- ===== 4. 蓝海词 ===== -->
      <el-tab-pane label="蓝海词">
        <template #label><span aria-label="蓝海词标签页">蓝海词</span></template>
        <el-table :data="blueOcean" border v-loading="blueLoading" aria-label="蓝海词列表">
          <el-table-column prop="category" label="类目" min-width="160" />
          <el-table-column label="平均佣金%" width="120">
            <template #default="{ row }">{{ row.avgCommissionRate }}%</template>
          </el-table-column>
          <el-table-column label="平均销量30d" width="130">
            <template #default="{ row }">{{ formatCount(row.avgSales30d) }}</template>
          </el-table-column>
          <el-table-column label="潜力分" width="160">
            <template #default="{ row }">
              <el-tag v-if="row.score >= blueOceanHighScoreThreshold" type="success" size="small">高潜力 {{ row.score }}</el-tag>
              <span v-else>{{ row.score }}</span>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!blueLoading && !blueOcean.length" description="暂无蓝海词（需先导入选品）" />
      </el-tab-pane>

      <!-- ===== 5. 选品清单 ===== -->
      <el-tab-pane label="选品清单">
        <template #label><span aria-label="选品清单标签页">选品清单</span></template>
        <div class="tab-head">
          <el-button type="primary" @click="openNewList" aria-label="新建清单">新建清单</el-button>
          <el-button @click="loadLists" :loading="listsLoading" aria-label="刷新清单">刷新</el-button>
        </div>
        <el-empty v-if="!listsLoading && !lists.length" description="暂无选品清单" />
        <el-table :data="lists" border v-loading="listsLoading" aria-label="选品清单列表">
          <el-table-column type="expand">
            <template #default="{ row }">
              <div v-if="detailMap[row.id] === undefined" class="detail-loading">加载中…</div>
              <div v-else-if="detailMap[row.id] === null" class="detail-empty">-</div>
              <div v-else>
                <el-table :data="detailMap[row.id]!.products" border size="small" aria-label="清单商品子表">
                  <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
                  <el-table-column label="佣金%" width="90"><template #default="{ r }">{{ r.commissionRate }}%</template></el-table-column>
                  <el-table-column label="口碑" width="80"><template #default="{ r }">{{ r.reputationScore ?? '-' }}</template></el-table-column>
                  <el-table-column label="销量30d" width="100"><template #default="{ r }">{{ formatCount(r.sales30d) }}</template></el-table-column>
                  <el-table-column prop="category" label="类目" width="120" />
                  <el-table-column label="人性" width="100">
                    <template #default="{ r }">
                      <el-tag v-if="r.humanDriver" size="small" :style="{ color: driverColor(r.humanDriver) }">{{ driverLabel(r.humanDriver) }}</el-tag>
                      <span v-else>-</span>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="name" label="清单名" min-width="180" />
          <el-table-column label="商品数" width="90">
            <template #default="{ row }">{{ row.itemCount }}</template>
          </el-table-column>
          <el-table-column label="创建时间" min-width="170">
            <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" min-width="160">
            <template #default="{ row }">
              <el-button link type="primary" @click="toggleDetail(row)" :aria-label="`详情 ${row.name}`">详情</el-button>
              <el-button link type="danger" @click="onDeleteList(row)" :aria-label="`删除 ${row.name}`">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <!-- 加入清单弹窗 -->
    <el-dialog v-model="addListDialog" title="加入清单" aria-label="加入清单弹窗">
      <el-form label-width="80px">
        <el-form-item label="清单名" required>
          <el-input v-model="addListName" placeholder="输入清单名称" aria-label="清单名称" />
        </el-form-item>
        <el-form-item label="已选商品">
          <span>{{ selectedRows.length }} 个选品</span>
        </el-form-item>
        <el-alert v-if="addListErr" type="error" :closable="false" :title="addListErr" />
      </el-form>
      <template #footer>
        <el-button @click="addListDialog = false">取消</el-button>
        <el-button type="primary" :loading="addListSubmitting" @click="confirmAddList">确定</el-button>
      </template>
    </el-dialog>

    <!-- 新建清单弹窗（从选品库多选） -->
    <el-dialog v-model="newListDialog" title="新建清单" aria-label="新建清单弹窗">
      <el-form label-width="80px">
        <el-form-item label="清单名" required>
          <el-input v-model="newListName" placeholder="输入清单名称" aria-label="清单名称" />
        </el-form-item>
        <el-form-item label="选品">
          <el-select v-model="newListSelected" multiple filterable placeholder="选择选品库商品" style="width: 100%" aria-label="选择选品">
            <el-option v-for="p in products" :key="p.id" :label="p.title" :value="p.id" />
          </el-select>
        </el-form-item>
        <el-alert v-if="newListErr" type="error" :closable="false" :title="newListErr" />
      </el-form>
      <template #footer>
        <el-button @click="newListDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmNewList">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
/* 页面标题区 */
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-lg); }
.page-title { font-size: var(--text-2xl); font-weight: 700; color: var(--el-text-color-primary); margin: 0 0 4px 0; }
.page-subtitle { font-size: var(--text-base); color: var(--el-text-color-secondary); margin: 0; }

/* 标签页通用 */
.hint-alert { margin-bottom: var(--space-md); }
.filter-bar {
  display: flex; gap: 10px; flex-wrap: wrap;
  margin-bottom: var(--space-md);
}
.tab-foot { margin-top: var(--space-md); }
.tab-head { margin-bottom: var(--space-md); display: flex; gap: var(--space-md); }

/* 分页 */
.pager { margin-top: var(--space-md); display: flex; justify-content: flex-end; }

/* 导入 */
.import-form { max-width: 560px; margin-bottom: var(--space-md); }
.result-table { margin-top: var(--space-md); }

/* 飙升榜 */
.hot-wrap { display: flex; gap: var(--space-lg); }
.hot-col { flex: 1; min-width: 0; }
.hot-title { margin: 0 0 var(--space-md); font-size: var(--text-base); color: var(--el-text-color-primary); }
.hot-card { margin-bottom: 10px; }
.hot-row { margin-bottom: 6px; }
.hot-meta {
  display: flex; align-items: center; gap: var(--space-sm); flex-wrap: wrap;
  font-size: var(--text-sm); color: var(--el-text-color-secondary);
}
.hot-sp { white-space: nowrap; }

/* 详情 */
.detail-loading, .detail-empty {
  padding: var(--space-md); color: var(--el-text-color-placeholder); font-size: var(--text-base-sm);
}
</style>
