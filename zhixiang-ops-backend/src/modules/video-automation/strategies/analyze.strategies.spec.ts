import {
  AnalyzeCommentsDouyinStrategy,
  AnalyzeLiveKuaishouStrategy,
  AnalyzeAdCompetitorStrategy,
  AnalyzeCommentsXhsStrategy,
  AnalyzeCommentsBilibiliStrategy,
} from './analyze.strategies';
import { AnalyzeService } from '../../analyze/analyze.service';
import { AnalysisSource } from '../../analyze/analyze.types';
import { VideoChainContext, VideoStageResult, VideoStrategy } from '../video-automation.types';

/** 只消费 ctx 单参的 run 签名（VideoStrategy.run 带可选 config，与各策略单参实现不兼容） */
type SingleRunVideoStrategy = Pick<VideoStrategy, 'meta'> & {
  run(ctx: VideoChainContext): Promise<VideoStageResult>;
};

/**
 * 人性分析阶段（D）5 策略测试。
 * mock AnalyzeService.createAnalysisTask，覆盖：
 * - 成功 → 返回 [taskId]
 * - 失败(Error) → 降级：degraded=true、note=message、空 taskIds（不中断链路）
 * - 失败(非 Error) → 降级：note 固定 'analyze unavailable'
 */

const cases: Array<{
  name: string;
  Strategy: new (a: AnalyzeService) => SingleRunVideoStrategy;
  source: AnalysisSource;
  platform: string;
  commentLimit: number;
}> = [
  {
    name: 'AnalyzeCommentsDouyinStrategy',
    Strategy: AnalyzeCommentsDouyinStrategy,
    source: AnalysisSource.Comments,
    platform: 'douyin',
    commentLimit: 30,
  },
  {
    name: 'AnalyzeLiveKuaishouStrategy',
    Strategy: AnalyzeLiveKuaishouStrategy,
    source: AnalysisSource.Live,
    platform: 'kuaishou',
    commentLimit: 30,
  },
  {
    name: 'AnalyzeAdCompetitorStrategy',
    Strategy: AnalyzeAdCompetitorStrategy,
    source: AnalysisSource.Ad,
    platform: 'douyin',
    commentLimit: 20,
  },
  {
    name: 'AnalyzeCommentsXhsStrategy',
    Strategy: AnalyzeCommentsXhsStrategy,
    source: AnalysisSource.Comments,
    platform: 'xiaohongshu',
    commentLimit: 30,
  },
  {
    name: 'AnalyzeCommentsBilibiliStrategy',
    Strategy: AnalyzeCommentsBilibiliStrategy,
    source: AnalysisSource.Comments,
    platform: 'bilibili',
    commentLimit: 30,
  },
];

describe('analyze.strategies', () => {
  let analyze: { createAnalysisTask: jest.Mock };

  beforeEach(() => {
    analyze = { createAnalysisTask: jest.fn() };
  });

  for (const { name, Strategy, source, platform, commentLimit } of cases) {
    describe(name, () => {
      it('创建分析任务成功时返回 [taskId]', async () => {
        analyze.createAnalysisTask.mockResolvedValue({ taskId: 77 });
        const s = new Strategy(analyze as unknown as AnalyzeService);
        const res = await s.run({ tenantId: 'tn-1' });
        expect(analyze.createAnalysisTask).toHaveBeenCalledWith({
          source,
          platform,
          commentLimit,
        });
        expect(res.analysisTaskIds).toEqual([77]);
        expect(res.degraded).toBeUndefined();
        expect(res.strategy).toBe(s.meta.key);
      });

      it('创建分析任务抛 Error 时降级为无输入', async () => {
        analyze.createAnalysisTask.mockRejectedValue(new Error('COMMENT_EMPTY'));
        const s = new Strategy(analyze as unknown as AnalyzeService);
        const res = await s.run({ tenantId: 'tn-1' });
        expect(res.analysisTaskIds).toEqual([]);
        expect(res.degraded).toBe(true);
        expect(res.note).toBe('COMMENT_EMPTY');
        expect(res.strategy).toBe(s.meta.key);
      });

      it('创建分析任务抛非 Error 时 note 固定为 analyze unavailable', async () => {
        analyze.createAnalysisTask.mockRejectedValue('raw-boom');
        const s = new Strategy(analyze as unknown as AnalyzeService);
        const res = await s.run({ tenantId: 'tn-1' });
        expect(res.degraded).toBe(true);
        expect(res.note).toBe('analyze unavailable');
        expect(res.analysisTaskIds).toEqual([]);
      });
    });
  }
});
