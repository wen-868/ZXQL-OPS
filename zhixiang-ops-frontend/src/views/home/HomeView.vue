<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  UserFilled, Document, Picture, VideoCamera, Promotion,
  Collection, DataAnalysis,
} from '@element-plus/icons-vue'
import { getDashboardStats, type DashboardStats } from '@/api/dashboard'
import { useAppStore } from '@/stores/app'

const router = useRouter()
const appStore = useAppStore()
const loading = ref(false)
const stats = ref<DashboardStats>({
  accounts: 0, scripts: 0, materials: 0, videos: 0,
  publishes: 0, topics: 0, intels: 0,
})

const userName = appStore.user?.realName || '用户'

const statCards = [
  { key: 'accounts', label: '账号', icon: UserFilled },
  { key: 'intels', label: '情报', icon: DataAnalysis },
  { key: 'topics', label: '选题', icon: Collection },
  { key: 'scripts', label: '脚本', icon: Document },
  { key: 'materials', label: '素材', icon: Picture },
  { key: 'videos', label: '成片', icon: VideoCamera },
  { key: 'publishes', label: '发布', icon: Promotion },
] as const

const quickActions = [
  { label: '账号矩阵', path: '/accounts', desc: '管理多平台运营账号' },
  { label: '情报采集', path: '/intel', desc: '热点追踪与趋势分析' },
  { label: '选题策划', path: '/topic', desc: '选题库与灵感管理' },
  { label: '脚本创作', path: '/script', desc: 'AI 辅助脚本生成' },
  { label: '素材中心', path: '/materials', desc: '素材上传与管理' },
  { label: '视频成片', path: '/videos', desc: '智能视频合成' },
  { label: '发布管理', path: '/publish', desc: '一键多平台发布' },
  { label: '工作流', path: '/workflows', desc: '自动化流程编排' },
]

