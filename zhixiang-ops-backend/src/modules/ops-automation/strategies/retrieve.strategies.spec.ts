import {
  RetrieveDouyinHotStrategy,
  RetrieveBilibiliRankStrategy,
  RetrieveWeiboSearchStrategy,
  RetrieveXiaohongshuBrandStrategy,
  RetrieveKeywordMineStrategy,
} from './retrieve.strategies';

/**
 * 检索阶段 5 种策略：统一走 IntelService.createCollectTask。
 * 覆盖：config 缺省回退默认 target / 提供自定义值两条路径。
 */

const CASES: Array<[unknown, string, Record<string, string>]> = [
  [RetrieveDouyinHotStrategy, 'hot', { target: '定制热点' }],
  [RetrieveBilibiliRankStrategy, 'rank', { target: '定制榜单' }],
  [RetrieveWeiboSearchStrategy, '行业热点', { keyword: '定制关键词' }],
  [RetrieveXiaohongshuBrandStrategy, '品牌关键词', { brand: '定制品牌' }],
  [RetrieveKeywordMineStrategy, '核心品类词', { seed: '定制品类' }],
];

type StrategyCtor = new (s: { createCollectTask: jest.Mock }) => {
  run: (
    ctx: Record<string, unknown>,
    config?: Record<string, string>,
  ) => Promise<{
    collectTaskIds: number[];
    platform: string;
  }>;
};

describe('retrieve.strategies', () => {
  const makeIntel = () => ({ createCollectTask: jest.fn() });

  it.each(CASES)('%s config 缺省回退默认 target', async (C, fallback) => {
    const intel = makeIntel();
    intel.createCollectTask.mockResolvedValue({ taskId: 9 });
    const instance = new (C as StrategyCtor)(intel);
    const res = await instance.run({}, undefined);
    expect(intel.createCollectTask).toHaveBeenCalledWith(
      expect.objectContaining({ target: fallback, sourceLevel: 'L1' }),
    );
    expect(res.collectTaskIds).toEqual([9]);
  });

  it.each(CASES)('%s config 提供自定义值优先使用', async (C, _fallback, custom) => {
    const intel = makeIntel();
    intel.createCollectTask.mockResolvedValue({ taskId: 9 });
    const instance = new (C as StrategyCtor)(intel);
    const res = await instance.run({}, custom);
    const call = intel.createCollectTask.mock.calls[0][0] as { target: string };
    expect(call.target).toBe(Object.values(custom)[0]);
    expect(res.platform).toEqual(expect.any(String));
  });
});
