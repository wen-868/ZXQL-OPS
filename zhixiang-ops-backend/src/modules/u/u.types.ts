/**
 * U 粉丝与私域运营类型（规划 §4-U / 开发顺序设计.md）。
 * 合规边界（§11②）：仅存聚合分布与公开字段，不落个体隐私（禁精准地理位置/个体画像）。
 */

export type FansSource = 'aggregate' | 'authorized' | 'public';
export type PrivateGroupType = 'wecom' | 'wechat';

export interface FansProfileView {
  id: number;
  platform: string;
  publicId: string;
  level: string;
  interactAgg: Record<string, unknown> | null;
  tags: string[] | null;
  source: FansSource;
  createdAt: Date;
  updatedAt: Date;
}

export interface PrivateGroupView {
  id: number;
  name: string;
  members: string[];
  type: PrivateGroupType;
  createdAt: Date;
  updatedAt: Date;
}
