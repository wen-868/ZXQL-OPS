<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { ecommerceMenuGroups, globalCategories, videoMenuGroups } from '@/config/menu'

const route = useRoute()
const appStore = useAppStore()

const title = computed(() => {
  for (const g of [...videoMenuGroups, ...ecommerceMenuGroups]) {
    const item = g.children.find((c) => c.path === route.path)
    if (item) return item.title
  }
  for (const cat of globalCategories) {
    const item = cat.children.find((c) => c.path === route.path)
    if (item) return item.title
  }
  return (route.meta.title as string) || route.path
})

function runAI() {
  appStore.askAI(`请帮我处理「${title.value}」`)
}
</script>

<template>
  <section class="mod" aria-label="模块页">
    <div class="mod-head">
      <h2>{{ title }}</h2>
      <button type="button" class="btn primary" @click="runAI">用 AI 执行</button>
    </div>
    <div class="mod-body">
      这是 <span class="ph">{{ title }}</span> 模块。在此进行该域的精细操作；也可点击右上「用 AI 执行」或左侧
      <span class="ph">@AI</span> 把任务丢给 AI 端到端处理。
    </div>
  </section>
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
.btn {
  min-width: 88px;
  text-align: center;
  padding: 7px 14px;
  border-radius: 8px;
  border: 1px solid var(--app-neutral-200);
  background: var(--app-neutral-100);
  color: var(--app-neutral-800);
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
}
.btn.primary {
  background: var(--app-brand-500);
  border-color: var(--app-brand-500);
  color: #fff;
}
.mod-body {
  background: #fff;
  border: 1px solid var(--app-neutral-200);
  border-radius: var(--radius-lg);
  padding: 22px;
  color: var(--app-neutral-400);
  font-size: 14px;
  line-height: 1.9;
}
.ph {
  color: var(--app-neutral-800);
  font-weight: 600;
}
</style>
