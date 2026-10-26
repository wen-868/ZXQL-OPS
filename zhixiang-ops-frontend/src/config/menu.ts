import type { Component } from 'vue'

// 运营系统导航（对齐《运营系统UI原型》：左侧域树 + 底栏 4 通用入口）
// 侧栏 Tab：短视频运营 / 电商运营
// 底栏：经营中心 / AI 中心 / 系统管理 / 个人中心
export interface MenuItem {
  /** 功能目录名称 */
  title: string
  path: string
  component?: Component
  icon?: string
  /** 定位说明（右侧灰字） */
  desc?: string
  /** @AI 快捷动作：把该域任务丢给 AI 对话框（映射 ops 工具） */
  aiPrompt?: string
  /** 标记为真实已实现功能页（false 的目录映射到相近页面，待专属页落地后替换） */
  real?: boolean
}

export interface MenuGroup {
  title: string
  children: MenuItem[]
}

/** 短视频运营 · 左导航（7 大分组 / 26 功能目录，覆盖"内容→发布→直播→投放→私域→达人→出海"） */
export const videoMenuGroups: MenuGroup[] = [
  {
    title: '内容创作',
    children: [
      { title: '市场情报', path: '/intel', icon: 'View', desc: '采集', aiPrompt: '帮我在市场情报中做一次竞品/热点采集', real: true },
      { title: '人性洞察', path: '/analyze', icon: 'Odometer', desc: '核心', aiPrompt: '帮我做一次人性分析与洞察', real: true },
      { title: '选题中心', path: '/topic', icon: 'Promotion', aiPrompt: '帮我生成一批选题', real: true },
      { title: '脚本工坊', path: '/script', icon: 'Notebook', aiPrompt: '帮我写一版短视频脚本', real: true },
      { title: '素材中心', path: '/materials', icon: 'Picture', aiPrompt: '帮我准备一批素材', real: true },
      { title: '智能成片', path: '/videos', icon: 'VideoCamera', aiPrompt: '帮我把脚本做成成片', real: true },
    ],
  },
  {
    title: '发布分发',
    children: [
      { title: '发布管理', path: '/publish', icon: 'UploadFilled', desc: '草稿/定时/多平台', aiPrompt: '帮我把脚本一键分发到多平台', real: true },
      { title: '挂车管理', path: '/publish', icon: 'ShoppingCart', desc: '商品关联', aiPrompt: '帮我把成片挂上商品车', real: false },
      { title: '分发记录', path: '/publish', icon: 'Document', desc: '历史与回执', aiPrompt: '帮我查一下分发记录', real: false },
    ],
  },
  {
    title: '直播运营',
    children: [
      { title: '直播中控', path: '/live', icon: 'Service', desc: '开播/大屏', aiPrompt: '帮我开一场直播并做好中控', real: true },
      { title: '话术库', path: '/live', icon: 'ChatLineSquare', desc: '话术推送', aiPrompt: '帮我准备直播话术', real: false },
      { title: '助播机器人', path: '/live', icon: 'Cpu', desc: 'AI 实时助播', aiPrompt: '帮我启用助播机器人', real: false },
      { title: '直播复盘', path: '/recycle', icon: 'RefreshRight', desc: '五维四率', aiPrompt: '帮我把直播数据做一次复盘', real: true },
    ],
  },
  {
    title: '流量投放',
    children: [
      { title: '投流计划', path: '/ad', icon: 'TrendCharts', desc: '千川/信息流', aiPrompt: '帮我建一条投流计划并控制预算', real: true },
      { title: '投放监控', path: '/ad', icon: 'Monitor', desc: '消耗/ROI', aiPrompt: '帮我看一下投放消耗与 ROI', real: false },
      { title: '预算中心', path: '/ad', icon: 'Money', desc: '预算上限', aiPrompt: '帮我设置投流预算上限', real: false },
    ],
  },
  {
    title: '粉丝私域',
    children: [
      { title: '粉丝画像', path: '/private', icon: 'ChatRound', aiPrompt: '帮我分析粉丝画像', real: true },
      { title: '私信管理', path: '/private', icon: 'ChatDotRound', desc: '统一回复', aiPrompt: '帮我统一回复私信', real: false },
      { title: '社群运营', path: '/private', icon: 'Avatar', desc: '企微承接', aiPrompt: '帮我运营私域社群', real: false },
      { title: '粉丝分层', path: '/private', icon: 'Sort', desc: '分层触达', aiPrompt: '帮我给粉丝做分层触达', real: false },
    ],
  },
  {
    title: '达人合作',
    children: [
      { title: '达人库', path: '/talent', icon: 'Medal', desc: 'MCN', aiPrompt: '帮我找合适的达人合作', real: true },
      { title: '商单管理', path: '/talent', icon: 'Briefcase', desc: '撮合/执行', aiPrompt: '帮我管理商单', real: false },
      { title: '效果追踪', path: '/talent', icon: 'DataLine', desc: '达人效果', aiPrompt: '帮我追踪达人合作效果', real: false },
    ],
  },
  {
    title: '内容出海',
    children: [
      { title: '多语翻译', path: '/global', icon: 'Globe', desc: 'AI 译制', aiPrompt: '帮我把内容翻译出海', real: true },
      { title: '海外平台', path: '/global', icon: 'Platform', desc: 'TikTok/YT', aiPrompt: '帮我配置海外平台', real: false },
      { title: '出海数据', path: '/global', icon: 'Histogram', desc: '跨境表现', aiPrompt: '帮我看一下出海数据', real: false },
    ],
  },
]

