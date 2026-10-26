import {
  MaterialImageStrategy,
  MaterialVideoStrategy,
  MaterialMusicStrategy,
  MaterialSubtitleStrategy,
  MaterialStickerStrategy,
} from './material.strategies';
import { MaterialService } from '../../g/g.service';
import { VideoChainContext, VideoStageResult, VideoStrategy } from '../video-automation.types';

/** 只消费 ctx 单参的 run 签名（VideoStrategy.run 带可选 config，与各策略单参实现不兼容） */
type SingleRunVideoStrategy = Pick<VideoStrategy, 'meta'> & {
  run(ctx: VideoChainContext): Promise<VideoStageResult>;
};

/**
 * 素材阶段（G）5 策略测试。
 * mock MaterialService.generateMaterial，覆盖：
 * - scriptIds 存在 → 逐脚本生成素材并汇总 materialIds
 * - scriptIds 缺失/为空 → 空 materialIds（不误生成）
 */

const cases: Array<{
  name: string;
  Strategy: new (m: MaterialService) => SingleRunVideoStrategy;
  type: string;
  promptFor: (scriptId: number) => string;
}> = [
  {
    name: 'MaterialImageStrategy',
    Strategy: MaterialImageStrategy,
    type: 'image',
    promptFor: (id) => `为脚本#${id}生成配图素材`,
  },
  {
    name: 'MaterialVideoStrategy',
    Strategy: MaterialVideoStrategy,
    type: 'video',
    promptFor: (id) => `为脚本#${id}生成视频片段素材`,
  },
  {
    name: 'MaterialMusicStrategy',
    Strategy: MaterialMusicStrategy,
    type: 'music',
    promptFor: (id) => `为脚本#${id}生成背景音乐素材`,
  },
  {
    name: 'MaterialSubtitleStrategy',
    Strategy: MaterialSubtitleStrategy,
    type: 'subtitle',
    promptFor: (id) => `为脚本#${id}生成字幕文案素材`,
  },
  {
    name: 'MaterialStickerStrategy',
    Strategy: MaterialStickerStrategy,
    type: 'sticker',
    promptFor: (id) => `为脚本#${id}生成贴纸花字素材`,
  },
];

describe('material.strategies', () => {
  let material: { generateMaterial: jest.Mock };
  let ctx: VideoChainContext;

  beforeEach(() => {
    material = { generateMaterial: jest.fn() };
    ctx = { tenantId: 'tn-1', chainRunId: 'r-1', scriptIds: [3, 4] };
  });

  for (const { name, Strategy, type, promptFor } of cases) {
    describe(name, () => {
      it('对每个 scriptId 生成素材并汇总 materialIds', async () => {
        material.generateMaterial.mockResolvedValue({ id: 900 });
        const s = new Strategy(material as unknown as MaterialService);
        const res = await s.run(ctx);
        expect(material.generateMaterial).toHaveBeenCalledTimes(2);
        expect(material.generateMaterial).toHaveBeenNthCalledWith(1, {
          type,
          prompt: promptFor(3),
          relatedScriptId: 3,
        });
        expect(material.generateMaterial).toHaveBeenNthCalledWith(2, {
          type,
          prompt: promptFor(4),
          relatedScriptId: 4,
        });
        expect(res.materialIds).toEqual([900, 900]);
        expect(res.strategy).toBe(s.meta.key);
      });

      it('scriptIds 缺失时返回空 materialIds', async () => {
        const s = new Strategy(material as unknown as MaterialService);
        const res = await s.run({ tenantId: 'tn-1' });
        expect(material.generateMaterial).not.toHaveBeenCalled();
        expect(res.materialIds).toEqual([]);
      });

      it('scriptIds 为空数组时同样返回空 materialIds', async () => {
        const s = new Strategy(material as unknown as MaterialService);
        const res = await s.run({ tenantId: 'tn-1', scriptIds: [] });
        expect(material.generateMaterial).not.toHaveBeenCalled();
        expect(res.materialIds).toEqual([]);
      });
    });
  }
});
