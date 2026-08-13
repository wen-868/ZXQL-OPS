<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock, Key, MagicStick } from '@element-plus/icons-vue'
import { login, register, demoLogin, type LoginResult } from '@/api/auth'
import { getSystemStatus } from '@/api/system'
import type { SystemStatus } from '@/api/system'
import { useAppStore } from '@/stores/app'

const router = useRouter()
const route = useRoute()
const appStore = useAppStore()
const isRegistering = ref(false)
const loading = ref(false)
const demoLoading = ref(false)
const status = ref<SystemStatus | null>(null)

const form = reactive({
  username: '',
  password: '',
  realName: '',
})

onMounted(async () => {
  try {
    status.value = await getSystemStatus()
  } catch {
    // 状态接口不可达时静默（不影响常规登录）
  }
})

async function enter(result: { token: string; user: LoginResult['user'] }) {
  appStore.setAuth(result.token, result.user)
  const redirect = (route.query.redirect as string) || '/accounts'
  router.replace(redirect)
}

async function submit() {
  if (!form.username.trim() || !form.password.trim()) {
    ElMessage.warning('请填写用户名和密码')
    return
  }
  loading.value = true
  try {
    const api = isRegistering.value ? register : login
    const payload = isRegistering.value
      ? { username: form.username, password: form.password, realName: form.realName || undefined }
      : { username: form.username, password: form.password }
    const result = await api(payload)
    await enter(result)
    ElMessage.success(isRegistering.value ? '注册成功' : '登录成功')
  } catch {
    // 错误已在 request 拦截器中处理
  } finally {
    loading.value = false
  }
}

/** 演示登录：免密一键进入演示环境 */
async function handleDemoLogin() {
  demoLoading.value = true
  try {
    const result = await demoLogin()
    await enter(result)
    ElMessage.success('已进入演示环境')
  } catch {
    // 演示模式未开启或演示数据异常，错误已在拦截器提示
  } finally {
    demoLoading.value = false
  }
}

function toggleMode() {
  isRegistering.value = !isRegistering.value
  form.password = ''
}
</script>

<template>
  <div class="login-page">
    <!-- 登录卡片 -->
    <div class="login-card animate-fade-in-up">
      <!-- 品牌头部 -->
      <div class="login-header">
        <h1 class="login-title">智享全链运营系统</h1>
        <p class="login-subtitle">
          {{ isRegistering ? '创建管理员账号' : '运营管理后台' }}
        </p>
      </div>

      <!-- 表单 -->
      <form class="login-form" @submit.prevent="submit">
        <div class="form-field">
          <el-input
            v-model="form.username"
            placeholder="用户名"
            size="large"
            :prefix-icon="User"
            aria-label="用户名"
          />
        </div>
        <div class="form-field">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="密码"
            size="large"
            :prefix-icon="Lock"
            show-password
            aria-label="密码"
          />
        </div>
        <div v-if="isRegistering" class="form-field">
          <el-input
            v-model="form.realName"
            placeholder="显示名（可选）"
            size="large"
            :prefix-icon="Key"
            aria-label="显示名"
          />
        </div>
        <el-button
          type="primary"
          size="large"
          :loading="loading"
          class="submit-btn"
          native-type="submit"
        >
          {{ isRegistering ? '注册' : '登录' }}
        </el-button>

        <!-- 演示登录：免账号密码一键进入（仅演示模式开启时显示） -->
        <el-button
          v-if="status?.demoMode"
          size="large"
          class="submit-btn demo-btn"
          :icon="MagicStick"
          :loading="demoLoading"
          @click="handleDemoLogin"
        >
          演示登录（免账号密码）
        </el-button>
      </form>

      <!-- 底部切换链接 -->
      <div class="login-footer">
        <a href="javascript:void(0)" class="toggle-link" @click="toggleMode">
          {{ isRegistering ? '已有账号？去登录' : '没有账号？立即注册' }}
        </a>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ========================================
   登录页容器：全屏深色渐变背景 + 几何点阵
   ======================================== */
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--app-neutral-50);
  /* 对齐 ZXQL-MS「白底黑字」：浅灰底 + 极淡主色径向光晕，无深色渐变 */
  background-image:
    radial-gradient(circle at 20% 20%, var(--app-brand-50) 0%, transparent 40%),
    radial-gradient(circle at 80% 80%, var(--app-brand-100) 0%, transparent 45%);
  padding: var(--space-4);
}

/* ========================================
   登录卡片
   ======================================== */
.login-card {
  width: 100%;
  max-width: 400px;
  background: var(--app-neutral-0);
  border-radius: var(--radius-2xl);        /* 16px */
  padding: var(--space-10) var(--space-8); /* 40px 32px */
  box-shadow: var(--shadow-xl);
}

/* 入场动画：从下方淡入 */
.animate-fade-in-up {
  animation: fade-in-up var(--duration-slow) var(--ease-spring) both;
}

@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ========================================
   品牌头部
   ======================================== */
.login-header {
  text-align: center;
  margin-bottom: var(--space-8);           /* 32px */
}

.login-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--app-neutral-800);
  margin: 0 0 var(--space-2);
}

.login-subtitle {
  font-size: var(--text-base-sm);          /* 13px */
  color: var(--app-neutral-500);
  margin: 0;
}

/* ========================================
   表单
   ======================================== */
.login-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);                     /* 16px */
}

/* 提交按钮：全宽、大尺寸 */
.submit-btn {
  width: 100%;
  margin-top: var(--space-1);              /* 4px */
}

/* 演示登录按钮：次要描边样式，与主导航按钮区分 */
.demo-btn {
  margin-top: var(--space-2);              /* 8px */
  color: var(--app-brand-600);
  border-color: var(--app-brand-300);
  background: var(--app-brand-50);
}

.demo-btn:hover {
  color: var(--app-brand-700);
  border-color: var(--app-brand-500);
  background: var(--app-brand-100);
}

/* ========================================
   底部切换链接
   ======================================== */
.login-footer {
  text-align: center;
  margin-top: var(--space-5);              /* 20px */
}

.toggle-link {
  font-size: var(--text-base-sm);          /* 13px */
  color: var(--app-brand-600);
  text-decoration: none;
  transition: color var(--duration-fast) var(--ease-out);
}

.toggle-link:hover {
  color: var(--app-brand-700);
  text-decoration: underline;
}
</style>