/** 电商运营 · 左导航（7 大分组 / 25 功能目录，覆盖"选品→商品→订单→财务→客服→归因→复盘"） */
export const ecommerceMenuGroups: MenuGroup[] = [
  {
    title: '选品管理',
    children: [
      { title: '选品中心', path: '/selection', icon: 'GoodsFilled', desc: '推荐/决策', aiPrompt: '帮我在选品中心选一批好品', real: true },
      { title: '爆款挖掘', path: '/selection', icon: 'TrendCharts', desc: '飙升/黑马', aiPrompt: '帮我挖掘一批潜力爆款', real: false },
      { title: '利润测算', path: '/selection', icon: 'Calculator', desc: '成本/毛利', aiPrompt: '帮我测算选品利润', real: false },
      { title: '供应链', path: '/selection', icon: 'Van', desc: '供货/样品', aiPrompt: '帮我梳理供应链与样品', real: false },
    ],
  },
  {
    title: '商品管理',
    children: [
      { title: '商品内容', path: '/products', icon: 'ShoppingCart', desc: '图文/详情生成', aiPrompt: '帮我生成一批商品内容', real: true },
      { title: '商品库', path: '/products', icon: 'Box', desc: '商品主数据', aiPrompt: '帮我管理商品库', real: false },
      { title: '价格管理', path: '/products', icon: 'PriceTag', desc: '定价/调价', aiPrompt: '帮我调整商品价格', real: false },
      { title: 'SKU 管理', path: '/products', icon: 'Grid', desc: '规格/库存', aiPrompt: '帮我管理 SKU 与库存', real: false },
    ],
  },
  {
    title: '订单履约',
    children: [
      { title: '订单中心', path: '/orders', icon: 'List', desc: '下单到履约', aiPrompt: '帮我查看订单履约情况', real: true },
      { title: '物流跟踪', path: '/orders', icon: 'Van', desc: '快递轨迹', aiPrompt: '帮我跟踪订单物流', real: false },
      { title: '打单发货', path: '/orders', icon: 'Printer', desc: '电子面单', aiPrompt: '帮我批量打单发货', real: false },
      { title: '售后管理', path: '/orders', icon: 'RefreshLeft', desc: '退换/退款', aiPrompt: '帮我处理售后', real: false },
    ],
  },
  {
    title: '收益财务',
    children: [
      { title: '收益对账', path: '/reconcile', icon: 'Wallet', aiPrompt: '帮我做一期收益对账', real: true },
      { title: '账单中心', path: '/reconcile', icon: 'Document', desc: '账单明细', aiPrompt: '帮我查看账单', real: false },
      { title: '差异处理', path: '/reconcile', icon: 'Warning', desc: '高风险', aiPrompt: '帮我处理对账差异', real: false },
    ],
  },
  {
    title: '客户服务',
    children: [
      { title: '智能客服', path: '/cs', icon: 'ChatDotRound', desc: '售前售后', aiPrompt: '帮我处理客户咨询', real: true },
      { title: '客诉管理', path: '/cs', icon: 'Bell', desc: '投诉工单', aiPrompt: '帮我处理客诉', real: false },
      { title: '高风客诉', path: '/cs', icon: 'Warning', desc: '高风险', aiPrompt: '帮我优先处理高风险客诉', real: false },
      { title: '评价管理', path: '/cs', icon: 'Star', desc: '评价/口碑', aiPrompt: '帮我管理客户评价', real: false },
    ],
  },
  {
    title: '效果归因',
    children: [
      { title: '投放归因', path: '/dashboard', icon: 'Histogram', desc: '渠道归因', aiPrompt: '帮我看投放归因', real: true },
      { title: '转化分析', path: '/dashboard', icon: 'DataLine', desc: '转化漏斗', aiPrompt: '帮我看转化分析', real: true },
      { title: 'ROI 分析', path: '/dashboard', icon: 'Money', desc: '投产比', aiPrompt: '帮我看 ROI 分析', real: true },
    ],
  },
  {
    title: '复盘优化',
    children: [
      { title: '周期复盘', path: '/recycle', icon: 'RefreshRight', desc: '经营复盘', aiPrompt: '帮我做一期经营复盘', real: true },
      { title: '策略库', path: '/workflows', icon: 'Share', desc: '策略沉淀', aiPrompt: '帮我沉淀运营策略', real: true },
      { title: '优化建议', path: '/recycle', icon: 'Lightning', desc: '下期建议', aiPrompt: '帮我给出下期优化建议', real: true },
    ],
  },
]

