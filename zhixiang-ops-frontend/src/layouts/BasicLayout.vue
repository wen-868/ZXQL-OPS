<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as ElIcons from '@element-plus/icons-vue'
import { Expand, Fold, Menu as MenuIcon, SwitchButton } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { menuGroups } from '@/config/menu'
import { useAppStore } from '@/stores/app'
import AiChatWidget from '@/components/ai-chat/AiChatWidget.vue'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()

const activeMenu = computed(() => route.path)
const collapsed = computed(() => appStore.sidebarCollapsed)
const userName = computed(() => appStore.user?.realName || appStore.user?.username || '未登录')
const pageTitle = computed(() => route.meta.title || '智享全链运营系统')

function resolveIcon(name?: string) {
  if (name && name in ElIcons) return (ElIcons as Record<string, unknown>)[name]
  return MenuIcon
}

function go(path: string) {
  if (path !== route.path) router.push(path)
}

function logout() {
  appStore.clearAuth()
  ElMessage.success('已退出登录')
  router.replace('/login')
}
</script>

<template>
  <div class="basic-layout">
    <!-- 侧边栏：窄版居中导航轨道 -->
    <aside
      class="layout-aside"
      :class="{ collapsed }"
      aria-label="主导航菜单"
    >
      <!-- 品牌区 -->
      <div class="brand" aria-label="智享全链运营系统">
        <span class="brand-mark" aria-hidden="true">智</span>
        <span v-show="!collapsed" class="brand-text">智享全链运营</span>
      </div>

      <!-- 菜单滚动区 -->
      <nav class="menu-scroll" aria-label="模块导航">
        <div
          v-for="group in menuGroups"
          :key="group.title"
          class="menu-group"
        >
          <div v-show="!collapsed" class="menu-group-title">
            {{ group.title }}
          </div>
          <ul class="menu-list">
            <li
              v-for="item in group.children"
              :key="item.path"
              class="menu-item"
              :class="{ active: activeMenu === item.path }"
              :aria-current="activeMenu === item.path ? 'page' : undefined"
            >
              <a
                href="javascript:void(0)"
                role="menuitem"
                :aria-label="item.title + (item.real ? '' : '（建设中）')"
                :title="collapsed ? item.title : ''"
                tabindex="0"
                @click="go(item.path)"
                @keydown.enter="go(item.path)"
              >
                <el-icon class="menu-item-icon">
                  <component :is="resolveIcon(item.icon)" />
                </el-icon>
                <span v-show="!collapsed" class="menu-item-text">{{
                  item.title
                }}</span>
              </a>
            </li>
          </ul>
        </div>
      </nav>

      <!-- 侧边栏底部署名 / 折叠入口 -->
      <button
        class="collapse-rail-btn"
        type="button"
        :aria-label="collapsed ? '展开侧边栏' : '收起侧边栏'"
        :title="collapsed ? '展开' : '收起'"
        @click="appStore.toggleSidebar()"
      >
        <el-icon><component :is="collapsed ? Expand : Fold" /></el-icon>
      </button>
    </aside>

    <!-- 主区域：顶部栏 + 内容区 -->
    <div class="layout-main">
      <header class="layout-header" role="banner">
        <h1 class="page-title">{{ pageTitle }}</h1>
        <div class="header-right">
          <span class="tenant-tag" :title="'当前租户标识'">
            租户：<strong>{{ appStore.tenantId }}</strong>
          </span>
          <span class="user-name" :title="userName">{{ userName }}</span>
          <button
            class="logout-btn"
            type="button"
            title="退出登录"
            aria-label="退出登录"
            @click="logout"
          >
            <el-icon><SwitchButton /></el-icon>
          </button>
        </div>
      </header>
      <main class="layout-content" role="main" aria-label="内容区域">
        <div class="content-shell">
          <router-view v-slot="{ Component }">
            <component :is="Component" />
          </router-view>
        </div>
      </main>
      <!-- AI 助手浮动对话框 -->
      <AiChatWidget />
    </div>
  </div>
</template>

<style scoped>
/* ========================================
   布局根容器
   ======================================== */
.basic-layout {
  display: flex;
  height: 100vh;
  background: var(--el-bg-color-page);
}

/* ========================================
   侧边栏 —— 窄版居中导航轨道
   ======================================== */
.layout-aside {
  width: var(--sidebar-expanded-w);       /* 208px */
  background: var(--sidebar-bg);
  color: var(--sidebar-text);
  display: flex;
  flex-direction: column;
  transition: width var(--duration-normal) var(--ease-in-out);
  flex-shrink: 0;
  overflow: hidden;
  position: relative;
  border-right: 1px solid var(--sidebar-divider);
}

