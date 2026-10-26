import { describe, expect, it } from 'vitest'
import {
  allMenuPaths,
  ecommerceMenuGroups,
  globalCategories,
  menuGroups,
  videoMenuGroups,
} from './menu'

describe('config/menu 导航结构', () => {
  it('videoMenuGroups 共 7 大分组且每分组 ≥3 个目录', () => {
    expect(videoMenuGroups).toHaveLength(7)
    for (const group of videoMenuGroups) {
      expect(group.children.length).toBeGreaterThanOrEqual(3)
      for (const item of group.children) {
        expect(item.title).toBeTruthy()
        expect(item.path).toMatch(/^\//)
      }
    }
  })

  it('视频运营每个目录都带 AI 快捷动作提示', () => {
    const items = videoMenuGroups.flatMap((g) => g.children)
    expect(items.length).toBeGreaterThanOrEqual(26)
    for (const item of items) expect(item.aiPrompt).toBeTruthy()
  })

  it('ecommerceMenuGroups 共 7 大分组且每分组 ≥3 个目录', () => {
    expect(ecommerceMenuGroups).toHaveLength(7)
    for (const group of ecommerceMenuGroups) {
      expect(group.children.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('globalCategories 固定 4 个一级类目', () => {
    expect(globalCategories).toHaveLength(4)
    expect(globalCategories.map((c) => c.title)).toEqual([
      '经营中心',
      'AI 中心',
      '系统管理',
      '个人中心',
    ])
  })

  it('menuGroups 合并视频 + 电商菜单与全局类目', () => {
    expect(menuGroups).toHaveLength(
      videoMenuGroups.length + ecommerceMenuGroups.length + globalCategories.length,
    )
  })

  it('allMenuPaths 去重且全部以 / 开头', () => {
    expect(allMenuPaths.length).toBeGreaterThan(0)
    expect(new Set(allMenuPaths).size).toBe(allMenuPaths.length)
    for (const path of allMenuPaths) expect(path).toMatch(/^\//)
  })
})
