/**
 * K 直播中心类型（规划 §4-K / 开发顺序设计.md）。
 * - 真人+数字人双形态；直播间关联 B 账号、挂载 R 商品、生成 live 类 attribution_id。
 */

export type LiveRoomType = 'real' | 'digital';
export type LiveRoomStatus = 'created' | 'live' | 'ended';
export type LiveAiReplyStatus = 'auto' | 'pending';

export interface LiveRoomView {
  id: number;
  type: LiveRoomType;
  platform: string;
  accountId: number;
  rtmpUrl: string | null;
  status: LiveRoomStatus;
  title: string | null;
  productIds: number[];
  attributionId: string;
  startedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  /** B 矩阵联动：账号所属分组（分组不存在/未分组为 null） */
  accountGroupId: number | null;
  accountGroupName: string | null;
  /** B 矩阵联动：账号健康分（未沉淀时按状态基准兜底） */
  accountHealthScore: number | null;
}

export interface DigitalHumanView {
  id: number;
  name: string;
  avatar: string | null;
  voice: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LiveDanmuView {
  id: number;
  roomId: number;
  content: string;
  isAiReply: boolean;
  aiReply: string | null;
  ts: Date;
}

export interface LiveAiReplyView {
  id: number;
  roomId: number;
  question: string;
  answer: string | null;
  status: LiveAiReplyStatus;
}

export interface LiveStatView {
  id: number;
  roomId: number;
  onlineCount: number;
  gmv: number;
  attributionId: string;
  ts: Date;
}