/** 固定通用栏 · 4 个一级类目（UI 设计 2.4 融合） */
export interface GlobalCategory {
  title: string
  icon?: string
  desc?: string
  children: MenuItem[]
}

export const globalCategories: GlobalCategory[] = [
  {
    title: '经营中心',
    icon: 'DataAnalysis',
    desc: '跨域业务总览与账号资产',
    children: [
      { title: '经营大盘', path: '/dashboard', icon: 'Histogram', aiPrompt: '帮我看看今天运营大盘', real: true },
      { title: '账号矩阵', path: '/accounts', icon: 'UserFilled', desc: '短视频号+电商店铺', aiPrompt: '帮我查看账号矩阵健康度', real: true },
    ],
  },
  {
    title: 'AI 中心',
    icon: 'Cpu',
    desc: '技能 / 网关 / 自动化编排',
    children: [
      { title: '技能 / 提示词', path: '/skills', icon: 'MagicStick', real: true },
      { title: '能力开关', path: '/llm', icon: 'Cpu', real: true },
      { title: '工作流', path: '/workflows', icon: 'Share', aiPrompt: '帮我编排一条自动化流水线', real: true },
      { title: '自动链', path: '/automation', icon: 'Cpu', desc: '免人工流水线', aiPrompt: '帮我跑一遍自动链（检索→筛选）', real: true },
      { title: '浏览器工作台', path: '/browser-workbench', icon: 'Monitor', desc: 'AI 实时操控', aiPrompt: '帮我打开浏览器工作台执行平台操作', real: true },
    ],
  },
  {
    title: '系统管理',
    icon: 'Setting',
    desc: '平台后台管理',
    children: [
      { title: '系统参数', path: '/compliance', icon: 'Setting', real: true },
      { title: '成员 / 角色 / 租户', path: '/roles', icon: 'Lock', real: true },
      { title: '第三方接入', path: '/integration', icon: 'Connection', real: true },
      { title: '服务监控', path: '/system-init', icon: 'SetUp', real: true },
    ],
  },
  {
    title: '个人中心',
    icon: 'User',
    desc: '账号与偏好',
    children: [
      { title: '租户信息', path: '/profile', icon: 'OfficeBuilding', real: true },
      { title: '账号与偏好', path: '/employees', icon: 'User', real: true },
    ],
  },
]

// 兼容旧引用：合并菜单（占位路由生成用）
export const menuGroups: MenuGroup[] = [
  ...videoMenuGroups,
  ...ecommerceMenuGroups,
  ...globalCategories.map((c) => ({ title: c.title, children: c.children })),
]

export const allMenuPaths: string[] = Array.from(
  new Set(menuGroups.flatMap((g) => g.children.map((c) => c.path))),
)
