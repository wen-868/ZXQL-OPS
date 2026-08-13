# 智享全链运营系统 · 全站 UI/UX 精细化设计规范

> **版本**：v1.0  
> **设计师**：林深  
> **发布日期**：2026-08-09  
> **交付对象**：阿澜（前端落地）  
> **技术栈**：Vue 3 + Element Plus 2.8 + Vite  
> **设计定位**：短视频/直播全链路运营管理后台 · SaaS 级质感

---

## 目录

1. [美学方向](#1-美学方向)
2. [色彩系统](#2-色彩系统)
3. [字体系统](#3-字体系统)
4. [间距系统](#4-间距系统)
5. [圆角与阴影](#5-圆角与阴影)
6. [动效规范](#6-动效规范)
7. [组件设计](#7-组件设计)
8. [布局规范](#8-布局规范)
9. [Element Plus 覆写清单](#9-element-plus-覆写清单)
10. [页面设计要点](#10-页面设计要点)

---

## 1. 美学方向

### 1.1 设计理念：现代专业 · 克制精致

本系统定位为**短视频/直播带货全链路运营管理后台**，用户是 MCN 机构与品牌方运营人员，日常高频使用。

核心设计理念为 **"专业克制，细节精致"**——区别于传统灰白卡片堆砌的后台，也拒绝花哨的营销视觉。追求的是：

- **信息密度适中**：数据密集但不压抑，留白让眼睛有呼吸感
- **层次分明**：通过色彩深浅、间距大小、字体粗细构建清晰的信息层级
- **操作直觉**：常用操作一眼可及，微交互给予即时反馈
- **品牌感内敛**：不靠大面积品牌色刷存在感，而是通过精致的细节传递专业度

### 1.2 核心差异化特征

| 特征 | 说明 |
|------|------|
| **浅色侧边栏 + 浅色内容区** | 对齐 ZXQL-MS「白底黑字中间灰」商业后台风格，侧边栏浅灰(`--sidebar-bg #FAFAFA`)配深色文字，选中态用柔和主色背景 + 主色文字 |
| **多彩功能标识** | 7 大人性 driver + 6 情绪 emotion 有独立配色（对齐 MS 高饱和柔和调色板），让数据一眼区分 |
| **状态色彩语义化** | 成功/警告/危险/信息 四色体系贯穿全局，色值对齐 ZXQL-MS，状态一目了然 |
| **卡片式数据呈现** | 统计数字、洞察结论均以卡片承载，视觉呼吸感强 |
| **微交互品质感** | hover/focus/active 三态齐全，过渡动画流畅但不拖沓 |
| **表格行悬浮高亮** | 数据密集型页面的核心体验优化 |

### 1.3 对标参考与统一约束

| 来源 | 借鉴要点 |
|------|---------|
| **ZXQL-MS（对齐管理系统）** | **设计语言统一源**：Atlas Blue 主色 `#3F6FEF`、纯灰中性阶、收敛功能色、浅色侧边栏(`frost-sidebar #FAFAFA`)、柔和分层阴影 `rgba(16,24,40,…)`、「白底黑字中间灰，颜色仅在按钮和状态」 |
| **Vercel Dashboard** | 卡片式数据布局、状态标签色彩体系、简洁的顶部栏 |
| **Notion** | 侧边栏折叠动画、字体层级、留白节奏 |
| **Stripe Dashboard** | 表格行交互、表单抽屉、状态流转的视觉表达 |

> **一致性纪律**：本系统（智享全链运营）与 ZXQL-MS 同属一个产品矩阵，视觉风格必须保持一致。所有配色仅通过 `src/styles/variables.css` 中的 CSS 变量定义，**禁止在组件内硬编码 hex/rgba**；侧边栏等布局颜色一律引用 `--sidebar-*` 变量。配色变更须同步更新 tokens.css（MS 侧）与本变量文件两端。

---

## 2. 色彩系统

### 2.1 设计原则

- 配色体系**对齐 ZXQL-MS（对齐管理系统）**：共享同一套设计语言，保证产品矩阵视觉一致
- 品牌主色采用 **Atlas Blue `#3F6FEF`**（去紫调纯蓝，与 MS `--color-primary` 一致）；hover `#5A83F2` / active `#2F5BD6`
- 中性色为**纯灰阶**（无蓝调），与 MS `gray-0…900` 一致；功能色收敛为 MS 同款（`#0EA879`/`#D48B3A`/`#C0392B`）
- 阴影为**柔和蓝调** `rgba(16,24,40,…)`（与 MS 一致），非纯黑
- 正文/重要文字与背景对比度 ≥ **4.5:1**（WCAG AA），辅助文字 ≥ **3:1**
- 主色在浅色侧栏/内容区统一使用 **400-600 档**，选中态文字用 500、背景用 12% 柔和主色
- 所有颜色**仅通过 `variables.css` 的 CSS 变量定义**，组件内禁止硬编码色值；侧边栏一律引用 `--sidebar-*`

### 2.2 品牌主色（Atlas Blue，对齐 ZXQL-MS）

```
--app-brand-50:  #eef3fe   // 最浅蓝，大背景/选中态底色
--app-brand-100: #dbe5fc
--app-brand-200: #b9cdf9
--app-brand-300: #8eaff4
--app-brand-400: #5a83f2   // hover 态（对齐 MS primary-hover）
--app-brand-500: #3f6fef   // 主色基准，按钮/链接/选中态（对齐 MS primary）
--app-brand-600: #2f5bd6   // active 态（对齐 MS primary-active）
--app-brand-700: #274bb4
--app-brand-800: #203c91
--app-brand-900: #1a2f73
```

### 2.3 功能色（对齐 ZXQL-MS）

#### 成功（Success）
```
--app-success-50:  #e6f7f1
--app-success-100: #c8efe3
--app-success-500: #0ea879   // 基准色（对齐 MS success）
--app-success-600: #0c9468   // 深色：成功文字
--app-success-700: #0a7a57
```

#### 警告（Warning）
```
--app-warning-50:  #fbf2e6
--app-warning-100: #f5e3cd
--app-warning-500: #d48b3a   // 基准色（对齐 MS warning）
--app-warning-600: #b8762f   // 深色：警告文字
--app-warning-700: #985f25
```

#### 危险（Danger）
```
--app-danger-50:  #faeae8
--app-danger-100: #f3d4d0
--app-danger-500: #c0392b   // 基准色（对齐 MS danger）
--app-danger-600: #a32f23   // 深色：危险文字
--app-danger-700: #85261c
```

#### 信息（Info）
```
--app-info-50:  #eef3fe
--app-info-100: #dbe5fc
--app-info-500: #3f6fef   // 同主色（MS 以主色承载 info 语义）
--app-info-600: #2f5bd6
--app-info-700: #274bb4
```

### 2.4 中性色阶（纯灰阶，对齐 MS gray）

```
--app-neutral-0:   #ffffff   // 纯白，卡片/弹窗背景
--app-neutral-50:  #f8f8f8   // 页面背景、表格斑马纹
--app-neutral-100: #f0f0f0   // 输入框背景、禁用态背景
--app-neutral-200: #e2e2e2   // 边框色、分割线
--app-neutral-300: #cccccc   // 占位符文字、禁用态文字
--app-neutral-400: #999999   // 辅助文字
--app-neutral-500: #666666   // 次要文字、说明文字
--app-neutral-600: #444444   // 正文文字（AA 合规）
--app-neutral-700: #333333   // 重要文字
--app-neutral-800: #222222   // 标题文字、强调文字
--app-neutral-900: #111111   // 最深色，极少使用
```

### 2.5 侧边栏配色（浅色商业后台，对齐 MS frost-sidebar）

```
--sidebar-bg:           #fafafa   // 侧边栏背景（浅灰白，对齐 MS frost-sidebar）
--sidebar-text:         #444444   // 侧边栏常规文字（neutral-600）
--sidebar-text-hover:   #222222   // 悬浮文字（neutral-800）
--sidebar-text-active:  #3f6fef   // 选中文字（主色）
--sidebar-item-hover:   rgba(0,0,0,0.04)          // 菜单项悬浮背景（浅灰）
--sidebar-item-active:  rgba(63,111,239,0.12)     // 菜单项选中背景（柔和主色，对齐 MS primary-soft）
--sidebar-divider:      rgba(0,0,0,0.06)          // 分割线
--sidebar-group-title:  #999999   // 分组标题（neutral-400）
--sidebar-badge:        #3f6fef   // 侧边栏徽标（主色）
--sidebar-collapsed-w:  72px      // 收起宽度（图标轨道）
--sidebar-expanded-w:   208px     // 展开宽度（窄版居中导航）
--sidebar-icon-size:    18px      // 菜单图标尺寸
--sidebar-item-radius:  6px       // 菜单项胶囊圆角（选中/悬浮）
--sidebar-item-inset-x: 16px      // 菜单项左右留白，形成居中胶囊
--sidebar-item-gap:     8px       // 图标与文字间距
--sidebar-active-bar:   #3f6fef   // 选中态左侧指示条（主色）
```

### 2.6 数据可视化色板（7 人性 × 6 情绪）

用于 E 选题、D 人性分析、M 决策看板等页面的图表着色：

```
// 7 人性驱动因子（driver）
--app-driver-greed:    #f97316   // 贪 - 橙色
--app-driver-lazy:     #8b5cf6   // 懒 - 紫色
--app-driver-fear:     #ef4444   // 怕 - 红色
--app-driver-vanity:   #ec4899   // 虚荣 - 粉色
--app-driver-peep:     #06b6d4   // 窥探 - 青色
--app-driver-lonely:   #6366f1   // 孤独爱 - 靛蓝
--app-driver-anger:    #dc2626   // 愤怒不公 - 深红

// 6 情绪（emotion）
--app-emotion-anger:    #ef4444   // 愤怒 - 红色
--app-emotion-resonance:#8b5cf6   // 共鸣 - 紫色
--app-emotion-curiosity:#06b6d4   // 好奇 - 青色
--app-emotion-touch:    #ec4899   // 感动 - 粉色
--app-emotion-anxiety:  #f59e0b   // 焦虑 - 琥珀
--app-emotion-thrill:   #22c55e   // 爽感 - 绿色
```

---

## 3. 字体系统

### 3.1 字体栈

```
--font-sans: "Inter", "SF Pro Text", -apple-system, BlinkMacSystemFont,
             "PingFang SC", "Microsoft YaHei", "微软雅黑",
             "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;

--font-mono: "JetBrains Mono", "Fira Code", "SF Mono", "Cascadia Code",
             Consolas, "Courier New", monospace;

--font-number: "Inter", "SF Pro Text", -apple-system, "PingFang SC",
               "Microsoft YaHei", sans-serif;  // Inter 自带等宽数字特性
```

**字体策略说明**：
- **Inter** 作为首选西文字体，自带 `tnum`（表格数字等宽）特性，确保数据列对齐
- **PingFang SC**（苹方）macOS 首选中文，字形现代精致
- **Microsoft YaHei**（微软雅黑）Windows 首选中文，系统预装覆盖率高
- 等宽字体栈用于代码/ID/JSON 等场景

### 3.2 字号层级

| Token | 字号 | 行高 | 用途 |
|-------|------|------|------|
| `--text-xs` | 11px | 16px | 标签辅助文字、表格脚注、时间戳 |
| `--text-sm` | 12px | 18px | 表单辅助说明、菜单分组标题、徽标 |
| `--text-base-sm` | 13px | 20px | 表格内容、列表项、标签文字、输入框文字 |
| `--text-base` | 14px | 22px | **正文基准**：段落、菜单项、按钮、表单标签 |
| `--text-md` | 16px | 24px | 卡片标题、弹窗标题、侧边栏菜单（展开态） |
| `--text-lg` | 18px | 26px | 页面区块标题、统计卡片副标题 |
| `--text-xl` | 20px | 28px | 弹窗主标题、大卡片标题 |
| `--text-2xl` | 24px | 32px | 页面主标题、欢迎语 |
| `--text-3xl` | 28px | 36px | 统计大数字（首页卡片） |
| `--text-4xl` | 32px | 40px | 看板核心 KPI 数字 |

### 3.3 字重使用规范

| 字重 | CSS 值 | 使用场景 |
|------|--------|---------|
| Regular | `400` | 正文、表格内容、表单文字、辅助说明 |
| Medium | `500` | 菜单项、标签文字、按钮文字、输入框文字 |
| Semibold | `600` | **标题基准**：卡片标题、区块标题、表格表头 |
| Bold | `700` | 页面主标题、统计数字、品牌名 |

**规则**：
- 正文永远 400，标题永远 600+，不做 400 加粗模拟
- 同一视觉区域内，字重变化 ≤ 2 档
- 数字（统计值）使用 700 + Inter 等宽数字特性

---

## 4. 间距系统

### 4.1 基础栅格：4px

所有间距基于 4px 栅格系统，确保视觉节奏一致：

| Token | 值 | 用途 |
|-------|-----|------|
| `--space-1` | 4px | 图标与文字间距、标签内边距、紧密元素间距 |
| `--space-2` | 8px | 按钮内水平间距、表单控件间距、卡片内小间距 |
| `--space-3` | 12px | 卡片内边距（小）、表格单元格内边距 |
| `--space-4` | 16px | **基准间距**：卡片内边距、表单字段间距、页面内容区 padding |
| `--space-5` | 20px | 弹窗内边距、抽屉内边距 |
| `--space-6` | 24px | 页面区块间距、卡片间距、表单分组间距 |
| `--space-8` | 32px | 大区块间距、首页统计卡片间距 |
| `--space-10` | 40px | 页面顶部/底部留白 |
| `--space-12` | 48px | 页面级大留白 |
| `--space-16` | 64px | 极少数场景（登录页大留白） |

### 4.2 组件内间距

```
// 按钮
--btn-padding-x-sm:  12px
--btn-padding-y-sm:  4px
--btn-padding-x-md:  16px
--btn-padding-y-md:  8px
--btn-padding-x-lg:  20px
--btn-padding-y-lg:  10px

// 输入框
--input-padding-x:   12px
--input-padding-y:   8px

// 表格单元格
--table-cell-padding-x: 12px
--table-cell-padding-y: 10px

// 卡片
--card-padding:      20px
--card-padding-sm:   16px
```

### 4.3 页面级间距

```
// 内容区
--content-padding:   24px   // layout-content 的 padding

// 页面最大宽度
--page-max-width:    1400px // 内容区最大宽度（大屏居中）

// 表单抽屉宽度
--drawer-width-sm:   480px
--drawer-width-md:   560px
--drawer-width-lg:   720px
```

---

## 5. 圆角与阴影

### 5.1 圆角层级

| Token | 值 | 用途 |
|-------|-----|------|
| `--radius-sm` | 4px | 标签、徽标、小按钮、输入框内元素 |
| `--radius-md` | 6px | **基准圆角**：按钮、输入框、选择器、表格 |
| `--radius-lg` | 8px | 卡片、下拉面板、弹出框 |
| `--radius-xl` | 12px | 弹窗、抽屉、大卡片 |
| `--radius-2xl` | 16px | 登录页卡片、首页统计卡片 |
| `--radius-full` | 9999px | 圆形头像、胶囊标签 |

**规则**：
- 同类组件圆角统一，不允许同一页面出现 4px/6px/8px 按钮混用
- 弹窗/抽屉永远用 `--radius-xl`（12px）
- 卡片默认 `--radius-lg`（8px），首页统计卡片可升级到 `--radius-2xl`（16px）

### 5.2 阴影层级

| Token | 值 | 用途 |
|-------|-----|------|
| `--shadow-none` | `none` | 默认无阴影 |
| `--shadow-sm` | `0 1px 2px 0 rgba(0,0,0,0.04)` | 卡片默认阴影（极浅） |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.06)` | 卡片悬浮、下拉面板、表格行悬浮 |
| `--shadow-lg` | `0 8px 24px rgba(0,0,0,0.08)` | 弹窗、抽屉、通知提示 |
| `--shadow-xl` | `0 20px 60px rgba(0,0,0,0.12)` | 登录页卡片、模态框（深度遮罩感） |

**规则**：
- 卡片默认 `--shadow-sm`，hover 时过渡到 `--shadow-md`
- 弹窗/抽屉用 `--shadow-lg`
- 全局不使用彩色阴影（如蓝色投影），保持纯净感
- 阴影只在 Y 轴偏移，不设 X 轴偏移（模拟顶光源）

---

## 6. 动效规范

### 6.1 过渡时长

| Token | 值 | 用途 |
|-------|-----|------|
| `--duration-fast` | 120ms | 微交互：hover 颜色变化、图标切换、focus 边框 |
| `--duration-normal` | 200ms | **基准时长**：按钮状态切换、卡片悬浮、菜单展开/收起 |
| `--duration-slow` | 300ms | 弹窗/抽屉打开关闭、侧边栏折叠、页面过渡 |

### 6.2 缓动函数

```
--ease-out:     cubic-bezier(0.16, 1, 0.3, 1)    // 默认缓出，元素出现
--ease-in:      cubic-bezier(0.4, 0, 1, 1)        // 缓入，元素消失
--ease-in-out:  cubic-bezier(0.65, 0, 0.35, 1)    // 持续动画（侧边栏折叠）
--ease-spring:  cubic-bezier(0.34, 1.56, 0.64, 1) // 弹性效果（弹窗打开）
```

**规则**：
- 元素出现用 `ease-out`（先快后慢，吸引注意）
- 元素消失用 `ease-in`（先慢后快，不拖沓）
- 侧边栏折叠用 `ease-in-out`（双向自然）
- 弹窗打开用 `ease-spring`（微微弹性，增加品质感）

### 6.3 微交互规范

#### hover（悬浮）
- 按钮：背景色加深 1 档（如 brand-500 → brand-600），过渡 120ms
- 卡片：阴影从 `shadow-sm` → `shadow-md`，过渡 200ms
- 表格行：背景变为 `neutral-50`，过渡 120ms
- 菜单项：背景变亮，过渡 120ms
- 链接/文字按钮：颜色变化 + 无下划线 → 有下划线，过渡 120ms

#### active（按下）
- 按钮：背景色加深 2 档（如 brand-500 → brand-700），缩放 0.97
- 输入框：边框色变为 brand-500，过渡 120ms

#### focus（聚焦）
- 输入框/选择器：`box-shadow: 0 0 0 3px var(--app-brand-200)`（外发光代替默认轮廓）
- 按钮/链接：`outline: 2px solid var(--app-brand-500); outline-offset: 2px`
- 全局关闭浏览器默认 outline，用自定义 focus-ring 替代

#### loading（加载）
- 骨架屏：浅灰脉冲动画（`neutral-100` → `neutral-200` 循环），周期 1.5s
- 按钮 loading：旋转 spinner + 禁用交互
- 表格 loading：el-table 自带 v-loading 指令

#### empty（空状态）
- 使用 `el-empty` 组件，description 为具体引导文案（如「暂无账号，点击右上角新建」）
- 空状态图标大小 80px，颜色 `neutral-300`

---

## 7. 组件设计

### 7.1 按钮（Button）

| 尺寸 | 高度 | 内边距 | 字号 | 圆角 |
|------|------|--------|------|------|
| sm | 28px | 12px × 4px | 12px | 6px |
| md（默认） | 34px | 16px × 8px | 14px | 6px |
| lg | 40px | 20px × 10px | 15px | 6px |

#### 主按钮（Primary）
```
背景: var(--app-brand-500)
文字: #ffffff
边框: 无
hover: var(--app-brand-600)
active: var(--app-brand-700)
focus: outline 2px var(--app-brand-200), outline-offset 2px
disabled: var(--app-brand-300), 文字 #ffffff 不透明
```

#### 次要按钮（Default/Secondary）
```
背景: #ffffff
文字: var(--app-neutral-700)
边框: 1px solid var(--app-neutral-200)
hover: 边框 var(--app-brand-300), 文字 var(--app-brand-600), 背景 var(--app-brand-50)
active: 边框 var(--app-brand-500)
focus: 同 primary
disabled: 背景 var(--app-neutral-100), 文字 var(--app-neutral-300)
```

#### 文字按钮（Text）
```
背景: transparent
文字: var(--app-brand-600)
无边框
hover: 背景 var(--app-brand-50), 文字 var(--app-brand-700)
active: 背景 var(--app-brand-100)
disabled: 文字 var(--app-neutral-300)
```

#### 危险按钮（Danger）
```
// 实心危险按钮（如删除确认）
背景: var(--app-danger-500)
文字: #ffffff
hover: var(--app-danger-600)
active: var(--app-danger-700)

// 文字危险按钮（如表格行操作"删除"）
背景: transparent
文字: var(--app-danger-600)
hover: 背景 var(--app-danger-50)
```

### 7.2 输入框/选择器（Input / Select）

```
高度: 34px（medium，与按钮统一）
内边距: 8px 12px
字号: 14px
边框: 1px solid var(--app-neutral-200)
圆角: 6px
背景: #ffffff

// 状态
hover: 边框 var(--app-neutral-300)
focus: 边框 var(--app-brand-500), box-shadow: 0 0 0 3px var(--app-brand-100)
disabled: 背景 var(--app-neutral-100), 文字 var(--app-neutral-300)
error: 边框 var(--app-danger-500)

// 占位符
placeholder 颜色: var(--app-neutral-300)
placeholder 字号: 14px（与输入文字同号，不用更小）
```

### 7.3 表格（Table）

```
// 表头
背景: var(--app-neutral-50)
文字: var(--app-neutral-600), 字号 12px, 字重 600
内边距: 10px 12px
边框-bottom: 1px solid var(--app-neutral-200)
文字对齐: 左对齐（数字列右对齐）

// 表体行
背景: #ffffff
文字: var(--app-neutral-700), 字号 13px
内边距: 10px 12px
边框-bottom: 1px solid var(--app-neutral-100)
行高: 44px（最小高度）

// 行悬浮
hover: 背景 var(--app-neutral-50)
stripe（斑马纹）: 偶数行背景 var(--app-neutral-50)（浅到几乎看不出，仅辅助阅读）

// 分页
分页器对齐: 右对齐
分页器 margin-top: 16px
每页条数选项: [10, 20, 50, 100]
```

### 7.4 卡片（Card）

```
背景: #ffffff
边框: 1px solid var(--app-neutral-100)   // 极浅边框，非纯阴影
圆角: var(--radius-lg) = 8px
阴影: var(--shadow-sm)
内边距: var(--card-padding) = 20px

// 统计卡片（首页）
圆角: var(--radius-2xl) = 16px
阴影: var(--shadow-sm)
hover: 阴影 → var(--shadow-md), 边框色 → var(--app-neutral-200)

// 卡片标题
字号: 16px, 字重 600, 颜色 var(--app-neutral-800)
标题下方分割线: 1px solid var(--app-neutral-100), margin-bottom: 16px
```

### 7.5 标签/徽章（Tag / Badge）

```
// 基础标签
高度: 24px
内边距: 2px 8px
字号: 12px, 字重 500
圆角: var(--radius-sm) = 4px
边框: 无

// 色彩方案（浅色背景 + 深色文字）
成功: 背景 var(--app-success-50), 文字 var(--app-success-600)
警告: 背景 var(--app-warning-50), 文字 var(--app-warning-600)
危险: 背景 var(--app-danger-50), 文字 var(--app-danger-600)
信息: 背景 var(--app-info-50), 文字 var(--app-info-600)
品牌: 背景 var(--app-brand-50), 文字 var(--app-brand-600)
中性: 背景 var(--app-neutral-100), 文字 var(--app-neutral-600)

// 状态点（Dot Badge）
宽高: 8px, 圆角: 50%
成功: var(--app-success-500)
警告: var(--app-warning-500)
危险: var(--app-danger-500)
离线/未知: var(--app-neutral-300)
```

### 7.6 抽屉/对话框（Drawer / Dialog）

#### 抽屉（用于表单创建/编辑）
```
宽度: 480px（sm）/ 560px（md）/ 720px（lg）
背景: #ffffff
圆角: var(--radius-xl) = 12px（左侧无圆角）
阴影: var(--shadow-lg)
标题栏: 高度 56px, 内边距 20px 24px, 底部边框 1px solid var(--app-neutral-100)
标题: 字号 16px, 字重 600
内容区: 内边距 24px
底部操作栏: 内边距 16px 24px, 顶部边框 1px solid var(--app-neutral-100), 按钮右对齐
关闭按钮: 右上角 X, 字号 18px, 颜色 var(--app-neutral-400)
```

#### 对话框（用于确认/提醒）
```
宽度: 420px（小）/ 520px（中）
圆角: var(--radius-xl) = 12px
阴影: var(--shadow-lg)
标题栏: 内边距 20px 24px 0
内容区: 内边距 16px 24px 20px
底部按钮: 内边距 0 24px 20px, 右对齐
```

### 7.7 空状态（Empty State）

```
// 使用 el-empty 组件
图片尺寸: 80px（默认）或 100px（大页面）
图片颜色: var(--app-neutral-300)
描述文字: 字号 14px, 颜色 var(--app-neutral-400)
操作按钮: 在描述下方 16px, 主按钮样式

// 典型文案模板
- 列表页：「暂无数据，点击「新建」开始」
- 搜索无结果：「未找到匹配结果，试试其他关键词」
- 无权限：「暂无访问权限，请联系管理员」
```

### 7.8 滚动条

```
// Webkit 浏览器（Chrome/Edge/Safari）
宽度: 6px
轨道: transparent
滑块: var(--app-neutral-300), 圆角 3px
滑块 hover: var(--app-neutral-400)

// Firefox
scrollbar-width: thin
scrollbar-color: var(--app-neutral-300) transparent
```

---

## 8. 布局规范

### 8.1 整体结构

```
┌──────────────────────────────────────────────────┐
│ ┌──────────┐ ┌──────────────────────────────────┐│
│ │          │ │  顶部栏（56px）                    ││
│ │  侧边栏  │ │  [折叠] 页面标题    用户名 租户  退出 ││
│ │  240px   │ ├──────────────────────────────────┤│
│ │  (展开)  │ │                                  ││
│ │  64px    │ │  内容区                            ││
│ │  (收起)  │ │  padding: 24px                    ││
│ │          │ │  max-width: 1400px                ││
│ │          │ │                                  ││
│ │          │ │                                  ││
│ └──────────┘ └──────────────────────────────────┘│
└──────────────────────────────────────────────────┘
```

### 8.2 关键尺寸

| 元素 | 尺寸 |
|------|------|
| 侧边栏展开宽度 | 240px |
| 侧边栏收起宽度 | 64px |
| 顶部栏高度 | 56px |
| 内容区内边距 | 24px |
| 内容区最大宽度 | 1400px |
| 侧边栏品牌区高度 | 56px |
| 侧边栏菜单项高度 | 40px |
| 侧边栏折叠过渡 | 200ms ease-in-out |

### 8.3 响应式断点

| 断点 | 宽度 | 行为 |
|------|------|------|
| `--bp-xl` | ≥ 1440px | 内容区最大宽度 1400px 居中，侧边栏保持展开 |
| `--bp-lg` | 1024px - 1439px | 内容区自适应，统计卡片网格减列 |
| `--bp-md` | 768px - 1023px | 侧边栏默认收起（64px），可手动展开 |
| `--bp-sm` | < 768px | 侧边栏变为 overlay 模式（浮层），顶部栏显示汉堡菜单 |

**当前阶段**：桌面端优先（≥ 1024px），响应式适配为阶段 3 增强项。

### 8.4 内容区网格

```
// 统计卡片网格（首页/看板）
grid-template-columns: repeat(auto-fill, minmax(160px, 1fr))
gap: 16px

// 卡片网格（素材/视频）
grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))
gap: 16px

// 双栏布局（详情页）
grid-template-columns: 1fr 1fr
gap: 24px
```

---

## 9. Element Plus 覆写清单

### 9.1 覆写策略

1. 创建全局样式文件 `src/styles/element-override.scss`（或 `.css`）
2. 通过 CSS 变量覆写 EL 默认变量，不直接修改组件源码
3. 在 `main.ts` 中于 `element-plus/dist/index.css` **之后**引入覆写样式
4. 所有覆写集中在以下变量表中，阿澜逐条落地

### 9.2 CSS 变量覆写表

```css
:root {
  /* ===== 品牌主色覆写 ===== */
  --el-color-primary:          var(--app-brand-500);       /* #3b82f6 */
  --el-color-primary-light-3:  var(--app-brand-300);       /* #93c5fd */
  --el-color-primary-light-5:  var(--app-brand-200);       /* #bfdbfe */
  --el-color-primary-light-7:  var(--app-brand-100);       /* #dbeafe */
  --el-color-primary-light-8:  var(--app-brand-50);        /* #eff6ff */
  --el-color-primary-light-9:  var(--app-brand-50);        /* #eff6ff */
  --el-color-primary-dark-2:   var(--app-brand-700);       /* #1d4ed8 */

  /* ===== 功能色覆写 ===== */
  --el-color-success:          var(--app-success-500);     /* #22c55e */
  --el-color-success-light-3:  var(--app-success-100);     /* #dcfce7 */
  --el-color-success-light-5:  var(--app-success-50);      /* #f0fdf4 */
  --el-color-success-dark-2:   var(--app-success-600);     /* #16a34a */

  --el-color-warning:          var(--app-warning-500);     /* #f59e0b */
  --el-color-warning-light-3:  var(--app-warning-100);     /* #fef3c7 */
  --el-color-warning-light-5:  var(--app-warning-50);      /* #fffbeb */
  --el-color-warning-dark-2:   var(--app-warning-600);     /* #d97706 */

  --el-color-danger:           var(--app-danger-500);      /* #ef4444 */
  --el-color-danger-light-3:   var(--app-danger-100);      /* #fee2e2 */
  --el-color-danger-light-5:   var(--app-danger-50);       /* #fef2f2 */
  --el-color-danger-dark-2:    var(--app-danger-600);      /* #dc2626 */

  --el-color-info:             var(--app-info-500);        /* #0ea5e9 */
  --el-color-info-light-3:     var(--app-info-100);        /* #e0f2fe */
  --el-color-info-light-5:     var(--app-info-50);         /* #f0f9ff */
  --el-color-info-dark-2:      var(--app-info-600);        /* #0284c7 */

  /* ===== 中性色覆写 ===== */
  --el-text-color-primary:     var(--app-neutral-800);     /* #1e293b */
  --el-text-color-regular:     var(--app-neutral-600);     /* #475569 */
  --el-text-color-secondary:   var(--app-neutral-500);     /* #64748b */
  --el-text-color-placeholder: var(--app-neutral-300);     /* #cbd5e1 */
  --el-text-color-disabled:    var(--app-neutral-300);     /* #cbd5e1 */

  --el-border-color:           var(--app-neutral-200);     /* #e2e8f0 */
  --el-border-color-light:     var(--app-neutral-100);     /* #f1f5f9 */
  --el-border-color-lighter:   var(--app-neutral-50);      /* #f8fafc */
  --el-border-color-extra-light: var(--app-neutral-50);    /* #f8fafc */
  --el-border-color-dark:      var(--app-neutral-300);     /* #cbd5e1 */

  --el-fill-color:             var(--app-neutral-100);     /* #f1f5f9 */
  --el-fill-color-light:       var(--app-neutral-50);      /* #f8fafc */
  --el-fill-color-lighter:     var(--app-neutral-50);      /* #f8fafc */
  --el-fill-color-blank:       #ffffff;

  --el-bg-color:               #ffffff;
  --el-bg-color-page:          var(--app-neutral-50);      /* #f8fafc */
  --el-bg-color-overlay:       #ffffff;

  /* ===== 圆角覆写 ===== */
  --el-border-radius-base:     var(--radius-md);           /* 6px */
  --el-border-radius-small:    var(--radius-sm);           /* 4px */
  --el-border-radius-round:    var(--radius-full);         /* 9999px */

  /* ===== 字号覆写 ===== */
  --el-font-size-extra-large:  20px;
  --el-font-size-large:        16px;
  --el-font-size-medium:       14px;
  --el-font-size-base:         14px;
  --el-font-size-small:        13px;
  --el-font-size-extra-small:  12px;

  /* ===== 字体覆写 ===== */
  --el-font-family:            var(--font-sans);

  /* ===== 组件级覆写 ===== */

  /* 按钮高度 */
  --el-button-size-small:      28px;
  --el-button-size-default:    34px;
  --el-button-size-large:      40px;

  /* 输入框高度 */
  --el-input-height:           34px;
  --el-input-height-small:     28px;
  --el-input-height-large:     40px;

  /* 表格 */
  --el-table-header-bg-color:         var(--app-neutral-50);
  --el-table-header-text-color:       var(--app-neutral-600);
  --el-table-header-font-size:        12px;
  --el-table-row-hover-bg-color:      var(--app-neutral-50);
  --el-table-border-color:            var(--app-neutral-100);
  --el-table-header-border-color:     var(--app-neutral-200);

  /* 标签 */
  --el-tag-font-size:         12px;
  --el-tag-border-radius:     var(--radius-sm);            /* 4px */

  /* 弹窗 */
  --el-dialog-border-radius:  var(--radius-xl);            /* 12px */

  /* 抽屉 */
  --el-drawer-bg-color:       #ffffff;

  /* 菜单（左侧 el-menu 覆写） */
  --el-menu-bg-color:             var(--sidebar-bg);
  --el-menu-text-color:           var(--sidebar-text);
  --el-menu-hover-bg-color:       var(--sidebar-item-hover);
  --el-menu-active-color:         var(--sidebar-text-active);
  --el-menu-item-height:          40px;
  --el-menu-item-font-size:       14px;
}
```

### 9.3 覆写前后对比

| 属性 | Element Plus 默认 | 覆写后 | 变化说明 |
|------|-------------------|--------|---------|
| 主色 | `#409eff`（蓝） | `#3f6fef`（Atlas Blue，对齐 ZXQL-MS） | 更纯粹的蓝，与 MS 统一 |
| 成功色 | `#67c23a`（绿） | `#0ea879`（对齐 MS success） | 更沉稳的绿 |
| 警告色 | `#e6a23c`（橙） | `#d48b3a`（对齐 MS warning） | 更温暖的琥珀色 |
| 危险色 | `#f56c6c`（红） | `#c0392b`（对齐 MS danger） | 更收敛的红 |
| 正文色 | `#303133` | `#444444`（纯灰 neutral-600） | 稍浅，减轻视觉疲劳 |
| 边框色 | `#dcdfe6` | `#e2e2e2`（纯灰 neutral-200） | 更轻的边框 |
| 圆角基准 | `4px` | `6px` | 稍大，更现代 |
| 字号基准 | `14px` | `14px` | 保持一致 |
| 按钮高度 | `32px` | `34px` | 略高，更易点击 |
| 输入框高度 | `32px` | `34px` | 与按钮统一 |
| 表格表头字号 | `14px` | `12px` | 与正文区分 |
| 标签圆角 | `4px` | `4px` | 保持一致 |
| 弹窗圆角 | `8px` | `12px` | 更柔和 |

---

## 10. 页面设计要点

### 10.1 首页工作台（`/home`）

**布局**：欢迎区 → 统计卡片 → 快捷入口

```
┌──────────────────────────────────────────────┐
│  你好，[用户名]                                │
│  欢迎使用智享全链运营系统，今日运营数据一览        │
├──────────────────────────────────────────────┤
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐│
│ │ 账号 │ │ 情报 │ │ 选题 │ │ 脚本 │ │ 素材 │ │ ...
│ │  12  │ │  45  │ │  8   │ │  3   │ │  27  │ │
│ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ │
├──────────────────────────────────────────────┤
│  快捷入口                                      │
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐  │
│ │ 账号矩阵│ │ 情报采集│ │ 选题策划│ │ 脚本创作│  │
│ └────────┘ └────────┘ └────────┘ └────────┘  │
└──────────────────────────────────────────────┘
```

**设计要点**：
- 统计卡片 7 列网格，每卡带独立色彩图标
- 快捷入口 8 个卡片式按钮，2-4 列网格
- 页面内容居中，max-width 1200px

### 10.2 列表页统一模板（筛选 + 表格 + 分页）

**适用页面**：账号矩阵、情报采集、脚本库、选题库、素材库、视频库、选品库、商品库、订单、对账、客服、权限、合规、技能等

```
┌──────────────────────────────────────────────┐
│ [页面标题]                       [+ 新建] 按钮 │
├──────────────────────────────────────────────┤
│ [筛选1 ▾] [筛选2 ▾] [筛选3 ▾] [关键词___] [查询]│
├──────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────┐ │
│ │ 表头1  │ 表头2  │ 表头3  │ ... │  操作   │ │
│ ├──────────────────────────────────────────┤ │
│ │ 数据   │ 标签   │ 描述   │ ... │ 编辑 删除│ │
│ │ 数据   │ 标签   │ 描述   │ ... │ 编辑 删除│ │
│ └──────────────────────────────────────────┘ │
│                          [◀ 1 2 3 ... 10 ▶]  │
└──────────────────────────────────────────────┘
```

**设计要点**：
- 筛选区一行排列，不超过 4 个筛选条件 + 关键词搜索框 + 查询/重置按钮
- 筛选区与表格间距 16px
- 「新建」按钮始终在页面右上角（与标题同行）
- 表格操作列右对齐，宽度固定 120-160px
- 操作列按钮：编辑（文字按钮 brand）、删除（文字按钮 danger），间距 8px
- 分页器右对齐，margin-top 16px

### 10.3 表单抽屉统一模板（创建/编辑）

**适用页面**：所有模块的新建/编辑操作

```
┌──────────────────────────────────────────────┐
│  新建账号                              [✕]    │
├──────────────────────────────────────────────┤
│                                              │
│  平台 *      [下拉选择 ▾]                     │
│                                              │
│  账号名称 *  [________________]               │
│                                              │
│  身份        [________________]               │
│                                              │
│  分组        [标签输入____]                    │
│                                              │
│  Token       [________________] [明文提示]     │
│                                              │
│  状态        [○ 正常  ○ 禁用]                  │
│                                              │
├──────────────────────────────────────────────┤
│                         [取消]  [确认创建]      │
└──────────────────────────────────────────────┘
```

**设计要点**：
- 抽屉宽度 480-560px（按表单复杂度选择）
- 表单字段间距 20px
- 标签在字段上方（垂直布局），标签字号 14px，字重 500
- 必填标记 `*` 红色（danger-500）
- 底部按钮右对齐，取消按钮（default） + 确认按钮（primary）
- 抽屉打开动画 300ms ease-spring
- 表单校验错误提示在字段下方，红色文字 12px

### 10.4 详情页统一模板

**适用页面**：账号详情、情报详情、发布详情等（弹窗/抽屉形式）

```
┌──────────────────────────────────────────────┐
│  账号详情                              [✕]    │
├──────────────────────────────────────────────┤
│                                              │
│  基本信息                                    │
│  ┌──────────────────────────────────────┐   │
│  │ 平台: 抖音    状态: ● 正常            │   │
│  │ 名称: xxx     身份: 品牌方            │   │
│  │ 分组: 美妆    粉丝: 12.3万            │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  健康状态                                    │
│  ┌──────────────────────────────────────┐   │
│  │ Token 状态: 有效                      │   │
│  │ 最后巡检: 2026-08-09 10:30            │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  健康事件                                    │
│  ┌──────────────────────────────────────┐   │
│  │ 08-09  Token 续期成功                 │   │
│  │ 08-05  流量异常预警                    │   │
│  └──────────────────────────────────────┘   │
│                                              │
├──────────────────────────────────────────────┤
│                          [关闭]               │
└──────────────────────────────────────────────┘
```

**设计要点**：
- 详情以抽屉展示（宽度 560-640px）
- 信息分区用卡片分隔，每区带标题
- 状态标签与列表页一致
- 底部仅「关闭」按钮
- 时间轴（健康事件）用竖线连接，左侧时间、右侧事件

### 10.5 登录页独立设计

**设计要点**：
- 背景采用浅色基调（对齐 ZXQL-MS「白底黑字」风格）：`var(--app-neutral-50)` 浅灰底，可叠加极淡的主色径向光晕或点阵（可选增强），**不使用深色渐变**
- 居中白色卡片（`var(--app-neutral-0)`），max-width 400px，边框 `var(--app-neutral-200)`，圆角 16px，阴影 `shadow-xl`
- 品牌名（智享全链运营系统）在卡片顶部居中，字号 22px Bold，颜色 `var(--app-neutral-800)`
- 输入框使用 `size="large"`（40px 高）
- 登录按钮全宽，高度 40px，主色 `var(--app-brand-500)` / hover `var(--app-brand-400)` / active `var(--app-brand-600)`
- 底部「没有账号？立即注册」链接，居中，颜色 `var(--app-brand-600)`

---

## 附录 A：CSS 变量完整清单

所有变量汇总，供阿澜直接复制到 `src/styles/variables.css`：

```css
:root {
  /* ========================================
     色彩系统
     ======================================== */

  /* 品牌主色（Atlas Blue，对齐 ZXQL-MS） */
  --app-brand-50:  #eef3fe;
  --app-brand-100: #dbe5fc;
  --app-brand-200: #b9cdf9;
  --app-brand-300: #8eaff4;
  --app-brand-400: #5a83f2;
  --app-brand-500: #3f6fef;
  --app-brand-600: #2f5bd6;
  --app-brand-700: #274bb4;
  --app-brand-800: #203c91;
  --app-brand-900: #1a2f73;

  /* 成功（对齐 MS success） */
  --app-success-50:  #e6f7f1;
  --app-success-100: #c8efe3;
  --app-success-500: #0ea879;
  --app-success-600: #0c9468;
  --app-success-700: #0a7a57;

  /* 警告（对齐 MS warning） */
  --app-warning-50:  #fbf2e6;
  --app-warning-100: #f5e3cd;
  --app-warning-500: #d48b3a;
  --app-warning-600: #b8762f;
  --app-warning-700: #985f25;

  /* 危险（对齐 MS danger） */
  --app-danger-50:  #faeae8;
  --app-danger-100: #f3d4d0;
  --app-danger-500: #c0392b;
  --app-danger-600: #a32f23;
  --app-danger-700: #85261c;

  /* 信息（同主色） */
  --app-info-50:  #eef3fe;
  --app-info-100: #dbe5fc;
  --app-info-500: #3f6fef;
  --app-info-600: #2f5bd6;
  --app-info-700: #274bb4;

  /* 中性色（纯灰阶，对齐 MS gray） */
  --app-neutral-0:   #ffffff;
  --app-neutral-50:  #f8f8f8;
  --app-neutral-100: #f0f0f0;
  --app-neutral-200: #e2e2e2;
  --app-neutral-300: #cccccc;
  --app-neutral-400: #999999;
  --app-neutral-500: #666666;
  --app-neutral-600: #444444;
  --app-neutral-700: #333333;
  --app-neutral-800: #222222;
  --app-neutral-900: #111111;

  /* 侧边栏（浅色商业后台，对齐 MS frost-sidebar） */
  --sidebar-bg:           #fafafa;
  --sidebar-text:         #444444;
  --sidebar-text-hover:   #222222;
  --sidebar-text-active:  #3f6fef;
  --sidebar-item-hover:   rgba(0,0,0,0.04);
  --sidebar-item-active:  rgba(63,111,239,0.12);
  --sidebar-divider:      rgba(0,0,0,0.06);
  --sidebar-group-title:  #999999;
  --sidebar-badge:        #3f6fef;
  --sidebar-collapsed-w:  72px;
  --sidebar-expanded-w:   208px;

  /* 数据可视化色板（对齐 MS 高饱和柔和调色板） */
  --app-driver-greed:    #e67e22;
  --app-driver-lazy:     #8e44ad;
  --app-driver-fear:     #c0392b;
  --app-driver-vanity:   #e84393;
  --app-driver-peep:     #16a085;
  --app-driver-lonely:   #5b6fd6;
  --app-driver-anger:    #b03227;
  --app-emotion-anger:    #d64541;
  --app-emotion-resonance:#9b59b6;
  --app-emotion-curiosity:#2980b9;
  --app-emotion-touch:    #e072a0;
  --app-emotion-anxiety:  #e0a12e;
  --app-emotion-thrill:   #27ae60;

  /* ========================================
     字体系统
     ======================================== */
  --font-sans: "Inter", "SF Pro Text", -apple-system, BlinkMacSystemFont,
               "PingFang SC", "Microsoft YaHei", "微软雅黑",
               "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-mono: "JetBrains Mono", "Fira Code", "SF Mono", "Cascadia Code",
               Consolas, "Courier New", monospace;
  --font-number: "Inter", "SF Pro Text", -apple-system, "PingFang SC",
                 "Microsoft YaHei", sans-serif;

  /* 字号 */
  --text-xs:      11px;
  --text-sm:      12px;
  --text-base-sm: 13px;
  --text-base:    14px;
  --text-md:      16px;
  --text-lg:      18px;
  --text-xl:      20px;
  --text-2xl:     24px;
  --text-3xl:     28px;
  --text-4xl:     32px;

  /* ========================================
     间距系统
     ======================================== */
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-5:  20px;
  --space-6:  24px;
  --space-8:  32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;

  /* 组件内间距 */
  --btn-padding-x-sm:  12px;
  --btn-padding-y-sm:  4px;
  --btn-padding-x-md:  16px;
  --btn-padding-y-md:  8px;
  --btn-padding-x-lg:  20px;
  --btn-padding-y-lg:  10px;
  --input-padding-x:   12px;
  --input-padding-y:   8px;
  --table-cell-padding-x: 12px;
  --table-cell-padding-y: 10px;
  --card-padding:      20px;
  --card-padding-sm:   16px;
  --content-padding:   24px;
  --page-max-width:    1400px;
  --drawer-width-sm:   480px;
  --drawer-width-md:   560px;
  --drawer-width-lg:   720px;

  /* ========================================
     圆角与阴影
     ======================================== */
  --radius-sm:   4px;
  --radius-md:   6px;
  --radius-lg:   8px;
  --radius-xl:   12px;
  --radius-2xl:  16px;
  --radius-full: 9999px;

  --shadow-none: none;
  --shadow-sm:   0 1px 2px 0 rgba(0,0,0,0.04);
  --shadow-md:   0 4px 12px rgba(0,0,0,0.06);
  --shadow-lg:   0 8px 24px rgba(0,0,0,0.08);
  --shadow-xl:   0 20px 60px rgba(0,0,0,0.12);

  /* ========================================
     动效
     ======================================== */
  --duration-fast:   120ms;
  --duration-normal: 200ms;
  --duration-slow:   300ms;
  --ease-out:    cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in:     cubic-bezier(0.4, 0, 1, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

---

## 附录 B：落地执行清单

阿澜落地时请按以下顺序执行：

| 序号 | 任务 | 说明 |
|------|------|------|
| 1 | 创建 `src/styles/variables.css` | 复制附录 A 完整 CSS 变量 |
| 2 | 创建 `src/styles/element-override.css` | 复制 §9.2 覆写清单 |
| 3 | 创建 `src/styles/global.css` | 全局样式：滚动条、focus-ring、body 默认字体/背景 |
| 4 | 修改 `main.ts` | 引入顺序：element-plus/dist/index.css → variables.css → element-override.css → global.css |
| 5 | 修改 `BasicLayout.vue` | 侧边栏颜色变量化（引用 CSS 变量而非硬编码 hex） |
| 6 | 修改 `HomeView.vue` | 统计卡片/快捷入口颜色变量化 |
| 7 | 修改 `LoginView.vue` | 背景/卡片颜色变量化 |
| 8 | 逐个功能页改造 | 列表页模板、抽屉模板、详情模板对齐 §10 |

---

> **设计交付完成**。阿澜在落地过程中遇到任何设计规范不明确之处，随时找林深（林深）确认。所有设计决策以本规范为准。
