<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const title = computed(() => (route.meta.title as string) || route.path)
</script>

<template>
  <section class="placeholder" aria-label="模块建设中">
    <el-empty :image-size="120" description="">
      <template #description>
        <p class="ph-title">{{ title }}</p>
        <p class="ph-tip">该模块将在后续增量中实现。</p>
      </template>
    </el-empty>
  </section>
</template>

<style scoped>
.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
}
.ph-title {
  font-size: var(--text-md);
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 0 0 var(--space-1);
}
.ph-tip {
  font-size: var(--text-base);
  color: var(--el-text-color-secondary);
  margin: 0;
}
</style>
