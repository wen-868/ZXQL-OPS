import {
  RecycleTrafficStrategy,
  RecycleInteractionStrategy,
  RecycleConversionStrategy,
  RecycleSentimentStrategy,
  RecycleCompositeStrategy,
} from './recycle.strategies';
import { RecycleService } from '../../recycle/recycle.service';
import { VideoChainContext, VideoStageResult, VideoStrategy } from '../video-automation.types';

/** 只消费 ctx 单参的 run 签名（VideoStrategy.run 带可选 config，与各策略单参实现不兼容） */
type SingleRunVideoStrategy = Pick<VideoStrategy, 'meta'> & {
  run(ctx: VideoChainContext): Promise<VideoStageResult>;
};

/**
 * 数据回收验证阶段（L）5 策略测试。
 * mock RecycleService.createVideoRecycleTasks + collectAndScore，覆盖：
 * - publishTaskIds 存在 → 创建回收任务并逐任务 collectAndScore，汇总 recycleTaskIds
 * - publishTaskIds 缺失 → 空任务列表（不误建回收任务）
 */

const cases: Array<{
  name: string;
  Strategy: new (r: RecycleService) => SingleRunVideoStrategy;
  metric: string;
}> = [
  { name: 'RecycleTrafficStrategy', Strategy: RecycleTrafficStrategy, metric: 'traffic' },
  {
    name: 'RecycleInteractionStrategy',
    Strategy: RecycleInteractionStrategy,
    metric: 'interaction',
  },
  { name: 'RecycleConversionStrategy', Strategy: RecycleConversionStrategy, metric: 'conversion' },
  { name: 'RecycleSentimentStrategy', Strategy: RecycleSentimentStrategy, metric: 'sentiment' },
  { name: 'RecycleCompositeStrategy', Strategy: RecycleCompositeStrategy, metric: 'composite' },
];

describe('recycle.strategies', () => {
  let recycle: { createVideoRecycleTasks: jest.Mock; collectAndScore: jest.Mock };
  let ctx: VideoChainContext;

  beforeEach(() => {
    recycle = {
      createVideoRecycleTasks: jest.fn(),
      collectAndScore: jest.fn(),
    };
    ctx = { tenantId: 'tn-1', chainRunId: 'r-1', publishTaskIds: [1, 2] };
  });

  for (const { name, Strategy, metric } of cases) {
    describe(name, () => {
      it('按发布任务创建回收任务并逐任务打分', async () => {
        recycle.createVideoRecycleTasks.mockResolvedValue([{ id: 11 }, { id: 12 }]);
        recycle.collectAndScore.mockResolvedValue(undefined);
        const s = new Strategy(recycle as unknown as RecycleService);
        const res = await s.run(ctx);
        expect(recycle.createVideoRecycleTasks).toHaveBeenCalledWith([1, 2], metric);
        expect(recycle.collectAndScore).toHaveBeenCalledTimes(2);
        expect(recycle.collectAndScore).toHaveBeenNthCalledWith(1, 11, { metric });
        expect(recycle.collectAndScore).toHaveBeenNthCalledWith(2, 12, { metric });
        expect(res.recycleTaskIds).toEqual([11, 12]);
        expect(res.strategy).toBe(s.meta.key);
      });

      it('publishTaskIds 缺失时不创建回收任务', async () => {
        recycle.createVideoRecycleTasks.mockResolvedValue([]);
        const s = new Strategy(recycle as unknown as RecycleService);
        const res = await s.run({ tenantId: 'tn-1' });
        expect(recycle.createVideoRecycleTasks).toHaveBeenCalledWith([], metric);
        expect(recycle.collectAndScore).not.toHaveBeenCalled();
        expect(res.recycleTaskIds).toEqual([]);
        expect(res.strategy).toBe(s.meta.key);
      });
    });
  }
});
