<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Fold } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import {
  ecommerceMenuGroups,
  globalCategories,
  videoMenuGroups,
  type MenuGroup,
  type MenuItem,
} from '@/config/menu'
import { useAppStore } from '@/stores/app'
import AiChatWidget from '@/components/ai-chat/AiChatWidget.vue'
import TaskPanel from '@/components/workspace/TaskPanel.vue'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()

const VIDEO_PATHS = new Set(videoMenuGroups.flatMap((g) => g.children.map((c) => c.path)))
const ECO_PATHS = new Set(ecommerceMenuGroups.flatMap((g) => g.children.map((c) => c.path)))

const board = ref<'video' | 'ecommerce'>('video')
const menuOpen = ref(false)
const collapsedGroups = ref<Record<string, boolean>>({})
const genOpen = ref<string | null>(null)
const aiOpen = ref(true)

interface ModuleTab {
  path: string
  title: string
  group: string
}
// 注意：必须先于下方 immediate watch 声明，否则 ensureModuleTab 触发 TDZ 错误
const moduleTabs = ref<ModuleTab[]>([])

watch(
  () => route.path,
  (p) => {
    // 导航离开当前视图时取消激活任务，避免任务面板遮住目标页面（点任务标签可重新激活）
    if (appStore.activeTaskId !== null) appStore.openTask(null)
    if (ECO_PATHS.has(p)) board.value = 'ecommerce'
    else if (VIDEO_PATHS.has(p)) board.value = 'video'
    ensureModuleTab(p)
  },
  { immediate: true },
)
watch(
  () => appStore.aiTask,
  (v) => {
    if (v) aiOpen.value = true
  },
)

const activeMenu = computed(() => route.path)
const activeGroups = computed<MenuGroup[]>(() =>
  board.value === 'video' ? videoMenuGroups : ecommerceMenuGroups,
)
const activeTask = computed(
  () => appStore.tasks.find((t) => t.id === appStore.activeTaskId) ?? null,
)

const aiWidget = ref<InstanceType<typeof AiChatWidget> | null>(null)

function findMenuMeta(path: string): { title: string; group: string; board?: string } | null {
  for (const g of videoMenuGroups) {
    const item = g.children.find((c) => c.path === path)
    if (item) return { title: item.title, group: g.title, board: '短视频运营' }
  }
  for (const g of ecommerceMenuGroups) {
    const item = g.children.find((c) => c.path === path)
    if (item) return { title: item.title, group: g.title, board: '电商运营' }
  }
  for (const cat of globalCategories) {
    const item = cat.children.find((c) => c.path === path)
    if (item) return { title: item.title, group: cat.title, board: '通用' }
  }
  if (path === '/home') return { title: '运营总览', group: '', board: '' }
  return null
}

function ensureModuleTab(path: string) {
  if (path === '/home' || path === '/' || path === '/login') return
  const meta = findMenuMeta(path)
  if (!meta) return
  if (!moduleTabs.value.some((t) => t.path === path)) {
    moduleTabs.value.push({ path, title: meta.title, group: meta.group })
  }
}

function closeModuleTab(path: string) {
  moduleTabs.value = moduleTabs.value.filter((t) => t.path !== path)
  if (route.path === path) {
    const last = moduleTabs.value[moduleTabs.value.length - 1]
    router.push(last?.path || '/home')
  }
}

function go(path: string) {
  menuOpen.value = false
  genOpen.value = null
  if (path !== route.path) router.push(path)
}

function goOverview() {
  appStore.openTask(null)
  go('/home')
}

function askAI(item: MenuItem) {
  menuOpen.value = false
  aiOpen.value = true
  aiWidget.value?.openWithPrompt(item.aiPrompt || `请帮我处理「${item.title}」`)
}

function toggleGroup(title: string) {
  collapsedGroups.value = { ...collapsedGroups.value, [title]: !collapsedGroups.value[title] }
}

function onDocClick(e: MouseEvent) {
  const t = e.target as HTMLElement
  if (!t.closest('.genbar')) genOpen.value = null
}

onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))
</script>

