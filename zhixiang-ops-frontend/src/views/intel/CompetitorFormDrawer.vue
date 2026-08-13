<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import {
  createCompetitor,
  updateCompetitor,
  type Competitor,
  type CompetitorPayload,
} from '@/api/intel'
import { platformOptions } from './intelMaps'

const props = defineProps<{
  modelValue: boolean
  // 编辑时传入已有竞品；为空为新建
  competitor?: Competitor | null
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

const isEdit = ref(false)
const submitting = ref(false)
const formRef = ref<FormInstance>()

const form = reactive<CompetitorPayload & { id?: number }>({
  id: undefined,
  platform: 'douyin',
  name: '',
  url: '',
  category: '',
})

function resetForm() {
  isEdit.value = !!props.competitor
  form.id = props.competitor?.id
  form.platform = props.competitor?.platform ?? 'douyin'
  form.name = props.competitor?.name ?? ''
  form.url = props.competitor?.url ?? ''
  form.category = props.competitor?.category ?? ''
  formRef.value?.clearValidate()
}

const rules: FormRules = {
  platform: [{ required: true, message: '请选择平台', trigger: 'change' }],
  name: [{ required: true, message: '请输入竞品名称', trigger: 'blur' }],
  url: [
    { required: true, message: '请输入主页URL', trigger: 'blur' },
    { type: 'url', message: 'URL 格式不正确', trigger: 'blur' },
  ],
  category: [{ required: true, message: '请输入分类/赛道', trigger: 'blur' }],
}

async function handleSubmit() {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    submitting.value = true
    try {
      const payload: CompetitorPayload = {
        platform: form.platform,
        name: form.name,
        url: form.url,
        category: form.category,
      }
      if (isEdit.value && form.id != null) {
        await updateCompetitor(form.id, payload)
        ElMessage.success('更新成功')
      } else {
        await createCompetitor(payload)
        ElMessage.success('创建成功')
      }
      visible.value = false
      emit('saved')
    } catch {
      // 错误已在 axios 拦截器统一提示
    } finally {
      submitting.value = false
    }
  })
}
</script>

<template>
  <el-drawer
    v-model="visible"
    :title="isEdit ? '编辑竞品' : '新建竞品'"
    size="480px"
    destroy-on-close
    :aria-label="isEdit ? '编辑竞品表单' : '新建竞品表单'"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="92px" @submit.prevent>
      <el-form-item label="平台" prop="platform">
        <el-select v-model="form.platform" placeholder="选择平台" style="width: 100%">
          <el-option
            v-for="opt in platformOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="竞品名称" prop="name">
        <el-input v-model="form.name" placeholder="如 竞品A" aria-label="竞品名称" />
      </el-form-item>
      <el-form-item label="主页URL" prop="url">
        <el-input v-model="form.url" placeholder="竞品主页链接" aria-label="主页URL" />
      </el-form-item>
      <el-form-item label="分类/赛道" prop="category">
        <el-input v-model="form.category" placeholder="如 美妆" aria-label="分类/赛道" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
    </template>
  </el-drawer>
</template>