onMounted(async () => {
  loading.value = true
  try {
    stats.value = await getDashboardStats()
  } catch {
    // 静默降级，显示 0
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="home-page">
    <!-- 欢迎区 -->
    <div class="welcome-banner">
      <h1 class="welcome-title">
        你好，{{ userName }}
      </h1>
      <p class="welcome-desc">欢迎使用智享全链运营系统，今日运营数据一览</p>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-grid">
      <div
        v-for="card in statCards"
        :key="card.key"
        class="stat-card"
        :data-key="card.key"
      >
        <!-- 加载态：骨架脉冲动画 -->
        <template v-if="loading">
          <div class="stat-icon-skeleton skeleton" />
          <div class="stat-body">
            <div class="stat-value-skeleton skeleton" />
            <div class="stat-label-skeleton skeleton" />
          </div>
        </template>
        <!-- 正常态 -->
        <template v-else>
          <div class="stat-icon">
            <el-icon :size="22"><component :is="card.icon" /></el-icon>
          </div>
          <div class="stat-body">
            <span class="stat-value">{{ (stats as any)[card.key] }}</span>
            <span class="stat-label">{{ card.label }}</span>
          </div>
        </template>
      </div>
    </div>

    <!-- 快捷入口 -->
    <h2 class="section-title">快捷入口</h2>
    <div class="quick-actions">
      <button
        v-for="action in quickActions"
        :key="action.path"
        class="action-card"
        type="button"
        @click="router.push(action.path)"
      >
        <span class="action-label">{{ action.label }}</span>
        <span class="action-desc">{{ action.desc }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* ========================================
   首页容器
   ======================================== */
.home-page {
  max-width: 1200px;
  margin: 0 auto;
}

/* ========================================
   欢迎区
   ======================================== */
.welcome-banner {
  margin-bottom: var(--space-6);
}

.welcome-title {
  font-size: var(--text-2xl);              /* 24px */
  font-weight: 700;
  color: var(--app-neutral-800);
  margin: 0 0 var(--space-1);
  line-height: 1.3;
}

.welcome-desc {
  font-size: var(--text-base);             /* 14px */
  color: var(--app-neutral-500);
  margin: 0;
}

/* ========================================
   统计卡片网格
   ======================================== */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: var(--space-4);                     /* 16px */
  margin-bottom: var(--space-8);           /* 32px */
}

/* 统计卡片 */
.stat-card {
  background: var(--app-neutral-0);
  border: 1px solid var(--app-neutral-100);
  border-radius: var(--radius-2xl);        /* 16px */
  padding: var(--space-4);                 /* 16px */
  display: flex;
  align-items: center;
  gap: var(--space-3);                     /* 12px */
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--duration-normal) var(--ease-out),
              border-color var(--duration-normal) var(--ease-out);
}

.stat-card:hover {
  box-shadow: var(--shadow-md);
  border-color: var(--app-neutral-200);
}

/* 统计图标 */
.stat-icon {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-xl);         /* 12px */
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform var(--duration-normal) var(--ease-out);
}

.stat-card:hover .stat-icon {
  transform: scale(1.08);
}

/* 各卡片颜色（纯 CSS 变量，零硬编码） */
.stat-card[data-key="accounts"]  .stat-icon { background: var(--app-brand-100);         color: var(--app-brand-600); }
.stat-card[data-key="intels"]    .stat-icon { background: var(--app-driver-lazy-bg);     color: var(--app-driver-lazy); }
.stat-card[data-key="topics"]    .stat-icon { background: var(--app-driver-peep-bg);     color: var(--app-driver-peep); }
.stat-card[data-key="scripts"]   .stat-icon { background: var(--app-driver-greed-bg);    color: var(--app-driver-greed); }
.stat-card[data-key="materials"] .stat-icon { background: var(--app-success-100);        color: var(--app-success-600); }
.stat-card[data-key="videos"]    .stat-icon { background: var(--app-danger-100);         color: var(--app-danger-600); }
.stat-card[data-key="publishes"] .stat-icon { background: var(--app-warning-100);        color: var(--app-warning-600); }

/* 统计正文区 */
.stat-body {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* 统计数字 */
.stat-value {
  font-size: var(--text-3xl);              /* 28px */
  font-weight: 700;
  font-family: var(--font-number);
  color: var(--app-neutral-800);
  line-height: 1.2;
}

/* 统计标签 */
.stat-label {
  font-size: var(--text-sm);               /* 12px */
  color: var(--app-neutral-400);
}

/* ========================================
   骨架屏（加载态）
   ======================================== */
.stat-icon-skeleton {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-lg);
  flex-shrink: 0;
}

.stat-value-skeleton {
  width: 48px;
  height: 28px;
  border-radius: var(--radius-sm);
  margin-bottom: 4px;
}

.stat-label-skeleton {
  width: 32px;
  height: 14px;
  border-radius: var(--radius-sm);
}

/* ========================================
   快捷入口
   ======================================== */
.section-title {
  font-size: var(--text-md);               /* 16px */
  font-weight: 600;
  color: var(--app-neutral-700);
  margin: 0 0 var(--space-3);             /* 12px */
}

.quick-actions {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--space-3);                     /* 12px */
}

/* 快捷入口卡片 */
.action-card {
  background: var(--app-neutral-0);
  border: 1px solid var(--app-neutral-200);
  border-radius: var(--radius-lg);         /* 8px */
  padding: var(--space-4) var(--space-5);  /* 16px 20px */
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  font-size: var(--text-base);
  transition: border-color var(--duration-fast) var(--ease-out),
              color var(--duration-fast) var(--ease-out),
              background-color var(--duration-fast) var(--ease-out),
              box-shadow var(--duration-fast) var(--ease-out);
}

.action-card:hover {
  border-color: var(--app-brand-300);
  color: var(--app-brand-600);
  background: var(--app-brand-50);
  box-shadow: var(--shadow-sm);
}

.action-label {
  display: block;
  font-weight: 600;
  color: var(--app-neutral-800);
  margin-bottom: var(--space-1);
  transition: color var(--duration-fast) var(--ease-out);
}

.action-card:hover .action-label {
  color: var(--app-brand-600);
}

.action-desc {
  display: block;
  font-size: var(--text-sm);               /* 12px */
  color: var(--app-neutral-400);
  transition: color var(--duration-fast) var(--ease-out);
}

.action-card:hover .action-desc {
  color: var(--app-brand-400);
}
</style>
