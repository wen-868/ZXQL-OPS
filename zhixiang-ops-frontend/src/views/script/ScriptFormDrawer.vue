<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { ElMessage, type FormInstance } from 'element-plus'
import {
  updateScript,
  type Script,
  type ScriptUpdatePayload,
  type TrackItem,
} from '@/api/script'
import {
  emotionOptions,
  allowedScriptStatusOptions,
  scriptStatusMeta,
} from './scriptMaps'

const props = defineProps<{ modelValue: boolean; script: Script | null }>()
const emit = defineEmits<{
  'update:modelValue': [boolean]
  saved: []
}>()

const visible = ref(props.modelValue)
watch(
  () => props.modelValue,
  (v) => {
    visible.value = v
    if (v && props.script) syncForm(props.script)
  },
)
watch(visible, (v) => emit('update:modelValue', v))

const formRef = ref<FormInstance>()
const submitting = ref(false)
const form = reactive<{
  title: string
  content: string
  hook: string
  hookEmotion: string
  spokenText: string
  subtitleText: string
  templateId: string
  status: Script['status']
}>({
  title: '',
  content: '',
  hook: '',
  hookEmotion: '',
  spokenText: '',
  subtitleText: '',
  templateId: '',
  status: 'draft',
})

const statusOpts = ref<{ value: Script['status']; label: string }[]>([])

function syncForm(s: Script) {
  form.title = s.title
  form.content = s.content
  form.hook = s.hook
  form.hookEmotion = s.hookEmotion
  form.spokenText = (s.spokenTrack || []).map((t) => t.text).join('\n')
  form.subtitleText = (s.subtitleTrack || []).map((t) => t.text).join('\n')
  form.templateId = s.templateId || ''
  form.status = s.status
  statusOpts.value = allowedScriptStatusOptions(s.status)
}

// 将纯文本轨道转为 TrackItem[]（tsStart/tsEnd 占位顺序递增）
function parseTrack(text: string): TrackItem[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((t, i) => ({ tsStart: i, tsEnd: i + 1, text: t }))
}

function buildPayload(): ScriptUpdatePayload {
  const payload: ScriptUpdatePayload = {
    title: form.title,
    content: form.content,
    hook: form.hook,
    hookEmotion: form.hookEmotion || undefined,
    templateId: form.templateId || undefined,
    status: form.status,
  }
  const spoken = parseTrack(form.spokenText)
  const subtitle = parseTrack(form.subtitleText)
  if (spoken.length) payload.spokenTrack = spoken
  if (subtitle.length) payload.subtitleTrack = subtitle
  return payload
}

async function handleSubmit() {
  if (!formRef.value || !props.script) return
  submitting.value = true
  try {
    await updateScript(props.script.id, buildPayload())
    ElMessage.success('脚本已更新')
    visible.value = false
    emit('saved')
  } catch {
    // 拦截器已提示（含非法状态流转 400）
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-drawer
    v-model="visible"
    title="编辑脚本"
    size="480px"
    destroy-on-close
    aria-label="编辑脚本抽屉"
  >
    <el-form ref="formRef" :model="form" label-width="88px" @submit.prevent>
      <el-form-item label="标题">
        <el-input v-model="form.title" placeholder="脚本标题" aria-label="脚本标题" />
      </el-form-item>
      <el-form-item label="正文">
        <el-input
          v-model="form.content"
          type="textarea"
          :rows="6"
          placeholder="脚本正文"
          aria-label="脚本正文"
        />
      </el-form-item>
      <el-form-item label="钩子">
        <el-input v-model="form.hook" placeholder="开场钩子文案" aria-label="钩子文案" />
      </el-form-item>
      <el-form-item label="钩子情绪">
        <el-select v-model="form.hookEmotion" placeholder="可选" clearable style="width: 100%" aria-label="钩子情绪">
          <el-option v-for="opt in emotionOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="口播稿">
        <el-input
          v-model="form.spokenText"
          type="textarea"
          :rows="4"
          placeholder="每行一句口播（按回车换行）"
          aria-label="口播稿"
        />
      </el-form-item>
      <el-form-item label="字幕">
        <el-input
          v-model="form.subtitleText"
          type="textarea"
          :rows="4"
          placeholder="每行一句字幕（按回车换行）"
          aria-label="字幕"
        />
      </el-form-item>
      <el-form-item label="模板">
        <el-input v-model="form.templateId" placeholder="可选，模板 id" aria-label="模板ID" clearable />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="form.status" style="width: 100%" aria-label="脚本状态">
          <el-option
            v-for="opt in statusOpts"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
        <div class="status-tip">
          当前：<el-tag :type="scriptStatusMeta[form.status].type" size="small">
            {{ scriptStatusMeta[form.status].label }}
          </el-tag>
        </div>
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
