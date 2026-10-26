<script setup lang="ts">
// 根组件：承载路由出口 + Element Plus 全局配置。
// Element Plus 改为自动按需后，全局 locale 不再由 app.use(ElementPlus, { locale }) 注入，
// 改由 ElConfigProvider 在根节点下发，保证 date-picker 等组件中文文案不回退英文。
import zhCn from 'element-plus/es/locale/lang/zh-cn'
</script>

<template>
  <el-config-provider :locale="zhCn">
    <router-view />
  </el-config-provider>
</template>
