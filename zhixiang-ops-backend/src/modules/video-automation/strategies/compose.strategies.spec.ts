import {
  ComposeVerticalStrategy,
  ComposeSquareStrategy,
  ComposeHorizontalStrategy,
  ComposeHighlightStrategy,
  ComposeAutoStrategy,
} from './compose.strategies';
import { VideoService } from '../../h/h.service';
import { VideoChainContext, VideoStageResult, VideoStrategy } from '../video-automation.types';

/** 只消费 ctx 单参的 run 签名（VideoStrategy.run 带可选 config，与各策略单参实现不兼容） */
type SingleRunVideoStrategy = Pick<VideoStrategy, 'meta'> & {
  run(ctx: VideoChainContext): Promise<VideoStageResult>;
};

/**
 * 成片阶段（H）5 策略测试。
 * 每个策略独立实例化（mock VideoService.fromScript），覆盖：
 * - scriptIds 存在 → 逐脚本合成，videoIds 汇总
 * - scriptIds 为空/缺失 → 空视频列表（不误产成片）
 * - 高光混剪策略携带 title 参数
 */

function makeVideo(overrides?: Partial<{ id: number }>) {
  return { id: 100 + Math.floor(Math.random() * 1000), ...overrides };
}

describe('compose.strategies', () => {
  let video: { fromScript: jest.Mock };
  let ctx: VideoChainContext;

  beforeEach(() => {
    video = { fromScript: jest.fn() };
    ctx = { tenantId: 'tn-1', chainRunId: 'r-1', scriptIds: [1, 2] };
  });

  const cases: Array<{
    name: string;
    Strategy: new (v: VideoService) => SingleRunVideoStrategy;
    ratio: string;
  }> = [
    { name: 'ComposeVerticalStrategy', Strategy: ComposeVerticalStrategy, ratio: '9:16' },
    { name: 'ComposeSquareStrategy', Strategy: ComposeSquareStrategy, ratio: '1:1' },
    { name: 'ComposeHorizontalStrategy', Strategy: ComposeHorizontalStrategy, ratio: '16:9' },
    { name: 'ComposeAutoStrategy', Strategy: ComposeAutoStrategy, ratio: '9:16' },
  ];

  for (const { name, Strategy, ratio } of cases) {
    describe(name, () => {
      it('对每个 scriptId 调用 fromScript 并汇总 videoIds', async () => {
        video.fromScript.mockResolvedValueOnce(makeVideo()).mockResolvedValueOnce(makeVideo());
        const s = new Strategy(video as unknown as VideoService);
        const res = await s.run(ctx);
        expect(video.fromScript).toHaveBeenCalledTimes(2);
        expect(video.fromScript).toHaveBeenNthCalledWith(1, {
          scriptId: 1,
          materialIds: [],
          ratio,
        });
        expect(video.fromScript).toHaveBeenNthCalledWith(2, {
          scriptId: 2,
          materialIds: [],
          ratio,
        });
        expect(res.videoIds).toHaveLength(2);
        expect(res.strategy).toBe(s.meta.key);
      });

      it('scriptIds 缺失时返回空 videoIds 且不调用 fromScript', async () => {
        const s = new Strategy(video as unknown as VideoService);
        const res = await s.run({ tenantId: 'tn-1' });
        expect(video.fromScript).not.toHaveBeenCalled();
        expect(res.videoIds).toEqual([]);
        expect(res.strategy).toBe(s.meta.key);
      });

      it('scriptIds 为空数组时同样返回空 videoIds', async () => {
        const s = new Strategy(video as unknown as VideoService);
        const res = await s.run({ tenantId: 'tn-1', scriptIds: [] });
        expect(video.fromScript).not.toHaveBeenCalled();
        expect(res.videoIds).toEqual([]);
      });
    });
  }

  describe('ComposeHighlightStrategy', () => {
    it('以 9:16 高光混剪标题合成，透传 materialIds', async () => {
      video.fromScript.mockResolvedValue(makeVideo());
      const s = new ComposeHighlightStrategy(video as unknown as VideoService);
      const res = await s.run({ tenantId: 'tn-1', scriptIds: [7], materialIds: [3, 4] });
      expect(video.fromScript).toHaveBeenCalledWith({
        scriptId: 7,
        materialIds: [3, 4],
        ratio: '9:16',
        title: '高光混剪',
      });
      expect(res.strategy).toBe('compose_highlight');
      expect(res.videoIds).toHaveLength(1);
    });

    it('scriptIds 缺失时返回空 videoIds', async () => {
      const s = new ComposeHighlightStrategy(video as unknown as VideoService);
      const res = await s.run({ tenantId: 'tn-1' });
      expect(video.fromScript).not.toHaveBeenCalled();
      expect(res.videoIds).toEqual([]);
    });
  });
});
