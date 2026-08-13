<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h1 class="page-title">集成设置</h1>
        <p class="page-subtitle">管理系统对接状态与主数据同步开关（由客户自行决定）</p>
      </div>
    </div>

    <!-- 对接状态 -->
    <div class="card">
      <h3 class="card-title">对接状态</h3>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="接入模式">
          <el-tag :type="cfg?.mode === 'connected' ? 'success' : 'info'">
            {{ cfg?.mode === 'connected' ? '对接模式（同时使用两个系统）' : '独立模式（仅运营系统）' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="对接管理系统">
          <el-tag :type="cond('connected') ? 'success' : 'danger'">
            {{ cond('connected') ? '已对接' : '未对接' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="服务账号配置">
          <el-tag :type="cond('serviceAccount') ? 'success' : 'danger'">
            {{ cond('serviceAccount') ? '已配置' : '未配置' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="租户映射">
          <el-tag :type="cond('tenantBind') ? 'success' : 'danger'">
            {{ cond('tenantBind') ? '已映射' : '未映射' }}
          </el-tag>
        </el-descriptions-item>
      </el-descriptions>
      <el-alert
        v-if="cfg && !cfg.canSync"
        type="warning"
        :closable="false"
        show-icon
        class="mt12"
      >
        数据同步仅在「同时使用管理系统与运营系统」时可选：需对接模式 + 服务账号已配置 + 租户映射已建立。
      </el-alert>
    </div>

    <!-- 同步开关 -->
    <div class="card">
      <h3 class="card-title">主数据同步开关</h3>
      <el-alert type="info" :closable="false" show-icon class="mb12">
        由客户自行决定是否开启；开启后按所选范围定时镜像管理系统主数据。关闭不受条件限制，随时可关。
      </el-alert>
      <div class="sync-row">
        <span class="sync-label">同步总开关</span>
        <el-switch v-model="form.syncEnabled" :disabled="!canToggle" />
      </div>
      <el-divider />
      <div v-for="s in scopeOptions" :key="s.key" class="sync-row">
        <span class="sync-label">{{ s.label }}</span>
        <el-switch v-model="form.scopes[s.key]" :disabled="!form.syncEnabled || !canToggle" />
      </div>
      <div class="mt12">
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
        <span v-if="!canToggle" class="muted-text">当前不满足开启条件，仅可查看或关闭</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getSyncConfig,
  updateSyncConfig,
  type SyncConfig,
  type SyncScopes,
} from '@/api/integration'

const cfg = ref<SyncConfig | null>(null)
const saving = ref(false)

const form = reactive<{ syncEnabled: boolean; scopes: SyncScopes }>({
  syncEnabled: false,
  scopes: { products: false, customers: false, inventory: false, orders: false },
})

const scopeOptions = [
  { key: 'products' as const, label: '商品同步' },
  { key: 'customers' as const, label: '客户同步' },
  { key: 'inventory' as const, label: '库存同步' },
  { key: 'orders' as const, label: '订单同步' },
]

const canToggle = computed(() => !!cfg.value?.canSync)

function cond(key: keyof SyncConfig['conditions']): boolean {
  return !!cfg.value?.conditions[key]
}

async function load() {
  cfg.value = await getSyncConfig()
  if (cfg.value) {
    form.syncEnabled = cfg.value.syncEnabled
    form.scopes = { ...cfg.value.scopes }
  }
}

async function save() {
  saving.value = true
  try {
    cfg.value = await updateSyncConfig({
      syncEnabled: form.syncEnabled,
      scopes: form.scopes,
    })
    form.syncEnabled = cfg.value.syncEnabled
    form.scopes = { ...cfg.value.scopes }
    ElMessage.success('同步设置已保存')
  } catch {
    // 错误已由请求拦截器提示；重新拉取还原开关状态
    await load()
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.card-title {
  margin: 0 0 14px;
  font-size: 15px;
}
.sync-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
}
.sync-label {
  color: var(--app-text-primary, #303133);
  font-size: 14px;
}
.mt12 {
  margin-top: 12px;
}
.mb12 {
  margin-bottom: 12px;
}
.muted-text {
  margin-left: 12px;
  color: var(--app-text-muted, #909399);
  font-size: 13px;
}
</style>
