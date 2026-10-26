import {
  ScriptHookStrategy,
  ScriptStoryStrategy,
  ScriptKnowledgeStrategy,
  ScriptSuspenseStrategy,
  ScriptComplianceStrategy,
} from './script.strategies';
import { ScriptService } from '../../script/script.service';
import { VideoChainContext, VideoStageResult, VideoStrategy } from '../video-automation.types';

/** 只消费 ctx 单参的 run 签名（VideoStrategy.run 带可选 config，与各策略单参实现不兼容） */
type SingleRunVideoStrategy = Pick<VideoStrategy, 'meta'> & {
  run(ctx: VideoChainContext): Promise<VideoStageResult>;
};

/**
 * 脚本阶段（F）5 策略测试。
 * mock ScriptService.generateScript，覆盖：
 * - topicIds 存在 → 逐选题生成脚本并汇总 scriptIds
 * - topicIds 缺失/为空 → 空 scriptIds（不误生成）
 */

const cases: Array<{
  name: string;
  Strategy: new (s: ScriptService) => SingleRunVideoStrategy;
  templateId?: string;
}> = [
  { name: 'ScriptHookStrategy', Strategy: ScriptHookStrategy },
  { name: 'ScriptStoryStrategy', Strategy: ScriptStoryStrategy, templateId: 'story_sell' },
  { name: 'ScriptKnowledgeStrategy', Strategy: ScriptKnowledgeStrategy, templateId: 'knowledge' },
  { name: 'ScriptSuspenseStrategy', Strategy: ScriptSuspenseStrategy, templateId: 'suspense' },
  {
    name: 'ScriptComplianceStrategy',
    Strategy: ScriptComplianceStrategy,
    templateId: 'compliance_safe',
  },
];

describe('script.strategies', () => {
  let script: { generateScript: jest.Mock };
  let ctx: VideoChainContext;

  beforeEach(() => {
    script = { generateScript: jest.fn() };
    ctx = { tenantId: 'tn-1', chainRunId: 'r-1', topicIds: [5, 6] };
  });

  for (const { name, Strategy, templateId } of cases) {
    describe(name, () => {
      it('对每个 topicId 生成脚本并汇总 scriptIds', async () => {
        script.generateScript.mockResolvedValue({ script: { id: 200 } });
        const s = new Strategy(script as unknown as ScriptService);
        const res = await s.run(ctx);
        expect(script.generateScript).toHaveBeenCalledTimes(2);
        if (templateId) {
          expect(script.generateScript).toHaveBeenNthCalledWith(1, {
            topicId: 5,
            templateId,
          });
          expect(script.generateScript).toHaveBeenNthCalledWith(2, {
            topicId: 6,
            templateId,
          });
        } else {
          expect(script.generateScript).toHaveBeenNthCalledWith(1, { topicId: 5 });
          expect(script.generateScript).toHaveBeenNthCalledWith(2, { topicId: 6 });
        }
        expect(res.scriptIds).toEqual([200, 200]);
        expect(res.strategy).toBe(s.meta.key);
      });

      it('topicIds 缺失时返回空 scriptIds', async () => {
        const s = new Strategy(script as unknown as ScriptService);
        const res = await s.run({ tenantId: 'tn-1' });
        expect(script.generateScript).not.toHaveBeenCalled();
        expect(res.scriptIds).toEqual([]);
      });

      it('topicIds 为空数组时同样返回空 scriptIds', async () => {
        const s = new Strategy(script as unknown as ScriptService);
        const res = await s.run({ tenantId: 'tn-1', topicIds: [] });
        expect(script.generateScript).not.toHaveBeenCalled();
        expect(res.scriptIds).toEqual([]);
      });
    });
  }
});
