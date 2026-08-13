<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  createAdAccount,
  createCampaign,
  getMetrics,
  smartBid,
  review,
  reportMetric,
  type AdAccountView,
  type AdCampaignView,
  type AdMetricView,
  type AdReviewView,
  type AdPlatform,
  type AdAccountType,
  type AdPlanType,
} from '@/api/ad'
import { formatDateTime, formatAmount } from '@/utils/format'
import {
  adPlatformMeta,
  adPlatformOptions,
  adAccountTypeMeta,
  adAccountTypeOptions,
  adAccountStatusMeta,
  adAccountStatusOptions,
  adPlanTypeMeta,
  adPlanTypeOptions,
  adCampaignStatusMeta,
} from './adMaps'

// 注意：后端【无】accounts / campaigns 的列表(GET 列表)端点，也无 GET 单个 account/campaign 端点；
//       用本地数组维护本会话创建出来的账户/计划（create 后 push 进本地 ref 用于展示）。
//       可对单个计划调用 getMetrics / smartBid / review / reportMetric。

const activeTab = ref<'accounts' | 'campaigns'>('accounts')

// ============ Tab 1. 投放账户 ============
const accounts = ref<AdAccountView[]>([])
const accountsLoading = ref(false)

const accountDialog = ref(false)
const accountSubmitting = ref(false)
const accountForm = reactive<{
  platform: AdPlatform | undefined
  type: AdAccountType | undefined
  authEnc: string
  status: 'active' | 'expired' | 'banned'
}>({
  platform: undefined,
  type: undefined,
  authEnc: '',
  status: 'active',
})

function openCreateAccount() {
  accountForm.platform = undefined
  accountForm.type = undefined
  accountForm.authEnc = ''
  accountForm.status = 'active'
  accountDialog.value = true
}

async function confirmCreateAccount() {
  if (!accountForm.platform) {
    ElMessage.warning('平台必填')
    return
  }
  if (!accountForm.type) {
    ElMessage.warning('账户类型必填')
    return
  }
  accountSubmitting.value = true
  try {
    const acc = await createAdAccount({
      platform: accountForm.platform,
      type: accountForm.type,
      authEnc: accountForm.authEnc.trim() || undefined,
      status: accountForm.status,
    })
    accounts.value.push(acc)
    ElMessage.success('投放账户已创建')
    accountDialog.value = false
  } catch {
    // 拦截器已提示
  } finally {
    accountSubmitting.value = false
  }
}

// ============ Tab 2. 投放计划 ============
const campaigns = ref<AdCampaignView[]>([])
const campaignsLoading = ref(false)

const campaignDialog = ref(false)
const campaignSubmitting = ref(false)
const campaignForm = reactive<{
  accountId: number | undefined
  name: string
  planType: AdPlanType | undefined
  audience: string
  budget: number | undefined
}>({
  accountId: undefined,
  name: '',
  planType: undefined,
  audience: '',
  budget: undefined,
})

function openCreateCampaign() {
  if (!accounts.value.length) {
    ElMessage.warning('请先到「投放账户」创建至少一个账户')
    return
  }
  campaignForm.accountId = undefined
  campaignForm.name = ''
  campaignForm.planType = undefined
  campaignForm.audience = ''
  campaignForm.budget = undefined
  campaignDialog.value = true
}

async function confirmCreateCampaign() {
  if (campaignForm.accountId == null) {
    ElMessage.warning('账户必填')
    return
  }
  if (!campaignForm.name.trim()) {
    ElMessage.warning('计划名称必填')
    return
  }
  if (!campaignForm.planType) {
    ElMessage.warning('计划类型必填')
    return
  }
  // audience 文本域：填入后需为合法 JSON 对象
  let audience: Record<string, unknown> | undefined
  if (campaignForm.audience.trim()) {
    try {
      const parsed = JSON.parse(campaignForm.audience.trim())
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('audience 需为 JSON 对象')
      }
      audience = parsed as Record<string, unknown>
    } catch {
      ElMessage.error('audience 不是合法 JSON 对象，请检查格式')
      return
    }
  }
  campaignSubmitting.value = true
  try {
    const camp = await createCampaign({
      accountId: campaignForm.accountId,
      name: campaignForm.name.trim(),
      planType: campaignForm.planType,
      audience,
      budget: campaignForm.budget ?? undefined,
    })
    campaigns.value.push(camp)
    ElMessage.success('投放计划已创建')
    campaignDialog.value = false
  } catch {
    // 拦截器已提示
  } finally {
    campaignSubmitting.value = false
  }
}

