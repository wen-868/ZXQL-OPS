<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h2 class="page-title">大模型配置</h2>
        <p class="page-sub">
          管理平台可调用的 LLM 提供方（Ollama / OpenAI / Azure / 自定义）。API Key 加密存储，界面仅显示掩码。
        </p>
      </div>
      <el-button type="primary" :icon="Plus" @click="openCreate">新增提供方</el-button>
    </div>

    <div class="info-bar">
      <el-table :data="list" v-loading="loading" style="width: 100%">
        <el-table-column prop="name" label="名称" min-width="140" />
        <el-table-column label="类型" width="120">
          <template #default="{ row }">
            <el-tag :type="typeTag(row.type)">{{ typeLabel(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="defaultModel" label="默认模型" min-width="140" />
        <el-table-column label="API Key" width="130">
          <template #default="{ row }">
            <span v-if="row.apiKeyMasked" class="masked">{{ row.apiKeyMasked }}</span>
            <span v-else class="muted">未配置</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? '启用' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="success" @click="handleTest(row)">测试连接</el-button>
            <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pager" v-if="total > pageSize">
        <el-pagination
          background
          layout="prev,pager,next"
          :total="total"
          :page-size="pageSize"
          v-model:current-page="page"
          @current-change="load"
        />
      </div>
    </div>

    <el-dialog
      v-model="dialogVisible"
      :title="editing ? '编辑提供方' : '新增提供方'"
      width="480px"
    >
      <el-form :model="form" label-width="96px">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" placeholder="如：本地 Ollama" />
        </el-form-item>
        <el-form-item label="类型" required>
          <el-select v-model="form.type" style="width: 100%">
            <el-option label="Ollama（本地）" value="ollama" />
            <el-option label="OpenAI 兼容" value="openai" />
            <el-option label="Azure OpenAI" value="azure" />
            <el-option label="自定义端点" value="custom" />
          </el-select>
        </el-form-item>
        <el-form-item label="Base URL" required>
          <el-input v-model="form.baseUrl" placeholder="http://127.0.0.1:11434" />
        </el-form-item>
        <el-form-item label="API Key">
          <el-input
            v-model="form.apiKey"
            type="password"
            show-password
            :placeholder="editing ? '留空则不修改' : '可选'"
          />
        </el-form-item>
        <el-form-item label="默认模型">
          <el-input v-model="form.defaultModel" placeholder="如 qwen2.5:7b" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  listProviders,
  createProvider,
  updateProvider,
  deleteProvider,
  testProvider,
  type LlmProvider,
  type LlmType,
} from '@/api/llm'

const list = ref<LlmProvider[]>([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)

const dialogVisible = ref(false)
const editing = ref(false)
const saving = ref(false)
const editingId = ref<number | null>(null)

const emptyForm = () => ({
  name: '',
  type: 'ollama' as LlmType,
  baseUrl: '',
  apiKey: '',
  defaultModel: '',
  remark: '',
  enabled: true,
})
const form = reactive(emptyForm())

const TYPE_MAP: Record<string, { label: string; tag: string }> = {
  ollama: { label: 'Ollama', tag: 'warning' },
  openai: { label: 'OpenAI', tag: 'success' },
  azure: { label: 'Azure', tag: 'primary' },
  custom: { label: '自定义', tag: 'info' },
}
const typeLabel = (t: string) => TYPE_MAP[t]?.label || t
const typeTag = (t: string) => (TYPE_MAP[t]?.tag as any) || 'info'

async function load() {
  loading.value = true
  try {
    const res = await listProviders({ page: page.value, pageSize: pageSize.value })
    list.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
  }
}

function openCreate() {
  Object.assign(form, emptyForm())
  editing.value = false
  editingId.value = null
  dialogVisible.value = true
}
function openEdit(row: LlmProvider) {
  Object.assign(form, {
    name: row.name,
    type: row.type,
    baseUrl: row.baseUrl || '',
    apiKey: '',
    defaultModel: row.defaultModel || '',
    remark: row.remark || '',
    enabled: row.enabled,
  })
  editing.value = true
  editingId.value = row.id
  dialogVisible.value = true
}
async function handleSave() {
  if (!form.name || !form.baseUrl) {
    ElMessage.warning('请填写名称与 Base URL')
    return
  }
  saving.value = true
  try {
    if (editing.value && editingId.value) {
      await updateProvider(editingId.value, { ...form })
      ElMessage.success('已更新')
    } else {
      await createProvider({ ...form })
      ElMessage.success('已新增')
    }
    dialogVisible.value = false
    await load()
  } finally {
    saving.value = false
  }
}
async function handleDelete(row: LlmProvider) {
  await ElMessageBox.confirm(`确认删除提供方「${row.name}」？`, '提示', { type: 'warning' })
  await deleteProvider(row.id)
  ElMessage.success('已删除')
  await load()
}
async function handleTest(row: LlmProvider) {
  try {
    const r = await testProvider(row.id)
    if (r.ok) ElMessage.success(`连接成功（${row.name}）`)
    else ElMessage.error(`连接失败：${r.message}`)
  } catch (e: any) {
    ElMessage.error(`连接失败：${e?.response?.data?.msg || e?.message || '未知错误'}`)
  }
}

onMounted(load)
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
.info-bar {
  background: #fff;
  border-radius: 12px;
  padding: 8px 16px 16px;
  box-shadow: var(--shadow-sm, 0 1px 3px rgba(0, 0, 0, 0.06));
}
.pager {
  display: flex;
  justify-content: flex-end;
  padding-top: 12px;
}
.muted {
  color: var(--app-text-secondary, #8a8f99);
}
.masked {
  color: var(--app-brand-500, #3f6fef);
  font-family: monospace;
}
</style>
