<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  listChainRuns,
  listStrategies,
  OPS_STAGES,
  runChain,
  setChainPrefer,
  type ChainRunRecord,
  type ChainRunResult,
  type OpsStage,
  type StrategyMeta,
} from '@/api/automation'
import { formatDateTime } from '@/utils/format'

// ============ 1. 策略清单 ============
const strategies = ref<StrategyMeta[]>([])
const strategyLoading = ref(false)

async function loadStrategies() {
  strategyLoading.value = true
  try {
    strategies.value = await listStrategies()
  } catch {
    // 拦截器已提示
  } finally {
    strategyLoading.value = false
  }
}

function strategyCount(stage: OpsStage) {
  return strategies.value.filter((s) => s.stage === stage).length
}
function stageStrategyList(stage: OpsStage) {
  return strategies.value.filter((s) => s.stage === stage)
}

// ============ 2. 自动链运行 ============
const running = ref(false)
const runResult = ref<ChainRunResult | null>(null)
const selectedStages = ref<OpsStage[]>(['retrieve', 'screen'])

const preferForm = reactive<Partial<Record<OpsStage, string>>>({})

async function handleRunChain() {
  if (!selectedStages.value.length) {
    ElMessage.warning('请至少选择一个阶段')
    return
  }
  running.value = true
  runResult.value = null
  try {
    const payload: { stages: OpsStage[]; prefer?: Partial<Record<OpsStage, string>> } = {
      stages: [...selectedStages.value],
    }
    const pref = Object.fromEntries(
      Object.entries(preferForm).filter(([, v]) => v && v.length),
    ) as Partial<Record<OpsStage, string>>
    if (Object.keys(pref).length) payload.prefer = pref
    runResult.value = await runChain(payload)
    ElMessage.success('自动链运行完成')
    loadRuns()
  } catch {
    // 拦截器已提示
  } finally {
    running.value = false
  }
}

function stageLabel(s: string) {
  return OPS_STAGES.find((o) => o.value === s)?.label ?? (s === 'analyze' ? '分析' : s)
}

// 运行结果中该阶段是否存在
function stageRunKey(s: OpsStage) {
  return runResult.value && runResult.value.stages[s] ? s : null
}

// ============ 3. 偏好设置 ============
async function handleSavePrefer() {
  try {
    await setChainPrefer(preferForm)
    ElMessage.success('偏好已保存')
  } catch {
    // 拦截器已提示
  }
}

// ============ 4. 运行历史 ============
const runs = ref<ChainRunRecord[]>([])

async function loadRuns() {
  try {
    runs.value = await listChainRuns()
  } catch {
    // 拦截器已提示
  }
}

onMounted(() => {
  loadStrategies()
  loadRuns()
})
</script>

