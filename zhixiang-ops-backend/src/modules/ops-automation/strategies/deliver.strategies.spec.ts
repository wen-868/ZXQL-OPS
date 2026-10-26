import {
  DeliverDouyinStrategy,
  DeliverKuaishouStrategy,
  DeliverXiaohongshuStrategy,
  DeliverBilibiliStrategy,
  DeliverWechatStrategy,
} from './deliver.strategies';

/**
 * 投流阶段 5 种策略：统一走 deliverTo（resolveDefaultAccount + 自动免审 + publish）。
 * 覆盖：无脚本 / 无账号跳过 / autoApprove 抛错跳过 / 全量发布 四条路径。
 */

const STRATEGIES = [
  DeliverDouyinStrategy,
  DeliverKuaishouStrategy,
  DeliverXiaohongshuStrategy,
  DeliverBilibiliStrategy,
  DeliverWechatStrategy,
];

type StrategyCtor = new (
  publish: { resolveDefaultAccount: jest.Mock; publish: jest.Mock },
  script: { autoApprove: jest.Mock },
) => { run: (ctx: Record<string, unknown>) => Promise<Record<string, unknown>> };

const makeSvc = () => ({
  publishService: { resolveDefaultAccount: jest.fn(), publish: jest.fn() },
  scriptService: { autoApprove: jest.fn() },
});

describe('deliver.strategies', () => {
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  afterEach(() => errorSpy.mockClear());

  it.each(STRATEGIES.map((C) => [C.name, C]))(
    '%s 全量发布：解析账号+自动免审+建任务',
    async (_name, C) => {
      const { publishService, scriptService } = makeSvc();
      publishService.resolveDefaultAccount.mockResolvedValue(100);
      publishService.publish.mockResolvedValue({ taskIds: [5, 6] });
      const instance = new (C as unknown as StrategyCtor)(publishService, scriptService);
      const res = await instance.run({ scriptIds: [1] });
      expect(publishService.resolveDefaultAccount).toHaveBeenCalled();
      expect(scriptService.autoApprove).toHaveBeenCalledWith(1);
      expect(publishService.publish).toHaveBeenCalledWith({
        scriptId: 1,
        accountIds: [100],
        platform: expect.any(String),
      });
      expect(res).toMatchObject({ publishTaskIds: [5, 6], skipped: false });
    },
  );

  it('无脚本：skipped=true 且不解析账号发布', async () => {
    const { publishService, scriptService } = makeSvc();
    const instance = new DeliverDouyinStrategy(publishService as never, scriptService as never);
    const res = await instance.run({ tenantId: 't1' });
    expect(publishService.resolveDefaultAccount).toHaveBeenCalled();
    expect(publishService.publish).not.toHaveBeenCalled();
    expect(res).toMatchObject({ publishTaskIds: [], skipped: true });
  });

  it('无默认账号：逐脚本跳过并标记 skipped', async () => {
    const { publishService, scriptService } = makeSvc();
    publishService.resolveDefaultAccount.mockResolvedValue(null);
    const instance = new DeliverKuaishouStrategy(publishService as never, scriptService as never);
    const res = await instance.run({ tenantId: 't1', scriptIds: [1, 2] });
    expect(publishService.publish).not.toHaveBeenCalled();
    expect(res).toMatchObject({ publishTaskIds: [], skipped: true });
  });

  it('autoApprove 抛错：记录错误跳过该脚本，其余继续发布', async () => {
    const { publishService, scriptService } = makeSvc();
    publishService.resolveDefaultAccount.mockResolvedValue(100);
    scriptService.autoApprove
      .mockRejectedValueOnce(new Error('高危违禁词'))
      .mockResolvedValueOnce(undefined);
    publishService.publish.mockResolvedValue({ taskIds: [9] });
    const instance = new DeliverXiaohongshuStrategy(
      publishService as never,
      scriptService as never,
    );
    const res = await instance.run({ tenantId: 't1', scriptIds: [1, 2] });
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[deliver:xiaohongshu] autoApprove script#1 失败'),
    );
    expect(publishService.publish).toHaveBeenCalledTimes(1);
    expect(res).toMatchObject({ publishTaskIds: [9], skipped: true });
  });
});
