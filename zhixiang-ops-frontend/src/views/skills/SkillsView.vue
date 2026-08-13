<template>
  <div class="page-container">
    <!-- 页面标题区 -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Z · 技能中心</h1>
        <p class="page-subtitle">管理 AI 技能市场、租户启用与 Provider 绑定</p>
      </div>
    </div>

    <!-- 功能说明 -->
    <div class="card info-bar">
      <el-icon color="var(--app-brand-500)" :size="16"><MagicStick /></el-icon>
      <span>技能市场提供系统内置 5 类 AI 能力。启用后 G/H/V/X 等模块可调用对应能力；未启用技能不在网关暴露。</span>
    </div>

    <el-tabs v-model="tab" class="skill-tabs">
      <!-- 技能市场 -->
      <el-tab-pane label="技能市场" name="market">
        <div class="card">
          <el-table :data="market" v-loading="marketLoading" stripe>
            <el-table-column prop="type" label="类型" width="140" />
            <el-table-column prop="name" label="名称" min-width="120" />
            <el-table-column prop="description" label="说明" min-width="200" show-overflow-tooltip />
            <el-table-column label="系统上架" width="90">
              <template #default="{ row }"><el-tag :type="row.systemEnabled?'success':'info'" size="small">{{ row.systemEnabled?'是':'否' }}</el-tag></template>
            </el-table-column>
            <el-table-column label="本租户" width="90">
              <template #default="{ row }"><el-tag :type="row.installed?'success':'info'" size="small">{{ row.installed?'已装':'未装' }}</el-tag></template>
            </el-table-column>
            <el-table-column label="状态" width="90">
              <template #default="{ row }"><el-tag :type="row.enabled?'success':'warning'" size="small">{{ row.enabled?'启用':'停用' }}</el-tag></template>
            </el-table-column>
            <el-table-column label="Provider" width="120">
              <template #default="{ row }">{{ providerName(row.providerId) || '-' }}</template>
            </el-table-column>
            <el-table-column label="操作" width="200" fixed="right">
              <template #default="{ row }">
                <el-button v-if="!row.enabled" link type="primary" size="small" @click="onEnable(row)">启用</el-button>
                <el-button v-else link type="warning" size="small" @click="onDisable(row)">停用</el-button>
                <el-button link type="primary" size="small" :disabled="!row.installed" @click="openBind(row)">改绑</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="!marketLoading && !market.length" description="暂无技能" />
        </div>
      </el-tab-pane>

      <!-- 已启用 -->
      <el-tab-pane label="已启用" name="installed">
        <div class="card">
          <el-table :data="installed" v-loading="installedLoading" stripe>
            <el-table-column prop="skillId" label="技能ID" width="100" />
            <el-table-column prop="type" label="类型" width="140" />
            <el-table-column prop="name" label="名称" min-width="120" />
            <el-table-column label="Provider" width="160">
              <template #default="{ row }">{{ providerName(row.providerId) || '-' }}</template>
            </el-table-column>
          </el-table>
          <el-empty v-if="!installedLoading && !installed.length" description="本租户尚未启用任何技能" />
        </div>
      </el-tab-pane>

      <!-- Provider -->
      <el-tab-pane label="Provider" name="provider">
        <div class="card">
          <el-table :data="providers" v-loading="providerLoading" stripe>
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="type" label="类型" width="140" />
            <el-table-column prop="name" label="名称" min-width="140" />
            <el-table-column prop="source" label="来源" width="140" />
            <el-table-column label="默认" width="80">
              <template #default="{ row }"><el-tag :type="row.isDefault?'success':'info'" size="small">{{ row.isDefault?'是':'否' }}</el-tag></template>
            </el-table-column>
            <el-table-column label="启用" width="80">
              <template #default="{ row }"><el-tag :type="row.enabled?'success':'info'" size="small">{{ row.enabled?'是':'否' }}</el-tag></template>
            </el-table-column>
            <el-table-column label="模型" min-width="200">
              <template #default="{ row }"><el-tag v-for="m in (row.models||[])" :key="m" size="small" class="perm-tag">{{ m }}</el-tag></template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 启用/改绑 Provider -->
    <el-dialog v-model="bindDialog" :title="`${bindTargetName} · 选择 Provider`" width="480px">
      <el-form label-width="90px">
        <el-form-item label="Provider">
          <el-select v-model="bindProviderId" style="width:100%" placeholder="选择 Provider（可不选，用系统默认）">
            <el-option v-for="p in providers" :key="p.id" :label="`${p.name}（${p.source}）`" :value="p.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="bindDialog=false">取消</el-button>
        <el-button type="primary" @click="submitBind">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { MagicStick } from '@element-plus/icons-vue'