// 实时监控弹窗
const metricDialog = ref(false)
const metricTarget = ref<AdCampaignView | null>(null)
const metricLoading = ref(false)
const metricData = ref<AdMetricView | null>(null)

function openMetric(row: AdCampaignView) {
  metricTarget.value = row
  metricData.value = null
  metricDialog.value = true
  refreshMetric(row)
}

async function refreshMetric(row: AdCampaignView) {
  metricLoading.value = true
  try {
    metricData.value = await getMetrics(row.id) // 可能为 null
  } catch {
    // 拦截器已提示
    metricData.value = null
  } finally {
    metricLoading.value = false
  }
}

// 智能出价弹窗
const bidDialog = ref(false)
const bidSubmitting = ref(false)
const bidTarget = ref<AdCampaignView | null>(null)
const bidForm = reactive<{ targetRoi: number | undefined; bidAdjust: number | undefined }>({
  targetRoi: undefined,
  bidAdjust: undefined,
})
const bidSuggestion = ref('')

function openBid(row: AdCampaignView) {
  bidTarget.value = row
  bidForm.targetRoi = undefined
  bidForm.bidAdjust = undefined
  bidSuggestion.value = ''
  bidDialog.value = true
}

async function confirmBid() {
  if (!bidTarget.value) return
  bidSubmitting.value = true
  try {
    const res = await smartBid(bidTarget.value.id, {
      campaignId: bidTarget.value.id, // 会被路径 id 覆盖/忽略
      targetRoi: bidForm.targetRoi ?? undefined,
      bidAdjust: bidForm.bidAdjust ?? undefined,
    })
    bidSuggestion.value = res.suggestion
    ElMessage.success('已生成出价建议')
  } catch {
    // 拦截器已提示
  } finally {
    bidSubmitting.value = false
  }
}

// 复盘弹窗
const reviewDialog = ref(false)
const reviewLoading = ref(false)
const reviewTarget = ref<AdCampaignView | null>(null)
const reviewData = ref<AdReviewView | null>(null)

function openReview(row: AdCampaignView) {
  reviewTarget.value = row
  reviewData.value = null
  reviewDialog.value = true
  refreshReview(row)
}

async function refreshReview(row: AdCampaignView) {
  reviewLoading.value = true
  try {
    reviewData.value = await review(row.id)
  } catch {
    // 拦截器已提示
    reviewData.value = null
  } finally {
    reviewLoading.value = false
  }
}

// 上报指标弹窗
const reportDialog = ref(false)
const reportSubmitting = ref(false)
const reportTarget = ref<AdCampaignView | null>(null)
const reportForm = reactive<{
  date: string
  impressions: number | undefined
  clicks: number | undefined
  conversions: number | undefined
  cost: number | undefined
  roi: number | undefined
}>({
  date: '',
  impressions: undefined,
  clicks: undefined,
  conversions: undefined,
  cost: undefined,
  roi: undefined,
})
const reportResult = ref<AdMetricView | null>(null)

function openReport(row: AdCampaignView) {
  reportTarget.value = row
  reportForm.date = ''
  reportForm.impressions = undefined
  reportForm.clicks = undefined
  reportForm.conversions = undefined
  reportForm.cost = undefined
  reportForm.roi = undefined
  reportResult.value = null
  reportDialog.value = true
}

