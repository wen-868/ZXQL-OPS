import {
  TopicHeatStrategy,
  TopicEmotionStrategy,
  TopicConversionStrategy,
  TopicNoveltyStrategy,
  TopicCompositeStrategy,
} from './topic.strategies';
import { TopicService } from '../../topic/topic.service';
import { VideoChainContext, VideoStageResult, VideoStrategy } from '../video-automation.types';

/** 只消费 ctx 单参的 run 签名（VideoStrategy.run 带可选 config，与各策略单参实现不兼容） */
type SingleRunVideoStrategy = Pick<VideoStrategy, 'meta'> & {
  run(ctx: VideoChainContext): Promise<VideoStageResult>;
};

/**
 * 选题阶段（E）5 策略测试。
 * mock TopicService.generateTopics，覆盖：
 * - analysisTaskIds 存在 → 携带 analysisId 调用（消费人性分析洞察）
 * - analysisTaskIds 缺失 → 不带 analysisId（回退知识库聚合）
 * - 各策略透传对应 emotion/driver（综合策略仅 limit=8）
 */

const cases: Array<{
  name: string;
  Strategy: new (t: TopicService) => SingleRunVideoStrategy;
  params: (analysisId?: number) => Record<string, unknown>;
}> = [
  {
    name: 'TopicHeatStrategy',
    Strategy: TopicHeatStrategy,
    params: (analysisId) => ({ emotion: '好奇', limit: 5, ...(analysisId ? { analysisId } : {}) }),
  },
  {
    name: 'TopicEmotionStrategy',
    Strategy: TopicEmotionStrategy,
    params: (analysisId) => ({ emotion: '共鸣', limit: 5, ...(analysisId ? { analysisId } : {}) }),
  },
  {
    name: 'TopicConversionStrategy',
    Strategy: TopicConversionStrategy,
    params: (analysisId) => ({ driver: '贪', limit: 5, ...(analysisId ? { analysisId } : {}) }),
  },
  {
    name: 'TopicNoveltyStrategy',
    Strategy: TopicNoveltyStrategy,
    params: (analysisId) => ({ driver: '窥探', limit: 5, ...(analysisId ? { analysisId } : {}) }),
  },
  {
    name: 'TopicCompositeStrategy',
    Strategy: TopicCompositeStrategy,
    params: (analysisId) => ({ limit: 8, ...(analysisId ? { analysisId } : {}) }),
  },
];

describe('topic.strategies', () => {
  let topic: { generateTopics: jest.Mock };

  beforeEach(() => {
    topic = { generateTopics: jest.fn() };
  });

  for (const { name, Strategy, params } of cases) {
    describe(name, () => {
      it('有 analysisTaskIds 时携带 analysisId 生成选题', async () => {
        topic.generateTopics.mockResolvedValue({ topics: [{ id: 301 }, { id: 302 }] });
        const s = new Strategy(topic as unknown as TopicService);
        const res = await s.run({ tenantId: 'tn-1', analysisTaskIds: [9] });
        expect(topic.generateTopics).toHaveBeenCalledWith(params(9));
        expect(res.topicIds).toEqual([301, 302]);
        expect(res.strategy).toBe(s.meta.key);
      });

      it('无 analysisTaskIds 时不携带 analysisId（回退知识库聚合）', async () => {
        topic.generateTopics.mockResolvedValue({ topics: [{ id: 303 }] });
        const s = new Strategy(topic as unknown as TopicService);
        const res = await s.run({ tenantId: 'tn-1' });
        expect(topic.generateTopics).toHaveBeenCalledWith(params(undefined));
        expect(res.topicIds).toEqual([303]);
        expect(res.strategy).toBe(s.meta.key);
      });
    });
  }
});
