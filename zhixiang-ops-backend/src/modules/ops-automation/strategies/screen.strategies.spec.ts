import {
  ScreenHeatStrategy,
  ScreenEmotionStrategy,
  ScreenConversionStrategy,
  ScreenNoveltyStrategy,
  ScreenCompositeStrategy,
} from './screen.strategies';

/**
 * 筛选阶段 5 种策略：统一走 TopicService.generateTopics。
 * 覆盖：各策略调用 generateTopics 并按 topics 汇总。
 */

const STRATEGIES = [
  ScreenHeatStrategy,
  ScreenEmotionStrategy,
  ScreenConversionStrategy,
  ScreenNoveltyStrategy,
  ScreenCompositeStrategy,
];

type StrategyCtor = new (s: { generateTopics: jest.Mock }) => {
  run: (
    ctx: Record<string, unknown>,
  ) => Promise<{ topicIds: number[]; chosen: number; strategy: string }>;
};

describe('screen.strategies', () => {
  it.each(STRATEGIES.map((C) => [C.name, C]))(
    '%s 调用 generateTopics 汇总选题',
    async (_name, C) => {
      const topicService = {
        generateTopics: jest.fn().mockResolvedValue({ topics: [{ id: 1 }, { id: 2 }] }),
      };
      const instance = new (C as unknown as StrategyCtor)(topicService);
      const res = await instance.run({});
      expect(topicService.generateTopics).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 5 }),
      );
      expect(res).toMatchObject({ topicIds: [1, 2], chosen: 2 });
    },
  );

  it.each(STRATEGIES.map((C) => [C.name, C]))('%s 无选题返回空列表', async (_name, C) => {
    const topicService = { generateTopics: jest.fn().mockResolvedValue({ topics: [] }) };
    const instance = new (C as unknown as StrategyCtor)(topicService);
    const res = await instance.run({});
    expect(res).toMatchObject({ topicIds: [], chosen: 0 });
  });
});
