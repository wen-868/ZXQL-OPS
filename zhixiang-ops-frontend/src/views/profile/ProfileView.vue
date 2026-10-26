<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()
const tenantId = computed(() => appStore.tenantId || 'T_REDSTAR_001')
const userName = computed(() => appStore.user?.realName || appStore.user?.username || '红星商行')

// 席位使用情况（UI 原型：12/30 已用/总额）
const seatUsed = 12
const seatTotal = 30
const seatRate = computed(() => Math.round((seatUsed / seatTotal) * 100))

// 子租户 / 分支（UI 原型演示数据）
const branches = [
  { name: '红星直营店 · 朝阳大悦城', sku: 1280 },
  { name: '红星直营店 · 西直门凯德', sku: 980 },
  { name: '红星经销商 · 海淀', sku: 460 },
]
</script>

<template>
  <div class="profile-page">
    <div class="mod-head">
      <h2>个人中心 / 租户信息</h2>
      <span class="hint">仅本人 / 管理员可见</span>
    </div>
    <div class="panel">
      <h3>当前租户 <span class="tag">自有 · 主租户</span></h3>
      <dl class="kv">
        <dt>租户名称</dt>
        <dd>{{ userName }}</dd>
        <dt>租户编码</dt>
        <dd class="mono">{{ tenantId }}</dd>
        <dt>套餐</dt>
        <dd>企业版 · 含短视频运营 + 电商运营</dd>
        <dt>席位</dt>
        <dd>
          <div class="seat">
            <div class="seat-bar"><span class="seat-fill" :style="{ width: `${seatRate}%` }" /></div>
            <span class="seat-text">{{ seatUsed }}/{{ seatTotal }}（已用/总额）</span>
          </div>
        </dd>
        <dt>数据隔离</dt>
        <dd>本租户独立知识库 / 独立记忆 / 独立向量空间</dd>
        <dt>默认模型</dt>
        <dd>Hy3（本地 Ollama · qwen2.5:7b）</dd>
        <dt>服务部署</dt>
        <dd>本地打包（暂未独立部署服务器）</dd>
        <dt>到期日</dt>
        <dd class="mono">2027-08-27</dd>
      </dl>
    </div>

    <div class="panel branches">
      <h3>子租户 / 分支 <span class="tag">共 {{ branches.length }} 个</span></h3>
      <div class="branch-list">
        <div v-for="b in branches" :key="b.name" class="branch">
          <span class="branch-ic">🏬</span>
          <span class="branch-name">{{ b.name }}</span>
          <span class="branch-sku">SKU {{ b.sku }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mod-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.mod-head h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}
.hint {
  font-size: 12px;
  color: var(--app-neutral-400);
}
.panel {
  max-width: 780px;
  background: var(--app-neutral-0);
  border: 1px solid var(--app-neutral-200);
  border-radius: var(--radius-lg);
  padding: 16px;
  margin-bottom: 16px;
}
.panel h3 {
  font-size: 14px;
  margin: 0 0 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.tag {
  font-size: 11px;
  color: var(--app-neutral-400);
  font-weight: 400;
}
.kv {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: 10px 22px;
  font-size: 13px;
  line-height: 1.9;
  margin: 0;
}
.kv dt {
  color: var(--app-neutral-400);
}
.kv dd {
  margin: 0;
}
.mono {
  font-family: var(--font-mono);
}
.seat {
  display: flex;
  align-items: center;
  gap: 10px;
}
.seat-bar {
  width: 120px;
  height: 8px;
  border-radius: 4px;
  background: var(--app-neutral-200);
  overflow: hidden;
}
.seat-fill {
  display: block;
  height: 100%;
  background: var(--app-brand-500);
  border-radius: 4px;
}
.seat-text {
  font-size: 12px;
  color: var(--app-neutral-400);
}
.branch-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.branch {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--app-neutral-100);
  border-radius: 8px;
  font-size: 13px;
}
.branch-ic {
  font-size: 16px;
}
.branch-name {
  flex: 1;
}
.branch-sku {
  font-size: 12px;
  color: var(--app-brand-600);
  font-weight: 600;
}
</style>
