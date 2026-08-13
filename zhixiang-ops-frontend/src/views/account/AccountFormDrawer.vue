<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import {
  createAccount,
  updateAccount,
  type AccountPayload,
  type AccountView,
} from '@/api/accounts'
import {
  identityOptions,
  platformOptions,
  stageOptions,
} from './accountMaps'

const props = defineProps<{
  modelValue: boolean
  // 编辑时传入已有账号；为空为新建
  account?: AccountView | null
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

// 表单数据（新建/编辑共用）
const form = reactive<AccountPayload & { id?: number }>({
  id: undefined,
  platform: 'douyin',
  platformAccountId: '',
  nickname: '',
  avatarUrl: '',
  identity: 'matrix',
  track: '',
  stage: 'nurturing',
  accessToken: '',
  refreshToken: '',
  tokenExpireAt: '',
  fansCount: 0,
  followCount: 0,
  likeCount: 0,
  remark: '',
})

function resetForm() {
  isEdit.value = !!props.account
  form.id = props.account?.id
  form.platform = props.account?.platform ?? 'douyin'
  form.platformAccountId = props.account?.platformAccountId ?? ''
  form.nickname = props.account?.nickname ?? ''
  form.avatarUrl = props.account?.avatarUrl ?? ''
  form.identity = props.account?.identity ?? 'matrix'
  form.track = props.account?.track ?? ''
  form.stage = props.account?.stage ?? 'nurturing'
  form.accessToken = ''
  form.refreshToken = ''
  form.tokenExpireAt = ''
  form.fansCount = props.account?.fansCount ?? 0
  form.followCount = props.account?.followCount ?? 0
  form.likeCount = props.account?.likeCount ?? 0
  form.remark = props.account?.remark ?? ''
  formRef.value?.clearValidate()
}

const rules: FormRules = {
  platform: [{ required: true, message: '请选择平台', trigger: 'change' }],
  platformAccountId: [
    { required: true, message: '请输入平台账号ID', trigger: 'blur' },
  ],
}

async function handleSubmit() {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    submitting.value = true
    try {
      // 只发送有值的字段，避免覆盖
      const payload: AccountPayload = {
        platform: form.platform,
        platformAccountId: form.platformAccountId,
      }
      if (form.nickname) payload.nickname = form.nickname
      if (form.avatarUrl) payload.avatarUrl = form.avatarUrl
      if (form.identity) payload.identity = form.identity
      if (form.track) payload.track = form.track
      if (form.stage) payload.stage = form.stage
      // 明文 token：仅在有值时发送，提示服务端加密；响应不回传
      if (form.accessToken) payload.accessToken = form.accessToken
      if (form.refreshToken) payload.refreshToken = form.refreshToken
      if (form.tokenExpireAt) payload.tokenExpireAt = form.tokenExpireAt
      payload.fansCount = Number(form.fansCount) || 0
      payload.followCount = Number(form.followCount) || 0
      payload.likeCount = Number(form.likeCount) || 0
      if (form.remark) payload.remark = form.remark

      if (isEdit.value && form.id != null) {
        await updateAccount(form.id, payload)
        ElMessage.success('更新成功')
      } else {
        await createAccount(payload)
        ElMessage.success('创建成功（Token 已加密存储）')
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
    :title="isEdit ? '编辑账号' : '新建账号'"
    size="480px"
    destroy-on-close
    :aria-label="isEdit ? '编辑账号表单' : '新建账号表单'"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="96px"
      @submit.prevent
    >
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
      <el-form-item label="平台账号ID" prop="platformAccountId">
        <el-input
          v-model="form.platformAccountId"
          placeholder="平台侧账号唯一ID"
          aria-label="平台账号ID"
        />
      </el-form-item>
      <el-form-item label="昵称">
        <el-input v-model="form.nickname" placeholder="选填" aria-label="昵称" />
      </el-form-item>
      <el-form-item label="头像URL">
        <el-input v-model="form.avatarUrl" placeholder="选填" aria-label="头像URL" />
      </el-form-item>
      <el-form-item label="身份">
        <el-select v-model="form.identity" style="width: 100%">
          <el-option
            v-for="opt in identityOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="赛道">
        <el-input v-model="form.track" placeholder="选填，如 美妆" aria-label="赛道" />
      </el-form-item>
      <el-form-item label="阶段">
        <el-select v-model="form.stage" style="width: 100%">
          <el-option
            v-for="opt in stageOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </el-form-item>

      <el-divider content-position="left">Token（明文入参，服务端加密）</el-divider>
      <el-alert
        type="warning"
        :closable="false"
        show-icon
        title="明文 Token 仅作入参，服务端 AES-256-GCM 加密存储，接口响应永不回传密文。"
        style="margin-bottom: 12px"
      />
      <el-form-item label="Access Token">
        <el-input
          v-model="form.accessToken"
          type="password"
          show-password
          placeholder="留空则不修改"
          aria-label="Access Token"
        />
      </el-form-item>
      <el-form-item label="Refresh Token">
        <el-input
          v-model="form.refreshToken"
          type="password"
          show-password
          placeholder="选填"
          aria-label="Refresh Token"
        />
      </el-form-item>
      <el-form-item label="Token过期">
        <el-date-picker
          v-model="form.tokenExpireAt"
          type="datetime"
          placeholder="选填"
          value-format="YYYY-MM-DDTHH:mm:ssZ"
          style="width: 100%"
          aria-label="Token过期时间"
        />
      </el-form-item>

      <el-divider content-position="left">数据快照</el-divider>
      <el-form-item label="粉丝数">
        <el-input-number v-model="form.fansCount" :min="0" style="width: 100%" />
      </el-form-item>
      <el-form-item label="关注数">
        <el-input-number v-model="form.followCount" :min="0" style="width: 100%" />
      </el-form-item>
      <el-form-item label="获赞数">
        <el-input-number v-model="form.likeCount" :min="0" style="width: 100%" />
      </el-form-item>
      <el-form-item label="备注">
        <el-input
          v-model="form.remark"
          type="textarea"
          :rows="2"
          placeholder="选填"
          aria-label="备注"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        保存
      </el-button>
    </template>
  </el-drawer>
</template>