<template>
  <div class="app-shell">
    <aside
      class="sidebar"
      :class="{ collapsed: appStore.sidebarCollapsed, 'aside-open': menuOpen }"
      aria-label="板块导航"
    >
      <div class="brand">
        <div class="logo">智</div>
        <div>
          <div class="name">智享全链</div>
          <div class="sub">运营工作台</div>
        </div>
      </div>
      <div class="board-tab" role="tablist" aria-label="运营板块切换">
        <button
          type="button"
          role="tab"
          :class="{ active: board === 'video' }"
          :aria-selected="board === 'video'"
          @click="board = 'video'"
        >
          短视频运营
        </button>
        <button
          type="button"
          role="tab"
          :class="{ active: board === 'ecommerce' }"
          :aria-selected="board === 'ecommerce'"
          @click="board = 'ecommerce'"
        >
          电商运营
        </button>
      </div>
      <div class="nav-scroll">
        <div
          v-for="group in activeGroups"
          :key="group.title"
          class="group"
          :class="{ collapsed: collapsedGroups[group.title] }"
        >
          <div class="ghead" @click="toggleGroup(group.title)">
            <span>{{ group.title }}</span>
            <span class="arrow" aria-hidden="true">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
            </span>
          </div>
          <ul>
            <li
              v-for="item in group.children"
              :key="item.title + item.path"
              :class="{ active: activeMenu === item.path }"
              @click="go(item.path)"
            >
              <span>{{ item.title }}</span>
              <span
                class="ai-tag"
                title="交给 AI"
                @click.stop="askAI(item)"
              >@AI</span>
            </li>
          </ul>
        </div>
      </div>
      <div class="genbar">
        <div v-for="cat in globalCategories" :key="cat.title" class="gen-wrap">
          <button type="button" @click.stop="genOpen = genOpen === cat.title ? null : cat.title">
            {{ cat.title }}
          </button>
          <div v-if="genOpen === cat.title" class="gen-menu">
            <button
              v-for="item in cat.children"
              :key="item.path + item.title"
              type="button"
              @click="go(item.path)"
            >
              {{ item.title }}
            </button>
          </div>
        </div>
      </div>
    </aside>

    <!-- 主工作区：原型 order:2（AI dock 默认中置 order:1） -->
    <section class="main" :class="{ 'ws-hidden': !appStore.workspaceOpen }">
      <div class="work-top">
        <button
          type="button"
          class="menu-btn mobile-only"
          :aria-label="menuOpen ? '收起导航' : '展开导航'"
          @click="menuOpen = !menuOpen"
        >
          <el-icon :size="18"><Fold /></el-icon>
        </button>
        <div class="tabs" role="tablist" aria-label="工作区标签">
          <button
            type="button"
            class="tab-item"
            :class="{ active: !activeTask && route.path === '/home' }"
            @click="goOverview"
          >
            运营总览
          </button>
          <button
            v-for="tab in moduleTabs"
            :key="tab.path"
            type="button"
            class="tab-item"
            :class="{ active: !activeTask && route.path === tab.path }"
            @click="appStore.openTask(null); go(tab.path)"
          >
            {{ tab.title }}
            <span class="x" @click.stop="closeModuleTab(tab.path)">✕</span>
          </button>
          <button
            v-for="t in appStore.tasks"
            :key="t.id"
            type="button"
            class="tab-item"
            :class="{ active: appStore.activeTaskId === t.id }"
            @click="appStore.openTask(t.id)"
          >
            <span class="dot" :class="t.status" />
            {{ t.title }}
            <span class="x" @click.stop="appStore.closeTask(t.id)">✕</span>
          </button>
        </div>
        <div class="topright">
          <button
            class="icon-btn ws-toggle"
            type="button"
            title="收起工作区"
            @click="appStore.toggleWorkspace()"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M15 4v16" /><path d="M18 9l2 2-2 2" /></svg>
          </button>
        </div>
      </div>

      <div class="workspace">
        <TaskPanel
          v-if="activeTask"
          :task="activeTask"
          :board="board"
          @completed="activeTask.stepIndex = 5; activeTask.status = 'done'"
          @confirm="activeTask.status = 'done'; ElMessage.success('真实自动化链执行完成')"
          @reject="activeTask.status = 'running'; ElMessage.info('已驳回，请人工调整后再提交')"
        />
        <router-view v-else v-slot="{ Component }">
          <component :is="Component" />
        </router-view>
      </div>
    </section>

    <!-- AI 对话区：原型 order:1 中置；收起工作区后 full 铺满 -->
    <AiChatWidget
      v-show="aiOpen"
      ref="aiWidget"
      class="ai-dock"
      :class="{ full: !appStore.workspaceOpen }"
    />
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: var(--app-neutral-50);
  color: var(--app-neutral-800);
}
.app-shell :deep(.ai-chat-root) {
  order: 1;
}
.app-shell :deep(.ai-chat-root.full) {
  width: auto;
  flex: 1;
  min-width: 0;
}

