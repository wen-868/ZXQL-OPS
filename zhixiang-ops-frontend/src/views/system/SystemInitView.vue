<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h2 class="page-title">系统初始化</h2>
        <p class="page-sub">
          部署引导与运行期基线数据初始化。两者均幂等，可重复执行，不会删除现有数据。
        </p>
      </div>
      <div class="actions">
        <el-button type="primary" :loading="initLoading" @click="handleInit">一键部署引导</el-button>
        <el-button :loading="seedLoading" @click="handleSeed">运行期数据初始化</el-button>
      </div>
    </div>

    <div class="info-bar" v-loading="statusLoading">
      <h3 class="block-title">系统状态</h3>
      <div class="status-grid">
        <div class="status-item">
          <div class="status-label">初始化状态</div>
          <el-tag :type="status.initialized ? 'success' : 'warning'">
            {{ status.initialized ? '已初始化' : '未初始化' }}
          </el-tag>
        </div>
        <div class="status-item">
          <div class="status-label">管理员账号</div>
          <div class="status-value">{{ status.adminExists ? '已存在' : '缺失' }}</div>
        </div>
        <div class="status-item">
          <div class="status-label">默认角色数</div>
          <div class="status-value">{{ status.roleCount }}</div>
        </div>
        <div class="status-item">
          <div class="status-label">合规词库数</div>
          <div class="status-value">{{ status.complianceWordCount }}</div>
        </div>
      </div>
    </div>

    <div class="info-bar" v-if="lastResult.length">
      <h3 class="block-title">执行结果</h3>
      <div v-for="s in lastResult" :key="s.step" class="result-row">
        <el-tag :type="s.status === 'created' ? 'success' : 'info'" size="small">
          {{ s.status === 'created' ? '已创建' : '已跳过' }}
        </el-tag>
        <span class="result-step">{{ stepLabel(s.step) }}</span>
        <span class="muted">{{ s.detail }}</span>
      </div>
    </div>

    <el-alert
      type="info"
      :closable="false"
      show-icon
      style="margin-bottom: 16px"
      title="部署引导将创建默认角色（admin/editor/viewer）与管理员账号（admin / Admin@123），并补录合规词库基线。"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getSystemStatus,
  initSystem,
  seedSystem,
  type SystemStatus,
  type InitStep,
} from '@/api/system'

const status = ref<SystemStatus>({
  initialized: false,
  adminExists: false,
  roleCount: 0,
  complianceWordCount: 0,
})
const statusLoading = ref(false)
const initLoading = ref(false)
const seedLoading = ref(false)
const lastResult = ref<InitStep[]>([])

const STEP_LABEL: Record<string, string> = {
  'default-roles': '默认角色',
  'admin-account': '管理员账号',
  'compliance-words': '合规词库基线',
}
const stepLabel = (s: string) => STEP_LABEL[s] || s

async function loadStatus() {
  statusLoading.value = true
  try {
    status.value = await getSystemStatus()
  } finally {
    statusLoading.value = false
  }
}
async function handleInit() {
  initLoading.value = true
  try {
    const r = await initSystem({})
    lastResult.value = r.steps
    ElMessage.success('部署引导完成')
    await loadStatus()
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || '初始化失败')
  } finally {
    initLoading.value = false
  }
}
async function handleSeed() {
  seedLoading.value = true
  try {
    const r = await seedSystem({})
    lastResult.value = r.steps
    ElMessage.success('数据初始化完成')
    await loadStatus()
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.msg || '初始化失败')
  } finally {
    seedLoading.value = false
  }
}

onMounted(loadStatus)
</script>

<style scoped>
.page-container {
  padding: 20px;
  background: var(--app-bg, #f5f6f8);
  min-height: 100vh;
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}
.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--app-text, #1f2329);
}
.page-sub {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--app-text-secondary, #8a8f99);
  max-width: 720px;
}
.actions {
  display: flex;
  gap: 12px;
}
.info-bar {
  background: #fff;
  border-radius: 12px;
  padding: 16px 20px;
  box-shadow: var(--shadow-sm, 0 1px 3px rgba(0, 0, 0, 0.06));
  margin-bottom: 16px;
}
.block-title {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
  color: var(--app-text, #1f2329);
}
.status-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}
.status-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.status-label {
  font-size: 13px;
  color: var(--app-text-secondary, #8a8f99);
}
.status-value {
  font-size: 20px;
  font-weight: 600;
  color: var(--app-text, #1f2329);
}
.result-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--app-divider, #f0f0f0);
}
.result-row:last-child {
  border-bottom: none;
}
.result-step {
  font-weight: 500;
}
.muted {
  color: var(--app-text-secondary, #8a8f99);
}
</style>
