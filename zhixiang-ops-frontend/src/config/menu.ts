import type { Component } from 'vue'

// 全链路主线菜单分组配置
// real:true 的菜单指向真实功能页；其余为占位页（模块建设中 空状态）
export interface MenuGroup {
  title: string
  children: MenuItem[]
}

export interface MenuItem {
  /** 菜单显示名称 */
  title: string
  path: string
  /** 占位页使用统一占位组件；真实页指向具体组件 */
  component?: Component
  icon?: string
  /** 标记该菜单为真实已实现功能页 */
  real?: boolean
}

// 全链路主线顺序：创作 → 分发 → 分析 → 投放 → 用户 → 设置
// （字母 B/C/D… 仅为开发顺序标记，不在界面展示）
export const menuGroups: MenuGroup[] = [
  {
    title: '创作',
    children: [
      { title: '账号矩阵', path: '/accounts', icon: 'UserFilled', real: true },
      { title: '情报采集', path: '/intel', icon: 'View', real: true },
      { title: '人性分析', path: '/analyze', icon: 'Odometer', real: true },
      { title: '选题',     path: '/topic', icon: 'Promotion', real: true },
      { title: '脚本',     path: '/script', icon: 'Notebook', real: true },
      { title: '素材',     path: '/materials', icon: 'Picture', real: true },
      { title: '成片',     path: '/videos', icon: 'VideoCamera', real: true },
    ],
  },
  {
    title: '分发',
    children: [
      { title: '发布', path: '/publish', icon: 'UploadFilled', real: true },
      { title: '编排', path: '/workflows', icon: 'Share', real: true },
    ],
  },
  {
    title: '分析',
    children: [
      { title: '回收',     path: '/recycle', icon: 'RefreshRight', real: true },
      { title: '决策看板', path: '/dashboard', icon: 'Histogram', real: true },
    ],
  },
  {
    title: '投放',
    children: [
      { title: '选品',     path: '/selection', icon: 'GoodsFilled', real: true },
      { title: '商品内容', path: '/products', icon: 'ShoppingCart', real: true },
      { title: '直播',     path: '/live', icon: 'Service', real: true },
      { title: '投流',     path: '/ad', icon: 'TrendCharts', real: true },
      { title: '订单物流', path: '/orders', icon: 'List', real: true },
      { title: '对账',     path: '/reconcile', icon: 'Wallet', real: true },
      { title: '智能客服', path: '/cs', icon: 'ChatDotRound', real: true },
    ],
  },
  {
    title: '用户',
    children: [
      { title: '私域',     path: '/private', icon: 'ChatRound', real: true },
      { title: '达人',     path: '/talent', icon: 'Medal', real: true },
      { title: '内容出海', path: '/global', icon: 'Globe', real: true },
    ],
  },
  {
    title: '设置',
    children: [
      { title: '权限',     path: '/roles', icon: 'Lock', real: true },
      { title: '合规预检', path: '/compliance', icon: 'Shield', real: true },
      { title: '技能中心', path: '/skills', icon: 'MagicStick', real: true },
      { title: '大模型配置', path: '/llm', icon: 'Cpu', real: true },
      { title: '员工管理', path: '/employees', icon: 'User', real: true },
      { title: '系统初始化', path: '/system-init', icon: 'Setting', real: true },
      { title: '集成设置', path: '/integration', icon: 'Connection', real: true },
      ],
      },
]

// 收集所有路由 path（用于占位页路由批量生成）
export const allMenuPaths: string[] = menuGroups.flatMap((g) =>
  g.children.map((c) => c.path),
)