.sidebar {
  width: var(--sidebar-expanded-w);
  background: var(--sidebar-bg);
  border-right: 1px solid var(--sidebar-divider);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: width 0.2s ease, border-color 0.2s ease;
  overflow: hidden;
}
.sidebar.collapsed {
  width: 0;
  border-right: none;
}
.brand {
  /* border-box 48px：与 AI 头 / 工作区顶栏底线对齐（项目无全局 border-box） */
  box-sizing: border-box;
  height: 48px;
  flex-shrink: 0;
  padding: 0 14px;
  display: flex;
  align-items: center;
  gap: 9px;
  border-bottom: 1px solid var(--sidebar-divider);
  white-space: nowrap;
}
.logo {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: linear-gradient(135deg, #3b82f6, #22c55e);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: #fff;
  font-size: 15px;
  flex-shrink: 0;
}
.name {
  font-weight: 600;
  font-size: 15px;
  letter-spacing: 0.3px;
}
.sub {
  font-size: 11px;
  color: var(--app-neutral-400);
  margin-top: 1px;
}

.board-tab {
  display: flex;
  gap: 6px;
  padding: 12px 14px 6px;
}
.board-tab button {
  flex: 1;
  padding: 9px 0;
  border: 1px solid var(--app-neutral-200);
  background: transparent;
  color: var(--app-neutral-400);
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
}
.board-tab button.active {
  background: var(--app-brand-500);
  color: #fff;
  border-color: var(--app-brand-500);
}
.board-tab button:hover:not(.active) {
  border-color: var(--app-brand-500);
  color: var(--app-neutral-800);
}

.nav-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}
.group {
  margin-bottom: 6px;
}
.ghead {
  padding: 9px 10px;
  font-size: 12px;
  color: var(--app-neutral-400);
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  border-radius: 6px;
  white-space: nowrap;
}
.ghead:hover {
  color: var(--app-neutral-800);
}
.arrow {
  transition: 0.2s;
  display: inline-flex;
}
.group.collapsed .arrow {
  transform: rotate(-90deg);
}
.group ul {
  list-style: none;
  margin: 2px 0 6px;
  padding: 0;
}
.group.collapsed ul {
  display: none;
}
.group li {
  padding: 8px 12px 8px 22px;
  font-size: 13px;
  color: var(--app-neutral-800);
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  white-space: nowrap;
}
.group li:hover {
  background: var(--sidebar-item-hover);
}
.group li.active {
  background: var(--sidebar-item-active);
  color: var(--sidebar-text-active);
}
.ai-tag {
  font-size: 10px;
  color: var(--app-brand-500);
  border: 1px solid var(--app-brand-500);
  border-radius: 5px;
  padding: 1px 6px;
  background: #fff;
}
.group li.active .ai-tag {
  color: #fff;
  border-color: #fff;
  background: transparent;
}
.ai-tag:hover {
  background: var(--app-brand-500);
  color: #fff;
}

