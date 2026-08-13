<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import {
  updateTopic,
  type Topic,
  type TopicUpdatePayload,
} from '@/api/topic'
import {
  driverOptions,
  emotionOptions,
  allowedStatusOptions,
  topicStatusMeta,
} from './topicMaps'

const props = defineProps<{ modelValue: boolean; topic: Topic | null }>()
const emit = defineEmits<{
  'update:modelValue': [boolean]
  saved: []
}>()

const visible = ref(props.modelValue)
watch(
  () => props.modelValue,
  (v) => {
    visible.value = v
    if (v && props.topic) syncForm(props.topic)
  },
)
watch(visible, (v) => emit('update:modelValue', v))

const formRef = ref<FormInstance>()
const submitting = ref(false)
const form = reactive<{
  title: string
  humanDriver: Topic['humanDriver']
  emotion: Topic['emotion']
  formulaTags: string[]
  status: Topic['status']
  score: number
  scheduledAt: string
  accountId: string
}>({
  title: '',
  humanDriver: '贪',
  emotion: '好奇',
  formulaTags: [],
  status: 'idea',
  score: 0,
  scheduledAt: '',
  accountId: '',
})

const statusOpts = ref<{ value: Topic['status']; label: string }[]>([])

function syncForm(t: Topic) {
  form.title = t.title
  form.humanDriver = t.humanDriver
  form.emotion = t.emotion
  form.formulaTags = t.formulaTags ? [...t.formulaTags] : []
  form.status = t.status
  form.score = t.score
  form.scheduledAt = t.scheduledAt || ''
  form.accountId = t.accountId || ''
  statusOpts.value = allowedStatusOptions(t.status)
}

const rules: FormRules<typeof form> = {
  title: [{ required: true, message: '请填写选题标题', trigger: 'blur' }],
}

async function handleSubmit() {
  if (!formRef.value || !props.topic) return
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  submitting.value = true
  try {
    const payload: TopicUpdatePayload = {
      title: form.title,
      humanDriver: form.humanDriver,
      emotion: form.emotion,
      formulaTags: form.formulaTags.length ? form.formulaTags : undefined,
      status: form.status,
      score: form.score,
      scheduledAt: form.scheduledAt || undefined,
      accountId: form.accountId || undefined,
    }
    await updateTopic(props.topic.id, payload)
    ElMessage.success('选题已更新')
    visible.value = false
    emit('saved')
  } catch {
    // 拦截器已提示（含 400 INVALID_STATUS_TRANSITION）
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-drawer
    v-model="visible"
    title="编辑选题"
    size="480px"
    destroy-on-close
    aria-label="编辑选题抽屉"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="90px" @submit.prevent>
      <el-form-item label="标题" prop="title">
        <el-input v-model="form.title" placeholder="选题标题" aria-label="选题标题" />
      </el-form-item>
      <el-form-item label="人性驱动">
        <el-select v-model="form.humanDriver" style="width: 100%" aria-label="人性驱动">
          <el-option v-for="opt in driverOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="情绪">
        <el-select v-model="form.emotion" style="width: 100%" aria-label="情绪类型">
          <el-option v-for="opt in emotionOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="公式标签">
        <el-select
          v-model="form.formulaTags"
          multiple
          filterable
          allow-create
          default-first-option
          placeholder="可选，回车添加"
          style="width: 100%"
          aria-label="公式标签"
        />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="form.status" style="width: 100%" aria-label="选题状态">
          <el-option
            v-for="opt in statusOpts"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
        <div class="status-tip">
          当前：<el-tag :type="topicStatusMeta[form.status].type" size="small">
            {{ topicStatusMeta[form.status].label }}
          </el-tag>
        </div>
      </el-form-item>
      <el-form-item label="评分">
        <el-input-number
          v-model="form.score"
          :min="0"
          :max="100"
          controls-position="right"
          style="width: 160px"
          aria-label="选题评分"
        />
      </el-form-item>
      <el-form-item label="排期时间">
        <el-date-picker
          v-model="form.scheduledAt"
          type="datetime"
          placeholder="可选排期"
          value-format="YYYY-MM-DDTHH:mm:ss"
          style="width: 100%"
          aria-label="排期时间"
        />
      </el-form-item>
      <el-form-item label="账号ID">
        <el-input v-model="form.accountId" placeholder="可选，目标账号" aria-label="账号ID" clearable />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
    </template>
  </el-drawer>
</template>

<style scoped>
.status-tip {
  margin-top: 6px;
  color: var(--el-text-color-secondary);
  font-size: var(--text-sm);
}
</style>
