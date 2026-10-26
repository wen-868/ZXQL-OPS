import {
  PublishDouyinStrategy,
  PublishKuaishouStrategy,
  PublishXhsStrategy,
  PublishBilibiliStrategy,
  PublishWechatStrategy,
} from './publish.strategies';
import { PublishService } from '../../publish/publish.service';
import { VideoChainContext, VideoStageResult, VideoStrategy } from '../video-automation.types';

/** 只消费 ctx 单参的 run 签名（VideoStrategy.run 带可选 config，与各策略单参实现不兼容） */
type SingleRunVideoStrategy = Pick<VideoStrategy, 'meta'> & {
  run(ctx: VideoChainContext): Promise<VideoStageResult>;
};

/**
 * 发布投流阶段（I）5 策略测试。
 * 每策略 mock PublishService.resolveDefaultAccount + publish，覆盖：
 * - 有默认账号 + 有脚本 → 逐个发布并汇总 taskIds
 * - 无默认账号 → 跳过所有脚本（不误发，返回空 taskIds）
 * - 无脚本 → 空 taskIds
 */

const cases: Array<{
  name: string;
  Strategy: new (p: PublishService) => SingleRunVideoStrategy;
  platform: string;
}> = [
  { name: 'PublishDouyinStrategy', Strategy: PublishDouyinStrategy, platform: 'douyin' },
  { name: 'PublishKuaishouStrategy', Strategy: PublishKuaishouStrategy, platform: 'kuaishou' },
  { name: 'PublishXhsStrategy', Strategy: PublishXhsStrategy, platform: 'xiaohongshu' },
  { name: 'PublishBilibiliStrategy', Strategy: PublishBilibiliStrategy, platform: 'bilibili' },
  { name: 'PublishWechatStrategy', Strategy: PublishWechatStrategy, platform: 'wechat-channels' },
];

describe('publish.strategies', () => {
  let publish: { resolveDefaultAccount: jest.Mock; publish: jest.Mock };
  let ctx: VideoChainContext;

  beforeEach(() => {
    publish = {
      resolveDefaultAccount: jest.fn(),
      publish: jest.fn(),
    };
    ctx = { tenantId: 'tn-1', chainRunId: 'r-1', scriptIds: [10, 20] };
  });

  for (const { name, Strategy, platform } of cases) {
    describe(name, () => {
      it('有默认账号时逐脚本发布并汇总 taskIds', async () => {
        publish.resolveDefaultAccount.mockResolvedValue('acc-1');
        publish.publish
          .mockResolvedValueOnce({ taskIds: [101, 102] })
          .mockResolvedValueOnce({ taskIds: [103] });
        const s = new Strategy(publish as unknown as PublishService);
        const res = await s.run(ctx);
        expect(publish.resolveDefaultAccount).toHaveBeenCalledWith(platform);
        expect(publish.publish).toHaveBeenCalledTimes(2);
        expect(publish.publish).toHaveBeenNthCalledWith(1, {
          scriptId: 10,
          accountIds: ['acc-1'],
          platform,
        });
        expect(publish.publish).toHaveBeenNthCalledWith(2, {
          scriptId: 20,
          accountIds: ['acc-1'],
          platform,
        });
        expect(res.publishTaskIds).toEqual([101, 102, 103]);
        expect(res.strategy).toBe(s.meta.key);
      });

      it('无默认账号时跳过发布并返回空 taskIds', async () => {
        publish.resolveDefaultAccount.mockResolvedValue(undefined);
        const s = new Strategy(publish as unknown as PublishService);
        const res = await s.run(ctx);
        expect(publish.publish).not.toHaveBeenCalled();
        expect(res.publishTaskIds).toEqual([]);
        expect(res.strategy).toBe(s.meta.key);
      });

      it('scriptIds 缺失时不调用 publish', async () => {
        publish.resolveDefaultAccount.mockResolvedValue('acc-1');
        const s = new Strategy(publish as unknown as PublishService);
        const res = await s.run({ tenantId: 'tn-1' });
        expect(publish.publish).not.toHaveBeenCalled();
        expect(res.publishTaskIds).toEqual([]);
      });
    });
  }
});