<template>
  <div class="page-container" aria-label="自动链">
    <!-- 页面标题区 -->
    <div class="page-header">
      <div>
        <h1 class="page-title">自动链</h1>
        <p class="page-subtitle">检索→筛选→上架→投流→验证 五阶段免人工流水线；默认只跑第一段（检索→筛选）</p>
      </div>
      <el-button :loading="strategyLoading" @click="loadStrategies">刷新策略</el-button>
    </div>

    <el-tabs type="border-card" aria-label="自动链功能分区">
      <!-- ===== 1. 运行 ===== -->
      <el-tab-pane label="运行">
        <template #label><span aria-label="运行标签页">运行</span></template>
        <div class="card run-card">
          <div class="run-form">
            <div class="run-label">选择阶段（可多选，按顺序执行）：</div>
            <el-checkbox-group v-model="selectedStages" aria-label="选择运行阶段">
              <el-checkbox v-for="s in OPS_STAGES" :key="s.value" :value="s.value">
                {{ s.label }}
                <span class="stage-count">（{{ strategyCount(s.value) }} 个策略）</span>
              </el-checkbox>
            </el-checkbox-group>
          </div>
          <div class="filter-actions">
            <el-button type="primary" :loading="running" @click="handleRunChain">运行自动链</el-button>
          </div>
        </div>

        <!-- 运行结果 -->
        <div v-if="runResult" class="card result-card">
          <div class="result-head">
            <span class="result-title">运行结果</span>
            <span class="result-id">chainRunId: {{ runResult.chainRunId }}</span>
          </div>
          <el-table :data="OPS_STAGES.filter((s) => stageRunKey(s.value) !== null)" border aria-label="阶段运行结果">
            <el-table-column label="阶段" min-width="140">
              <template #default="{ row }">{{ stageLabel(row.value) }}</template>
            </el-table-column>
            <el-table-column label="策略" min-width="200">
              <template #default="{ row }">
                <span class="mono">{{ runResult!.stages[row.value]?.strategy }}</span>
              </template>
            </el-table-column>
            <el-table-column label="结果" width="100">
              <template #default="{ row }">
                <el-tag :type="runResult!.stages[row.value]?.ok ? 'success' : 'danger'" size="small">
                  {{ runResult!.stages[row.value]?.ok ? '成功' : '失败' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="详情" min-width="300">
              <template #default="{ row }">
                <span v-if="runResult!.stages[row.value]?.ok" class="detail-text">
                  {{ JSON.stringify(runResult!.stages[row.value]?.detail) }}
                </span>
                <span v-else class="error-text">{{ runResult!.stages[row.value]?.error }}</span>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>

      <!-- ===== 2. 策略清单 ===== -->
      <el-tab-pane label="策略清单">
        <template #label><span aria-label="策略清单标签页">策略清单</span></template>
        <el-empty v-if="!strategyLoading && !strategies.length" description="暂无策略数据" />
        <el-table v-else v-loading="strategyLoading" :data="strategies" stripe aria-label="策略清单">
          <el-table-column label="阶段" width="130">
            <template #default="{ row }">{{ stageLabel(row.stage) }}</template>
          </el-table-column>
          <el-table-column prop="key" label="策略 Key" min-width="200">
            <template #default="{ row }"><span class="mono">{{ row.key }}</span></template>
          </el-table-column>
          <el-table-column prop="name" label="名称" min-width="140" />
          <el-table-column prop="impl" label="实现路径" width="100" />
          <el-table-column label="场景" min-width="160">
            <template #default="{ row }">
              <el-tag v-for="sc in row.scenarios" :key="sc" type="info" size="small" class="mini-tag">{{ sc }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="默认启用" width="90">
            <template #default="{ row }">
              <el-tag :type="row.enabledByDefault ? 'success' : 'info'" size="small">
                {{ row.enabledByDefault ? '是' : '否' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="desc" label="说明" min-width="240" show-overflow-tooltip />
        </el-table>
      </el-tab-pane>

      <!-- ===== 3. 偏好 ===== -->
      <el-tab-pane label="阶段偏好">
        <template #label><span aria-label="阶段偏好标签页">阶段偏好</span></template>
        <div class="card prefer-card">
          <el-form label-width="180px" @submit.prevent>
            <el-form-item v-for="s in OPS_STAGES" :key="s.value" :label="stageLabel(s.value)">
              <el-select v-model="preferForm[s.value]" placeholder="默认策略（自动选择）" clearable style="width: 320px" aria-label="阶段偏好选择">
                <el-option v-for="st in stageStrategyList(s.value)" :key="st.key" :label="`${st.name}（${st.key}）`" :value="st.key" />
              </el-select>
            </el-form-item>
          </el-form>
          <div class="filter-actions">
            <el-button type="primary" @click="handleSavePrefer">保存偏好</el-button>
          </div>
        </div>
      </el-tab-pane>

      <!-- ===== 4. 运行历史 ===== -->
      <el-tab-pane label="运行历史">
        <template #label><span aria-label="运行历史标签页">运行历史</span></template>
        <el-table :data="runs" stripe aria-label="运行历史">
          <template #empty>
            <el-empty description="暂无运行记录" />
          </template>
          <el-table-column prop="id" label="运行 ID" min-width="300">
            <template #default="{ row }"><span class="mono">{{ row.id }}</span></template>
          </el-table-column>
          <el-table-column prop="stage" label="阶段" min-width="160">
            <template #default="{ row }">{{ stageLabel(row.stage) }}</template>
          </el-table-column>
          <el-table-column prop="at" label="时间" min-width="170">
            <template #default="{ row }">{{ formatDateTime(row.at) }}</template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
/* 页面标题区 */
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-lg); }
.page-title { font-size: var(--text-2xl); font-weight: 700; color: var(--el-text-color-primary); margin: 0 0 4px 0; }
.page-subtitle { font-size: var(--text-base); color: var(--el-text-color-secondary); margin: 0; }

/* 卡片 */
.card { padding: var(--space-lg); margin-bottom: var(--space-md); }
.run-card .run-form { margin-bottom: var(--space-lg); }
.run-label { margin-bottom: var(--space-sm); font-weight: 600; color: var(--el-text-color-primary); }
.stage-count { font-size: var(--text-sm); color: var(--el-text-color-secondary); }
.filter-actions { display: flex; gap: var(--space-sm); }

/* 结果 */
.result-head { display: flex; align-items: baseline; gap: var(--space-lg); margin-bottom: var(--space-md); }
.result-title { font-weight: 600; color: var(--el-text-color-primary); }
.result-id { font-size: var(--text-sm); color: var(--el-text-color-secondary); }
.mono { font-family: Consolas, monospace; font-size: var(--text-sm); }
.detail-text { font-size: var(--text-sm); color: var(--el-text-color-secondary); word-break: break-all; }
.error-text { font-size: var(--text-sm); color: var(--el-color-danger); word-break: break-all; }

/* 标签 */
.mini-tag { margin-right: var(--space-1); }
</style>
