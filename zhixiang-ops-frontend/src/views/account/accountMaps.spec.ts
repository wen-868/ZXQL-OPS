import { describe, expect, it } from 'vitest'
import {
  identityLabels,
  identityOptions,
  platformLabels,
  platformOptions,
  stageLabels,
  stageOptions,
  statusMeta,
  statusOptions,
} from './accountMaps'

describe('views/account/accountMaps 映射表', () => {
  it('平台 / 身份 / 阶段 / 状态映射完整', () => {
    expect(platformLabels).toEqual({
      douyin: '抖音',
      kuaishou: '快手',
      xiaohongshu: '小红书',
      bilibili: 'B站',
      'wechat-channels': '视频号',
    })
    expect(identityLabels).toEqual({ primary: '主号', secondary: '副号', matrix: '矩阵号' })
    expect(stageLabels).toEqual({
      nurturing: '培育期',
      growing: '成长期',
      mature: '成熟期',
      declining: '衰退期',
    })
    expect(statusMeta.normal).toEqual({ label: '正常', type: 'success' })
    expect(statusMeta.risk).toEqual({ label: '风险', type: 'danger' })
    expect(statusMeta.banned).toEqual({ label: '封禁', type: 'default' })
  })

  it('下拉选项由映射生成且顺序稳定', () => {
    expect(platformOptions).toEqual([
      { value: 'douyin', label: '抖音' },
      { value: 'kuaishou', label: '快手' },
      { value: 'xiaohongshu', label: '小红书' },
      { value: 'bilibili', label: 'B站' },
      { value: 'wechat-channels', label: '视频号' },
    ])
    expect(identityOptions).toHaveLength(3)
    expect(stageOptions).toHaveLength(4)
    expect(statusOptions).toEqual([
      { value: 'normal', label: '正常' },
      { value: 'warning', label: '预警' },
      { value: 'risk', label: '风险' },
      { value: 'unsigned', label: '未签约' },
      { value: 'banned', label: '封禁' },
    ])
  })
})
