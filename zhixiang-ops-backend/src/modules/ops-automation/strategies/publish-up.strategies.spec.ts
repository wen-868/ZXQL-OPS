import {
  PublishUpHookDrivenStrategy,
  PublishUpStorySellStrategy,
  PublishUpKnowledgeExplainStrategy,
  PublishUpSuspenseOpenStrategy,
  PublishUpComplianceSafeStrategy,
} from './publish-up.strategies';

/**
 * 上架(内容生产)阶段 5 种策略：统一走 ScriptService.generateScript。
 * 覆盖：topicIds 存在时逐条生成脚本、缺失时空跑两种路径。
 */

const STRATEGIES = [
  PublishUpHookDrivenStrategy,
  PublishUpStorySellStrategy,
  PublishUpKnowledgeExplainStrategy,
  PublishUpSuspenseOpenStrategy,
  PublishUpComplianceSafeStrategy,
];

type StrategyCtor = new (s: { generateScript: jest.Mock }) => {
  run: (ctx: Record<string, unknown>) => Promise<{ scriptIds: number[]; strategy: string }>;
};

describe('publish-up.strategies', () => {
  const makeSvc = () => ({
    scriptService: {
      generateScript: jest.fn(),
    },
  });

  it.each(STRATEGIES.map((C) => [C.name, C]))(
    '%s topicIds 存在：逐条生成脚本',
    async (_name, C) => {
      const { scriptService } = makeSvc();
      scriptService.generateScript.mockResolvedValue({ script: { id: 7 } });
      const instance = new (C as unknown as StrategyCtor)(scriptService);
      const res = await instance.run({ topicIds: [1, 2, 3] });
      expect(scriptService.generateScript).toHaveBeenCalledTimes(3);
      expect(res).toMatchObject({ scriptIds: [7, 7, 7], strategy: expect.any(String) });
    },
  );

  it.each(STRATEGIES.map((C) => [C.name, C]))(
    '%s topicIds 缺失：空跑 scriptIds=[]',
    async (_name, C) => {
      const { scriptService } = makeSvc();
      const instance = new (C as unknown as StrategyCtor)(scriptService);
      const res = await instance.run({});
      expect(scriptService.generateScript).not.toHaveBeenCalled();
      expect(res).toEqual({ scriptIds: [], strategy: expect.any(String) });
    },
  );
});