.genbar {
  border-top: 1px solid var(--sidebar-divider);
  padding: 8px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  position: relative;
}
.gen-wrap {
  position: relative;
}
.genbar button {
  width: 100%;
  padding: 8px 2px;
  font-size: 11px;
  background: var(--app-neutral-100);
  border: 1px solid var(--app-neutral-200);
  color: var(--app-neutral-800);
  border-radius: 8px;
  cursor: pointer;
}
.genbar > .gen-wrap > button:hover,
.gen-menu button:hover {
  border-color: var(--app-brand-500);
}
.gen-menu {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 100%;
  margin-bottom: 6px;
  background: #fff;
  border: 1px solid var(--app-neutral-200);
  border-radius: 8px;
  box-shadow: var(--shadow-lg);
  z-index: 20;
  padding: 4px;
}
.gen-menu button {
  display: block;
  text-align: left;
  padding: 8px 10px;
  font-size: 12px;
  background: transparent;
  border: none;
  border-radius: 6px;
}

.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  order: 2;
}
.main.ws-hidden {
  display: none;
}
.work-top {
  box-sizing: border-box;
  height: 48px;
  border-bottom: 1px solid var(--app-neutral-200);
  display: flex;
  align-items: stretch;
  padding: 0 14px;
  flex-shrink: 0;
  background: #fff;
  gap: 8px;
}
.tabs {
  flex: 1;
  display: flex;
  align-items: flex-end;
  gap: 2px;
  overflow-x: auto;
  min-width: 0;
  align-self: stretch;
  scrollbar-width: none;
}
.tabs::-webkit-scrollbar {
  width: 0;
  height: 0;
}
.tab-item {
  flex: 1 1 0;
  min-width: 96px;
  max-width: 200px;
  padding: 0 12px;
  font-size: 13px;
  color: var(--app-neutral-400);
  border: 1px solid transparent;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  border-radius: 8px 8px 0 0;
  position: relative;
  background: transparent;
  font-family: inherit;
  transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
}
.tab-item:hover:not(.active) {
  color: var(--app-neutral-800);
  background: var(--app-neutral-50);
}
/* 激活：白底连通页签 + 顶部品牌色细线 */
.tab-item.active {
  background: #fff;
  color: var(--app-brand-500);
  border-color: var(--app-neutral-200);
  border-bottom-color: transparent;
  box-shadow: 0 1px 0 0 #fff;
  z-index: 2;
  font-weight: 500;
}
.tab-item.active::before {
  content: '';
  position: absolute;
  top: 0;
  left: 10px;
  right: 10px;
  height: 2px;
  border-radius: 2px 2px 0 0;
  background: var(--app-brand-500);
}
.tab-item .x {
  font-size: 12px;
  line-height: 1;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.45;
  flex-shrink: 0;
  transition: all 0.15s ease;
}
.tab-item .x:hover {
  opacity: 1;
  color: #fff;
  background: var(--app-danger-500);
}
.tab-item .title {
  overflow: hidden;
  text-overflow: ellipsis;
}
.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--app-warning-500);
  flex-shrink: 0;
}
.dot.running {
  animation: dot-pulse 1.6s ease-in-out infinite;
}
@keyframes dot-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(217, 119, 6, 0.35); }
  50% { box-shadow: 0 0 0 4px rgba(217, 119, 6, 0); }
}
.dot.pending_confirm {
  background: var(--app-brand-500);
}
.dot.done {
  background: var(--app-success-500);
}

.topright {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  align-self: stretch;
  border-left: 1px solid var(--app-neutral-200);
  padding-left: 12px;
}
.icon-btn {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--app-neutral-400);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.icon-btn svg {
  width: 17px;
  height: 17px;
}
.icon-btn:hover {
  color: var(--app-brand-500);
}
.icon-btn.active {
  color: #fff;
  background: var(--app-brand-500);
}

.workspace {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: var(--app-neutral-50);
}

.mobile-only {
  display: none;
}

@media (max-width: 768px) {
  .mobile-only {
    display: inline-flex;
  }
  .menu-btn {
    border: 1px solid var(--app-neutral-200);
    background: var(--app-neutral-100);
    color: var(--app-neutral-600);
    width: 34px;
    height: 34px;
    border-radius: 8px;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 50;
    transform: translateX(-100%);
    transition: transform 0.2s ease;
    box-shadow: var(--shadow-lg);
  }
  .sidebar.collapsed {
    width: var(--sidebar-expanded-w);
    transform: translateX(-100%);
  }
  .sidebar.aside-open {
    transform: translateX(0);
  }
}
</style>
