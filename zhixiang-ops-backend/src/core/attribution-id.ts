import { createHash } from 'crypto';

/**
 * 全局归因标识（规划核心设计：attribution_id）。
 * 格式：attr_<tenant>_<type>_<hash32>
 *  - 源头生成一次，沿采集→人性分析→选题→脚本→发布→回收链路只读透传
 *  - 跨域不建物理外键，仅透传字符串
 */

export type AttributionType = 'content' | 'live' | 'ad';

const TYPE_SET: ReadonlySet<string> = new Set(['content', 'live', 'ad']);

export function generateAttributionId(
  tenantId: string,
  type: AttributionType,
  seed: string,
): string {
  const hash = createHash('sha256')
    .update(`${tenantId}:${type}:${seed}`)
    .digest('hex')
    .slice(0, 32);
  return `attr_${tenantId}_${type}_${hash}`;
}

export interface ParsedAttribution {
  tenantId: string;
  type: AttributionType;
  hash: string;
}

export function parseAttributionId(id: string): ParsedAttribution | null {
  const m = /^attr_([^_]+)_(content|live|ad)_([0-9a-f]{32})$/.exec(id);
  if (!m) return null;
  return { tenantId: m[1], type: m[2] as AttributionType, hash: m[3] };
}

export function isAttributionType(v: unknown): v is AttributionType {
  return typeof v === 'string' && TYPE_SET.has(v);
}
