<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import {
  createInsight,
  type HumanInsightPayload,
} from '@/api/analyze'
import { driverOptions, emotionOptions } from './analyzeMaps'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  'update:modelValue': [boolean]
  saved: []
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

const formRef = ref<FormInstance>()
const submitting = ref(false)
const form = reactive<HumanInsightPayload>({
  category: '',
  driver: '贪',
  emotion: '好奇',
  title: '',
  content: '',
  tags: [],
})

const rules: FormRules<HumanInsightPayload> = {
  category: [{ required: true, message: '请填写分类', trigger: 'blur' }],
  title: [{ required: true, message: '请填写标题', trigger: 'blur' }],
  content: [{ required: true, message: '请填写洞察内容', trigger: 'blur' }],
}

function resetForm() {
  form.category = ''
  form.driver = '贪'
  form.emotion = '好奇'
  form.title = ''
  form.content = ''
  form.tags = []
  formRef.value?.clearValidate()
}

async function handleSubmit() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  submitting.value = true
  try {
    const payload: HumanInsightPayload = {
      ...form,
      tags: form.tags && form.tags.length ? form.tags : undefined,
    }
    await createInsight(payload)
    ElMessage.success('洞察已沉淀')
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
    title="新增洞察"
    size="480px"
    destroy-on-close
    aria-label="新增洞察抽屉"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="80px" @submit.prevent>
      <el-form-item label="分类" prop="category">
        <el-input
          v-model="form.category"
          placeholder="如 贪 / 情感"
          aria-label="洞察分类"
          @keyup.enter="handleSubmit"
        />
      </el-form-item>
      <el-form-item label="人性" prop="driver">
        <el-select v-model="form.driver" style="width: 100%" aria-label="人性驱动">
          <el-option v-for="opt in driverOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="情绪" prop="emotion">
        <el-select v-model="form.emotion" style="width: 100%" aria-label="情绪类型">
          <el-option v-for="opt in emotionOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="标题" prop="title">
        <el-input v-model="form.title" placeholder="洞察标题" aria-label="洞察标题" />
      </el-form-item>
      <el-form-item label="内容" prop="content">
        <el-input
          v-model="form.content"
          type="textarea"
          :rows="5"
          placeholder="聚合洞察结论"
          aria-label="洞察内容"
        />
      </el-form-item>
      <el-form-item label="标签">
        <el-select
          v-model="form.tags"
          multiple
          filterable
          allow-create
          default-first-option
          placeholder="可选，回车添加"
          style="width: 100%"
          aria-label="洞察标签"
        >
          <el-option v-for="opt in emotionOptions" :key="opt.value" :label="opt.label" :value="opt.label" />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">提交</el-button>
    </template>
  </el-drawer>
</template>
