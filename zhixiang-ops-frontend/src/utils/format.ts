// 展示格式化工具：时间戳、金额、计数（粉丝数等）

// 格式化时间戳为 YYYY-MM-DD HH:mm:ss
export function formatDateTime(value?: string | number | Date | null): string {
  if (value == null || value === '') return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  )
}

// 仅日期 YYYY-MM-DD
export function formatDate(value?: string | number | Date | null): string {
  if (value == null || value === '') return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// 金额格式化（默认分→元，可传原始为元）
export function formatAmount(
  value?: number | null,
  options: { prefix?: string; digits?: number; fromCents?: boolean } = {},
): string {
  const { prefix = '¥', digits = 2, fromCents = false } = options
  if (value == null || Number.isNaN(value)) return '-'
  const amount = fromCents ? value / 100 : value
  return `${prefix}${amount.toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`
}

// 大数缩写：12345 → 1.2万，1234567 → 123.5万
export function formatCount(value?: number | null): string {
  if (value == null || Number.isNaN(value)) return '-'
  if (value < 10000) return String(value)
  if (value < 100000000) {
    const wan = value / 10000
    return `${wan >= 100 ? Math.round(wan) : wan.toFixed(1)}万`
  }
  const yi = value / 100000000
  return `${yi >= 100 ? Math.round(yi) : yi.toFixed(1)}亿`
}
