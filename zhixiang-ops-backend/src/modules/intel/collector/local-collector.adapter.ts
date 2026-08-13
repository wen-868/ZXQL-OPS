import { CollectorAdapter, RawComment, RawHot } from './collector.adapter';
import { CollectTaskEntity } from '../collect-task.entity';
import { HotType } from '../intel.types';

/**
 * 本地开发采集适配器（生产替换为平台 API 适配器）。
 * 返回结构化样本数据，用于在本环境跑通「采集→清洗→去重→落库→D 消费」全链路；
 * 样本中刻意混入 手机号 / 地理 / 广告词，以验证合规清洗逻辑真实生效。
 * 真实平台（douyin 等）适配器接入后，业务管线（清洗/去重/审计/限流）无需改动。
 */
const SAMPLE_COMMENTS: RawComment[] = [
  {
    sourceRef: 'vid-1001',
    content: '这个口红真的绝了，姐妹们冲！',
    authorId: 'u_8821',
    likes: 1203,
  },
  {
    sourceRef: 'vid-1002',
    content: '加微信 abc888 有内部价，私聊我',
    authorId: 'u_5512',
    likes: 33,
  },
  {
    sourceRef: 'vid-1003',
    content: '我的电话13800138000，方便联系',
    authorId: 'u_9931',
    likes: 12,
  },
  { sourceRef: 'vid-1004', content: '看完直接下单了，太好用了吧', authorId: 'u_2210', likes: 540 },
  { sourceRef: 'vid-1005', content: '坐标是北京朝阳区，求同城拼单', authorId: 'u_7765', likes: 88 },
];

export class LocalCollectorAdapter implements CollectorAdapter {
  fetchComments(task: CollectTaskEntity): Promise<RawComment[]> {
    void task;
    return Promise.resolve(SAMPLE_COMMENTS.map((c) => ({ ...c, collectedAt: new Date() })));
  }

  fetchHot(platform: string, hotType: HotType): Promise<RawHot[]> {
    void platform;
    return Promise.resolve([
      { hotType, title: '618 美妆爆款清单', heat: 98231, url: 'https://example.com/hot/1' },
      { hotType, title: '平价好物实测', heat: 65120, url: 'https://example.com/hot/2' },
    ]);
  }

  mineKeywords(platform: string, target: string): Promise<string[]> {
    void platform;
    return Promise.resolve([`${target}测评`, `${target}平替`, `${target}攻略`, `${target}红黑榜`]);
  }
}
