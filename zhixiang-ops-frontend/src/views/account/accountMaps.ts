import type {
  AccountStatus,
  Identity,
  Platform,
  Stage,
} from '@/api/accounts'

// 平台中文名
export const platformLabels: Record<Platform, string> = {
  douyin: '抖音',
  kuaishou: '快手',
  xiaohongshu: '小红书',
  bilibili: 'B站',
  'wechat-channels': '视频号',
}

// 身份中文名
export const identityLabels: Record<Identity, string> = {
  primary: '主号',
  secondary: '副号',
  matrix: '矩阵号',
}

// 阶段中文名
export const stageLabels: Record<Stage, string> = {
  nurturing: '培育期',
  growing: '成长期',
  mature: '成熟期',
  declining: '衰退期',
}

// 状态标签色：normal=绿 warning=黄 risk=红 unsigned=灰 banned=黑(禁用)
export const statusMeta: Record<
  AccountStatus,
  { label: string; type: 'success' | 'warning' | 'danger' | 'info' | 'default' }
> = {
  normal: { label: '正常', type: 'success' },
  warning: { label: '预警', type: 'warning' },
  risk: { label: '风险', type: 'danger' },
  unsigned: { label: '未签约', type: 'info' },
  banned: { label: '封禁', type: 'default' },
}

// 平台下拉选项
export const platformOptions = Object.entries(platformLabels).map(
  ([value, label]) => ({ value: value as Platform, label }),
)
// 身份下拉选项
export const identityOptions = Object.entries(identityLabels).map(
  ([value, label]) => ({ value: value as Identity, label }),
)
// 阶段下拉选项
export const stageOptions = Object.entries(stageLabels).map(
  ([value, label]) => ({ value: value as Stage, label }),
)
// 状态下拉选项
export const statusOptions = Object.entries(statusMeta).map(
  ([value, meta]) => ({ value: value as AccountStatus, label: meta.label }),
)