import {
  getMarket, getProviders, getInstalled, installSkill, uninstallSkill, setProvider,
  type SkillMarketItem, type SkillProvider, type InstalledSkill,
} from '@/api/skills'

const tab = ref<'market' | 'installed' | 'provider'>('market')

// 技能市场
const market = ref<SkillMarketItem[]>([])
const marketLoading = ref(false)
async function loadMarket() {
  marketLoading.value = true
  try { market.value = await getMarket() } catch { /* */ } finally { marketLoading.value = false }
}

// Provider
const providers = ref<SkillProvider[]>([])
const providerLoading = ref(false)
async function loadProviders() {
  providerLoading.value = true
  try { providers.value = await getProviders() } catch { /* */ } finally { providerLoading.value = false }
}
function providerName(id?: number): string {
  if (!id) return ''
  const p = providers.value.find((x) => x.id === id)
  return p ? `${p.name}（${p.source}）` : ''
}

// 已启用
const installed = ref<InstalledSkill[]>([])
const installedLoading = ref(false)
async function loadInstalled() {
  installedLoading.value = true
  try { installed.value = await getInstalled() } catch { /* */ } finally { installedLoading.value = false }
}

// 启用 / 停用 / 改绑
const bindDialog = ref(false)
const bindTargetId = ref<number>()
const bindTargetName = ref('')
const bindProviderId = ref<number | undefined>(undefined)

async function onEnable(row: SkillMarketItem) {
  try {
    await installSkill(row.id)
    ElMessage.success(`已启用「${row.name}」`)
    refreshAll()
  } catch { /* */ }
}
async function onDisable(row: SkillMarketItem) {
  try { await ElMessageBox.confirm(`确认停用「${row.name}」？停用后该能力将不在网关暴露。`, '停用确认', { type: 'warning' }) } catch { return }
  try { await uninstallSkill(row.id); ElMessage.success('已停用'); refreshAll() } catch { /* */ }
}
function openBind(row: SkillMarketItem) {
  bindTargetId.value = row.id
  bindTargetName.value = row.name
  bindProviderId.value = row.providerId
  bindDialog.value = true
}
async function submitBind() {
  if (!bindTargetId.value) return
  if (!bindProviderId.value) { ElMessage.warning('请选择 Provider'); return }
  try {
    await setProvider(bindTargetId.value, bindProviderId.value)
    ElMessage.success('已改绑')
    bindDialog.value = false
    refreshAll()
  } catch { /* */ }
}

function refreshAll() { loadMarket(); loadProviders(); loadInstalled() }

onMounted(() => { loadMarket(); loadProviders(); loadInstalled() })
</script>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-lg); }
.page-title { font-size: var(--text-2xl); font-weight: 700; color: var(--el-text-color-primary); margin: 0 0 4px 0; }
.page-subtitle { font-size: var(--text-base); color: var(--el-text-color-secondary); margin: 0; }
.info-bar {
  margin-bottom: var(--space-md);
  padding: var(--space-3) var(--space-4);
  background: var(--app-brand-50);
  border: 1px solid var(--app-brand-100);
  display: flex; align-items: flex-start; gap: var(--space-2);
  font-size: var(--text-base-sm);
  color: var(--app-brand-700);
  border-radius: var(--radius-lg);
}
.skill-tabs { margin-bottom: var(--space-md); }
.perm-tag { margin: 2px 4px 2px 0; }
</style>
