<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  createWorkflow,
  updateWorkflow,
  type WorkflowDef,
  type WorkflowNode,
  type WorkflowEdge,
  type WorkflowNodeType,
  type WorkflowTrigger,
} from '@/api/workflow'
import { nodeTypeOptions, triggerOptions } from './workflowMaps'

const props = defineProps<{
  modelValue: boolean
  editing?: WorkflowDef | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'saved'): void
}>()

const visible = ref(props.modelValue)
watch(
  () => props.modelValue,
  (v) => {
    visible.value = v
    if (v) resetForm()
  },
)
watch(visible, (v) => emit('update:modelValue', v))

// 源类型顺序（阶段1 线性链按此排序后为 C→D→E→F→I→J）
const STAGE_ORDER: WorkflowNodeType[] = [
  'collect',
  'analyze',
  'ideate',
  'script',
  'publish',
  'recycle',
]

const form = reactive<{
  name: string
  nodeTypes: WorkflowNodeType[]
  trigger: WorkflowTrigger
  cronExpr: string
  enabled: boolean
}>({
  name: '',
  nodeTypes: [],
  trigger: 'manual',
  cronExpr: '',
  enabled: true,
})

const submitting = ref(false)

function resetForm() {
  if (props.editing) {
    // 编辑：回填原值（节点按原 def.nodes 顺序）
    form.name = props.editing.name
    form.nodeTypes = props.editing.nodes.map((n) => n.type)
    form.trigger = props.editing.trigger
    form.cronExpr = props.editing.cronExpr ?? ''
    form.enabled = props.editing.enabled
  } else {
    form.name = ''
    form.nodeTypes = []
    form.trigger = 'manual'
    form.cronExpr = ''
    form.enabled = true
  }
}

// 阶段1 简化：按所选节点类型顺序自动生成 id=n1/n2... 并连成线性链
function buildNodesAndEdges(): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } {
  // 去重并保留阶段顺序
  const ordered: WorkflowNodeType[] = STAGE_ORDER.filter((t) =>
    form.nodeTypes.includes(t),
  )
  const nodes: WorkflowNode[] = ordered.map((type, i) => ({
    id: `n${i + 1}`,
    type,
    config: {},
  }))
  const edges: WorkflowEdge[] = []
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({ from: nodes[i].id, to: nodes[i + 1].id })
  }
  return { nodes, edges }
}

function validate(): boolean {
  if (!form.name.trim()) {
    ElMessage.warning('请填写编排名称')
    return false
  }
  if (!form.nodeTypes.length) {
    ElMessage.warning('请至少选择 1 个节点')
    return false
  }
  if (form.trigger === 'cron' && !form.cronExpr.trim()) {
    ElMessage.warning('定时触发需填写 cron 表达式')
    return false
  }
  return true
}

async function handleSubmit() {
  if (!validate()) return
  const { nodes, edges } = buildNodesAndEdges()
  if (new Set(nodes.map((n) => n.id)).size !== nodes.length) {
    ElMessage.warning('节点 id 冲突（去重失败）')
    return
  }
  submitting.value = true
  try {
    if (props.editing) {
      await updateWorkflow(props.editing.id, {
        name: form.name.trim(),
        nodes,
        edges,
        trigger: form.trigger,
        cronExpr: form.trigger === 'cron' ? form.cronExpr.trim() : undefined,
        enabled: form.enabled,
      })
      ElMessage.success('编排已更新')
    } else {
      await createWorkflow({
        name: form.name.trim(),
        nodes,
        edges,
        trigger: form.trigger,
        cronExpr: form.trigger === 'cron' ? form.cronExpr.trim() : undefined,
        enabled: form.enabled,
      })
      ElMessage.success('编排已创建')
    }
    visible.value = false
    emit('saved')
  } catch {
    // 拦截器已提示
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-drawer
    v-model="visible"
    :title="editing ? '编辑编排' : '新建编排'"
    size="480px"
    destroy-on-close
    :aria-label="editing ? '编辑编排抽屉' : '新建编排抽屉'"
  >
    <el-form label-width="110px" @submit.prevent>
      <el-form-item label="编排名称" required>
        <el-input
          v-model="form.name"
          placeholder="如：C→D→E→F→I 日更流水线"
          style="width: 100%"
          aria-label="编排名称"
          clearable
        />
      </el-form-item>
      <el-form-item label="节点" required>
        <el-select
          v-model="form.nodeTypes"
          multiple
          placeholder="选择节点（按阶段顺序自动连链）"
          style="width: 100%"
          aria-label="节点多选"
        >
          <el-option
            v-for="opt in nodeTypeOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="触发方式" required>
        <el-select
          v-model="form.trigger"
          style="width: 100%"
          aria-label="触发方式"
        >
          <el-option
            v-for="opt in triggerOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item v-if="form.trigger === 'cron'" label="cron 表达式" required>
        <el-input
          v-model="form.cronExpr"
          placeholder="如：0 0 12 * * *"
          style="width: 100%"
          aria-label="cron表达式"
          clearable
        />
      </el-form-item>
      <el-form-item label="启用">
        <el-switch v-model="form.enabled" aria-label="启用开关" />
      </el-form-item>
      <el-alert
        type="info"
        :closable="false"
        show-icon
        class="chain-hint"
        title="阶段1 线性链：所选节点按 C→D→E→F→I→J 顺序自动连成 n1→n2→…；复杂 DAG 由后端校验。"
      />
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        {{ editing ? '保存更新' : '创建编排' }}
      </el-button>
    </template>
  </el-drawer>
</template>

<style scoped>
.chain-hint {
  margin-bottom: var(--space-md);
}
</style>
