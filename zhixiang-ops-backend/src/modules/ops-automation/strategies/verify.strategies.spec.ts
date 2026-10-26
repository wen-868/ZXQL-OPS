import {
  VerifyTrafficStrategy,
  VerifyInteractionStrategy,
  VerifyConversionStrategy,
  VerifySentimentStrategy,
  VerifyCompositeStrategy,
} from './verify.strategies';

/**
 * 验证阶段 5 种策略：统一走 RecycleService 回收与打分。
 * 覆盖：有发布任务时逐条回收打分（skipped=false）、无发布任务时 skipped=true 空跑。
 */

const STRATEGIES = [
  VerifyTrafficStrategy,
  VerifyInteractionStrategy,
  VerifyConversionStrategy,
  VerifySentimentStrategy,
  VerifyCompositeStrategy,
];

describe('verify.strategies', () => {
  const makeSvc = () => ({
    recycleService: {
      createVideoRecycleTasks: jest.fn(),
      collectAndScore: jest.fn(),
    },
  });

  it.each(STRATEGIES.map((C) => [C.name, C]))(
    '%s 有发布任务：逐条回收打分且 skipped=false',
    async (_name, C) => {
      const { recycleService } = makeSvc();
      recycleService.createVideoRecycleTasks.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      const instance = new (
        C as unknown as new (s: typeof recycleService) => {
          run: (ctx: Record<string, unknown>) => Promise<Record<string, unknown>>;
        }
      )(recycleService);

      const res = await instance.run({ publishTaskIds: [11, 12] });
      expect(recycleService.createVideoRecycleTasks).toHaveBeenCalledWith(
        [11, 12],
        expect.any(String),
      );
      expect(recycleService.collectAndScore).toHaveBeenCalledTimes(2);
      expect(res).toMatchObject({
        recycleTaskIds: [1, 2],
        ratedTopics: 2,
        feedbacks: 2,
        skipped: false,
      });
    },
  );

  it.each(STRATEGIES.map((C) => [C.name, C]))(
    '%s 无发布任务：空回收且 skipped=true',
    async (_name, C) => {
      const { recycleService } = makeSvc();
      recycleService.createVideoRecycleTasks.mockResolvedValue([]);
      const instance = new (
        C as unknown as new (s: typeof recycleService) => {
          run: (ctx: Record<string, unknown>) => Promise<Record<string, unknown>>;
        }
      )(recycleService);

      const res = await instance.run({});
      expect(recycleService.createVideoRecycleTasks).toHaveBeenCalledWith([], expect.any(String));
      expect(recycleService.collectAndScore).not.toHaveBeenCalled();
      expect(res).toMatchObject({
        recycleTaskIds: [],
        ratedTopics: 0,
        feedbacks: 0,
        skipped: true,
      });
    },
  );
});
