import { describe, expect, it } from 'vitest'
import { formatAmount, formatCount, formatDate, formatDateTime } from './format'

describe('utils/format 格式化工具', () => {
  it('formatDateTime 格式化时间戳为 YYYY-MM-DD HH:mm:ss', () => {
    const d = new Date(2024, 0, 2, 3, 4, 5)
    expect(formatDateTime(d)).toBe('2024-01-02 03:04:05')
    expect(formatDateTime(d.getTime())).toBe('2024-01-02 03:04:05')
    expect(formatDateTime('2024-01-02T03:04:05')).toMatch(/^2024-01-02 /)
  })

  it('formatDateTime 空值 / 非法值返回 -', () => {
    expect(formatDateTime(null)).toBe('-')
    expect(formatDateTime(undefined)).toBe('-')
    expect(formatDateTime('')).toBe('-')
    expect(formatDateTime('not-a-date')).toBe('-')
  })

  it('formatDate 仅返回日期部分', () => {
    const d = new Date(2024, 6, 15, 23, 59, 59)
    expect(formatDate(d)).toBe('2024-07-15')
    expect(formatDate(null)).toBe('-')
    expect(formatDate('invalid')).toBe('-')
  })

  it('formatAmount 默认原值并保留 2 位小数', () => {
    expect(formatAmount(12345)).toBe('¥12,345.00')
    expect(formatAmount(12.3)).toBe('¥12.30')
    expect(formatAmount(12345, { fromCents: true })).toBe('¥123.45')
    expect(formatAmount(123, { prefix: '$', digits: 0 })).toBe('$123')
  })

  it('formatAmount 空值 / NaN 返回 -', () => {
    expect(formatAmount(null)).toBe('-')
    expect(formatAmount(undefined)).toBe('-')
    expect(formatAmount(Number.NaN)).toBe('-')
  })

  it('formatCount 大数缩写为 万 / 亿', () => {
    expect(formatCount(9999)).toBe('9999')
    expect(formatCount(12345)).toBe('1.2万')
    expect(formatCount(1234567)).toBe('123万')
    expect(formatCount(9999999)).toBe('1000万')
    expect(formatCount(123456789)).toBe('1.2亿')
    expect(formatCount(10000000000)).toBe('100亿')
  })

  it('formatCount 空值 / NaN 返回 -', () => {
    expect(formatCount(null)).toBe('-')
    expect(formatCount(Number.NaN)).toBe('-')
  })
})