.layout-aside.collapsed {
  width: var(--sidebar-collapsed-w);      /* 72px */
}

/* 品牌区 —— 居中 */
.brand {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: 0 var(--space-3);
  flex-shrink: 0;
}

.brand-mark {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, var(--app-brand-500), var(--app-brand-700));
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-sm);
}

.brand-text {
  font-weight: 700;
  font-size: var(--text-md);
  color: var(--app-neutral-800);
  white-space: nowrap;
  overflow: hidden;
}

/* 菜单滚动区 */
.menu-scroll {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-2) 0;
  scrollbar-width: thin;
}

/* 菜单分组 */
.menu-group {
  margin-bottom: var(--space-2);
}

.menu-group-title {
  padding: var(--space-4) 0 var(--space-2);
  font-size: var(--text-xs);
  color: var(--sidebar-group-title);
  letter-spacing: 1px;
  text-transform: uppercase;
  text-align: center;
  white-space: nowrap;
}

/* 菜单列表 */
.menu-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

/* 菜单项 —— 居中胶囊 */
.menu-item a {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;       /* 图标+文字整体居中 */
  gap: var(--sidebar-item-gap);
  height: 40px;
  margin: 2px var(--sidebar-item-inset-x);
  padding: 0 var(--space-3);
  border-radius: var(--sidebar-item-radius);
  color: var(--sidebar-text);
  text-decoration: none;
  font-size: var(--text-base);
  cursor: pointer;
  outline: none;
  transition: background-color var(--duration-fast) var(--ease-out),
              color var(--duration-fast) var(--ease-out);
}

/* 悬浮态 */
.menu-item a:hover,
.menu-item a:focus-visible {
  background: var(--sidebar-item-hover);
  color: var(--sidebar-text-hover);
}

/* 选中态 —— 柔和主色胶囊 + 左侧指示条 */
.menu-item.active a {
  background: var(--sidebar-item-active);
  color: var(--sidebar-text-active);
  font-weight: 600;
}

.menu-item.active a::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 18px;
  border-radius: 2px;
  background: var(--sidebar-active-bar);
}

/* 收起态：仅图标居中轨道 */
.layout-aside.collapsed .menu-item a {
  margin: 2px var(--space-2);
  padding: 0;
  gap: 0;
}

/* 图标 */
.menu-item-icon {
  font-size: var(--sidebar-icon-size);
  flex-shrink: 0;
}

/* 菜单项文字 */
.menu-item-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 侧边栏底部折叠入口 */
.collapse-rail-btn {
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--app-neutral-400);
  height: 44px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  border-top: 1px solid var(--sidebar-divider);
  transition: color var(--duration-fast) var(--ease-out),
              background-color var(--duration-fast) var(--ease-out);
}

.collapse-rail-btn:hover {
  color: var(--app-brand-600);
  background: var(--sidebar-item-hover);
}

/* ========================================
   主区域
   ======================================== */
.layout-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* ========================================
   顶部栏
   ======================================== */
.layout-header {
  height: 56px;
  background: var(--app-neutral-0);
  border-bottom: 1px solid var(--app-neutral-200);
  box-shadow: var(--shadow-sm);
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 0 var(--space-6);
  flex-shrink: 0;
}

/* 页面标题 */
.page-title {
  font-size: var(--text-md);
  font-weight: 600;
  margin: 0;
  color: var(--app-neutral-800);
}

/* 右侧区域 */
.header-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

/* 租户标签 */
.tenant-tag {
  font-size: var(--text-base-sm);
  color: var(--app-neutral-500);
}

.tenant-tag strong {
  color: var(--app-brand-600);
  font-weight: 600;
}

/* 用户名 */
.user-name {
  font-size: var(--text-base-sm);
  color: var(--app-neutral-700);
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 退出按钮 */
.logout-btn {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 18px;
  color: var(--app-neutral-400);
  padding: var(--space-1);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color var(--duration-fast) var(--ease-out),
              background-color var(--duration-fast) var(--ease-out);
}

.logout-btn:hover {
  color: var(--app-danger-500);
  background: var(--app-danger-50);
}

/* ========================================
   内容区
   ======================================== */
.layout-content {
  flex: 1;
  overflow-y: auto;
}

/* 内容壳：最大宽度居中，形成聚焦阅读区 */
.content-shell {
  max-width: var(--page-max-width);
  margin: 0 auto;
  padding: var(--content-padding);
}
</style>
