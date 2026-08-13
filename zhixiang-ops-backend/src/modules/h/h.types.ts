/** H 智能成片视图类型（规划 §4-H / 开发顺序 H 智能成片） */

export interface VideoView {
  id: number;
  scriptId: number;
  materialIds: number[] | null;
  ratio: string | null;
  duration: number | null;
  url: string | null;
  reviewStatus: string;
  status: string;
  title: string | null;
  meta: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}
