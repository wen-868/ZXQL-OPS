/** G 素材中心视图类型（规划 §4-G / 开发顺序 G 素材中心） */

export interface MaterialView {
  id: number;
  type: string;
  source: string;
  url: string | null;
  ratio: string | null;
  tags: string[] | null;
  relatedScriptId: number | null;
  status: string;
  meta: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListMaterialFilter {
  tag?: string;
  type?: string;
}