async function confirmReport() {
  if (!reportTarget.value) return
  reportSubmitting.value = true
  try {
    const res = await reportMetric(reportTarget.value.id, {
      campaignId: reportTarget.value.id, // 会被路径 id 覆盖/忽略
      date: reportForm.date.trim() || undefined,
      impressions: reportForm.impressions ?? undefined,
      clicks: reportForm.clicks ?? undefined,
      conversions: reportForm.conversions ?? undefined,
      cost: reportForm.cost ?? undefined,
      roi: reportForm.roi ?? undefined,
    })
    reportResult.value = res
    ElMessage.success('指标已上报')
    // 备注：后端 reportMetric 会回写 campaign 的 spend/roi，但前端无 getCampaign 端点，
    //       故本地 campaigns 数组不自动刷新 spend/roi，此为后端契约限制，非前端遗漏。
  } catch {
    // 拦截器已提示
  } finally {
    reportSubmitting.value = false
  }
}
</script>

<template>
  <div class="page-container" aria-label="S 投流中心">
    <!-- 页面标题区 -->
    <div class="page-header">
      <div class="page-header-text">
        <h1 class="page-title">T·广告投放</h1>
        <p class="page-subtitle">投放账户与计划管理，实时监控、智能出价、复盘与指标上报</p>
      </div>
    </div>

    <!-- 合规提示 -->
    <el-alert
      type="info"
      :closable="false"
      show-icon
      class="compliance-alert"
      title="S 投流中心：投放账户 / 计划管理、实时监控、智能出价、复盘与指标上报；tenantId 由统一拦截器注入。"
    />

    <!-- 功能分区 -->
    <el-tabs v-model="activeTab" type="border-card" aria-label="S 投流功能分区">
      <!-- ===== 1. 投放账户 ===== -->
      <el-tab-pane name="accounts">
        <template #label><span aria-label="投放账户标签页">投放账户</span></template>
        <div class="section-actions">
          <el-button type="primary" @click="openCreateAccount" aria-label="创建投放账户">创建投放账户</el-button>
          <span class="section-tip">后端无列表接口，本页仅维护本会话创建的投放账户</span>
        </div>
        <div class="card">
          <el-table :data="accounts" stripe v-loading="accountsLoading" aria-label="投放账户列表">
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column label="平台" width="100">
              <template #default="{ row }">
                <el-tag
                  size="small"
                  :style="{ color: adPlatformMeta[(row as AdAccountView).platform].color, borderColor: adPlatformMeta[(row as AdAccountView).platform].color }"
                >{{ adPlatformMeta[(row as AdAccountView).platform].label }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="类型" width="100">
              <template #default="{ row }">
                <el-tag
                  size="small"
                  :style="{ color: adAccountTypeMeta[(row as AdAccountView).type].color, borderColor: adAccountTypeMeta[(row as AdAccountView).type].color }"
                >{{ adAccountTypeMeta[(row as AdAccountView).type].label }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag size="small" :type="adAccountStatusMeta[(row as AdAccountView).status].type">
                  {{ adAccountStatusMeta[(row as AdAccountView).status].label }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="创建时间" min-width="170">
              <template #default="{ row }">{{ formatDateTime((row as AdAccountView).createdAt) }}</template>
            </el-table-column>
          </el-table>
        </div>
        <el-empty v-if="!accountsLoading && !accounts.length" description="暂无投放账户，点击「创建投放账户」开始" />
      </el-tab-pane>

      <!-- ===== 2. 投放计划 ===== -->
      <el-tab-pane name="campaigns">
        <template #label><span aria-label="投放计划标签页">投放计划</span></template>
        <div class="section-actions">
          <el-button type="primary" @click="openCreateCampaign" aria-label="创建投放计划">创建投放计划</el-button>
          <span class="section-tip">后端无列表接口，本页仅维护本会话创建的投放计划</span>
        </div>
        <div class="card">
          <el-table :data="campaigns" stripe v-loading="campaignsLoading" aria-label="投放计划列表">
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="accountId" label="账户ID" width="90" />
            <el-table-column prop="name" label="名称" min-width="140" show-overflow-tooltip />
            <el-table-column label="计划类型" width="100">
              <template #default="{ row }">
                <el-tag
                  size="small"
                  :style="{ color: adPlanTypeMeta[(row as AdCampaignView).planType].color, borderColor: adPlanTypeMeta[(row as AdCampaignView).planType].color }"
                >{{ adPlanTypeMeta[(row as AdCampaignView).planType].label }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="预算" width="110">
              <template #default="{ row }">{{ formatAmount((row as AdCampaignView).budget) }}</template>
            </el-table-column>
            <el-table-column label="已消耗" width="110">
              <template #default="{ row }">{{ formatAmount((row as AdCampaignView).spend) }}</template>
            </el-table-column>
            <el-table-column label="ROI" width="90">
              <template #default="{ row }">{{ (row as AdCampaignView).roi }}</template>
            </el-table-column>
            <el-table-column prop="attributionId" label="attributionId" min-width="160" show-overflow-tooltip />
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag size="small" :type="adCampaignStatusMeta[(row as AdCampaignView).status].type">
                  {{ adCampaignStatusMeta[(row as AdCampaignView).status].label }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="创建时间" min-width="170">
              <template #default="{ row }">{{ formatDateTime((row as AdCampaignView).createdAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" min-width="320" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="openMetric(row as AdCampaignView)" :aria-label="`实时监控 ${(row as AdCampaignView).id}`">实时监控</el-button>
                <el-button link type="warning" @click="openBid(row as AdCampaignView)" :aria-label="`智能出价 ${(row as AdCampaignView).id}`">智能出价</el-button>
                <el-button link type="success" @click="openReview(row as AdCampaignView)" :aria-label="`复盘 ${(row as AdCampaignView).id}`">复盘</el-button>
                <el-button link type="info" @click="openReport(row as AdCampaignView)" :aria-label="`上报指标 ${(row as AdCampaignView).id}`">上报指标</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
        <el-empty v-if="!campaignsLoading && !campaigns.length" description="暂无投放计划，点击「创建投放计划」开始" />
      </el-tab-pane>
    </el-tabs>

    <!-- ===== 弹窗区 ===== -->
    <!-- 创建投放账户弹窗 -->
    <el-dialog v-model="accountDialog" title="创建投放账户" aria-label="创建投放账户弹窗" width="520px">
      <el-form label-width="110px" @submit.prevent>
        <el-form-item label="平台" required>
          <el-select v-model="accountForm.platform" placeholder="选择平台" style="width: 100%" aria-label="投放平台">
            <el-option v-for="opt in adPlatformOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="账户类型" required>
          <el-select v-model="accountForm.type" placeholder="选择账户类型" style="width: 100%" aria-label="投放账户类型">
            <el-option v-for="opt in adAccountTypeOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="授权加密串">
          <el-input v-model="accountForm.authEnc" placeholder="authEnc（可选）" aria-label="授权加密串authEnc" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="accountForm.status" placeholder="正常" style="width: 100%" aria-label="账户状态">
            <el-option v-for="opt in adAccountStatusOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="accountDialog = false">取消</el-button>
        <el-button type="primary" :loading="accountSubmitting" @click="confirmCreateAccount">确定创建</el-button>
      </template>
    </el-dialog>

    <!-- 创建投放计划弹窗 -->
    <el-dialog v-model="campaignDialog" title="创建投放计划" aria-label="创建投放计划弹窗" width="560px">
      <el-form label-width="110px" @submit.prevent>
        <el-form-item label="账户" required>
          <el-select
            v-model="campaignForm.accountId"
            placeholder="选择投放账户"
            filterable
            style="width: 100%"
            aria-label="投放账户"
          >
            <el-option
              v-for="acc in accounts"
              :key="acc.id"
              :label="`#${acc.id} · ${adPlatformMeta[acc.platform].label} · ${adAccountTypeMeta[acc.type].label}`"
              :value="acc.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="计划名称" required>
          <el-input v-model="campaignForm.name" placeholder="投放计划名称（必填）" aria-label="投放计划名称" />
        </el-form-item>
        <el-form-item label="计划类型" required>
          <el-select v-model="campaignForm.planType" placeholder="选择计划类型" style="width: 100%" aria-label="投放计划类型">
            <el-option v-for="opt in adPlanTypeOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="人群定向">
          <el-input
            v-model="campaignForm.audience"
            type="textarea"
            :rows="3"
            placeholder="受众 JSON 对象（可选），如 {&quot;age&quot;:&quot;18-24&quot;}"
            aria-label="人群定向JSON"
          />
        </el-form-item>
        <el-form-item label="预算">
          <el-input v-model.number="campaignForm.budget" type="number" placeholder="≥0，默认 0" aria-label="预算" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="campaignDialog = false">取消</el-button>
        <el-button type="primary" :loading="campaignSubmitting" @click="confirmCreateCampaign">确定创建</el-button>
      </template>
    </el-dialog>

    <!-- 实时监控弹窗 -->
    <el-dialog v-model="metricDialog" title="实时监控" aria-label="实时监控弹窗" width="560px">
      <div v-if="metricTarget" class="metric-head">
        计划 #{{ metricTarget.id }} · {{ metricTarget.name }}
      </div>
      <div v-loading="metricLoading" class="metric-body">
        <el-descriptions :column="2" border size="small" v-if="metricData">
          <el-descriptions-item label="日期">{{ metricData.date }}</el-descriptions-item>
          <el-descriptions-item label="曝光">{{ metricData.impressions }}</el-descriptions-item>
          <el-descriptions-item label="点击">{{ metricData.clicks }}</el-descriptions-item>
          <el-descriptions-item label="转化">{{ metricData.conversions }}</el-descriptions-item>
          <el-descriptions-item label="消耗">{{ formatAmount(metricData.cost) }}</el-descriptions-item>
          <el-descriptions-item label="ROI">{{ metricData.roi }}</el-descriptions-item>
        </el-descriptions>
        <el-empty v-else :image-size="60" description="暂无数据" />
      </div>
      <template #footer>
        <el-button v-if="metricTarget" type="primary" :loading="metricLoading" @click="refreshMetric(metricTarget)">刷新</el-button>
        <el-button @click="metricDialog = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 智能出价弹窗 -->
    <el-dialog v-model="bidDialog" title="智能出价" aria-label="智能出价弹窗" width="560px">
      <el-form label-width="110px" @submit.prevent>
        <el-form-item label="计划">
          <span v-if="bidTarget">#{{ bidTarget.id }} · {{ bidTarget.name }}</span>
        </el-form-item>
        <el-form-item label="目标 ROI">
          <el-input v-model.number="bidForm.targetRoi" type="number" placeholder="≥0（可选）" aria-label="目标ROI" />
        </el-form-item>
        <el-form-item label="出价调整">
          <el-input v-model.number="bidForm.bidAdjust" type="number" placeholder="≥0（可选）" aria-label="出价调整" />
        </el-form-item>
      </el-form>
      <div v-if="bidSuggestion" class="bid-result">
        <h4 class="sub-title">出价建议</h4>
        <el-alert type="success" :closable="false" :title="bidSuggestion" />
      </div>
      <template #footer>
        <el-button type="primary" :loading="bidSubmitting" @click="confirmBid">生成建议</el-button>
        <el-button @click="bidDialog = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 复盘弹窗 -->
    <el-dialog v-model="reviewDialog" title="复盘" aria-label="复盘弹窗" width="560px">
      <div v-if="reviewTarget" class="metric-head">
        计划 #{{ reviewTarget.id }} · {{ reviewTarget.name }}
      </div>
      <div v-loading="reviewLoading" class="metric-body">
        <el-descriptions :column="2" border size="small" v-if="reviewData">
          <el-descriptions-item label="attributionId" :span="2">{{ reviewData.attributionId }}</el-descriptions-item>
          <el-descriptions-item label="总消耗(spend)">{{ formatAmount(reviewData.totalSpend) }}</el-descriptions-item>
          <el-descriptions-item label="总成本(cost)">{{ formatAmount(reviewData.totalCost) }}</el-descriptions-item>
          <el-descriptions-item label="总转化">{{ reviewData.totalConversions }}</el-descriptions-item>
          <el-descriptions-item label="ROI">{{ reviewData.roi }}</el-descriptions-item>
          <el-descriptions-item label="指标条数" :span="2">{{ reviewData.metricsCount }}</el-descriptions-item>
        </el-descriptions>
        <el-empty v-else :image-size="60" description="暂无复盘数据" />
      </div>
      <template #footer>
        <el-button v-if="reviewTarget" type="primary" :loading="reviewLoading" @click="refreshReview(reviewTarget)">刷新</el-button>
        <el-button @click="reviewDialog = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 上报指标弹窗 -->
    <el-dialog v-model="reportDialog" title="上报指标" aria-label="上报指标弹窗" width="560px">
      <el-form label-width="110px" @submit.prevent>
        <el-form-item label="计划">
          <span v-if="reportTarget">#{{ reportTarget.id }} · {{ reportTarget.name }}</span>
        </el-form-item>
        <el-form-item label="日期">
          <el-input v-model="reportForm.date" placeholder="YYYY-MM-DD（可选）" aria-label="指标日期" />
        </el-form-item>
        <el-form-item label="曝光">
          <el-input v-model.number="reportForm.impressions" type="number" placeholder="≥0，默认 0" aria-label="曝光" />
        </el-form-item>
        <el-form-item label="点击">
          <el-input v-model.number="reportForm.clicks" type="number" placeholder="≥0，默认 0" aria-label="点击" />
        </el-form-item>
        <el-form-item label="转化">
          <el-input v-model.number="reportForm.conversions" type="number" placeholder="≥0，默认 0" aria-label="转化" />
        </el-form-item>
        <el-form-item label="消耗">
          <el-input v-model.number="reportForm.cost" type="number" placeholder="≥0，默认 0" aria-label="消耗" />
        </el-form-item>
        <el-form-item label="ROI">
          <el-input v-model.number="reportForm.roi" type="number" placeholder="默认 0" aria-label="ROI" />
        </el-form-item>
      </el-form>
      <div v-if="reportResult" class="bid-result" v-loading="reportSubmitting">
        <h4 class="sub-title">上报结果</h4>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="日期">{{ reportResult.date }}</el-descriptions-item>
          <el-descriptions-item label="曝光">{{ reportResult.impressions }}</el-descriptions-item>
          <el-descriptions-item label="点击">{{ reportResult.clicks }}</el-descriptions-item>
          <el-descriptions-item label="转化">{{ reportResult.conversions }}</el-descriptions-item>
          <el-descriptions-item label="消耗">{{ formatAmount(reportResult.cost) }}</el-descriptions-item>
          <el-descriptions-item label="ROI">{{ reportResult.roi }}</el-descriptions-item>
        </el-descriptions>
      </div>
      <template #footer>
        <el-button type="primary" :loading="reportSubmitting" @click="confirmReport">确定上报</el-button>
        <el-button @click="reportDialog = false">关闭</el-button>
      </template>
    </el-dialog>
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
  gap: var(--space-3);
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: var(--space-3);
}
.section-tip {
  font-size: var(--text-sm);
  color: var(--app-neutral-400);
}
.metric-head {
  font-weight: 600;
  color: var(--app-neutral-700);
  margin-bottom: var(--space-2);
}
.metric-body {
  min-height: 60px;
}
.sub-title {
  margin: var(--space-4) 0 var(--space-2);
  font-size: var(--text-md);
  font-weight: 600;
  color: var(--app-neutral-700);
}
.bid-result {
  margin-top: var(--space-2);
}
</style>
