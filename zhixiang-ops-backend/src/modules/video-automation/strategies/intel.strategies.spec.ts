import {
  IntelHotDouyinStrategy,
  IntelHotBilibiliStrategy,
  IntelCommentKuaishouStrategy,
  IntelKeywordXhsStrategy,
  IntelMonitorCompetitorStrategy,
} from './intel.strategies';

/**
 * 情报阶段 5 种策略：统一走 IntelService.createCollectTask。
 * 覆盖：各策略创建采集任务并回传 collectTaskIds。
 */

const STRATEGIES = [
  IntelHotDouyinStrategy,
  IntelHotBilibiliStrategy,
  IntelCommentKuaishouStrategy,
  IntelKeywordXhsStrategy,
  IntelMonitorCompetitorStrategy,
];

type StrategyCtor = new (s: { createCollectTask: jest.Mock }) => {
  run: (ctx: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

describe('intel.strategies', () => {
  it.each(STRATEGIES.map((C) => [C.name, C]))('%s 创建采集任务并回传', async (_name, C) => {
    const intel = { createCollectTask: jest.fn().mockResolvedValue({ taskId: 5 }) };
    const instance = new (C as unknown as StrategyCtor)(intel);
    const res = await instance.run({});
    expect(intel.createCollectTask).toHaveBeenCalledWith(
      expect.objectContaining({ sourceLevel: 'L1' }),
    );
    expect(res).toMatchObject({ collectTaskIds: [5] });
  });
});
