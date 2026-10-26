import { VideoStrategyRegistry } from './video-strategy.registry';
import { VideoStage, VideoStrategy } from './video-automation.types';

/**
 * 视频策略注册表测试。
 * 覆盖：
 * - registerAll：多阶段/同阶段多次注册（get() 命中/未命中两条路径）
 * - list / metas / count：汇总与全量元信息
 * - metasByStage / countByStage：阶段存在与不存在
 * - resolve：默认取首策略、按 key 命中、按 key 未命中、空阶段返回 undefined
 */

function fakeStrategy(key: string, stage: VideoStage): VideoStrategy {
  return {
    meta: {
      key,
      stage,
      name: `fake-${key}`,
      tech: 'test',
      impl: 'rule' as const,
      scenarios: ['test'],
      enabledByDefault: false,
      desc: 'test',
    },
    run: jest.fn(),
  };
}

describe('VideoStrategyRegistry', () => {
  let registry: VideoStrategyRegistry;

  beforeEach(() => {
    registry = new VideoStrategyRegistry();
  });

  it('registerAll 跨阶段注册并按阶段聚合', () => {
    registry.registerAll([
      fakeStrategy('a', 'topic'),
      fakeStrategy('b', 'topic'),
      fakeStrategy('c', 'script'),
    ]);
    expect(registry.list()).toHaveLength(3);
    expect(registry.count()).toBe(3);
    expect(registry.countByStage('topic')).toBe(2);
    expect(registry.countByStage('script')).toBe(1);
    expect(registry.countByStage('compose')).toBe(0);
    expect(
      registry
        .metas()
        .map((m) => m.key)
        .sort(),
    ).toEqual(['a', 'b', 'c']);
  });

  it('同阶段多次 registerAll 累积到同一数组（不丢策略）', () => {
    registry.registerAll([fakeStrategy('a', 'topic')]);
    registry.registerAll([fakeStrategy('b', 'topic')]);
    expect(registry.countByStage('topic')).toBe(2);
    expect(registry.metasByStage('topic').map((m) => m.key)).toEqual(['a', 'b']);
  });

  it('metasByStage 对未注册阶段返回空数组', () => {
    expect(registry.metasByStage('recycle')).toEqual([]);
  });

  it('resolve 未指定 key 时返回该阶段第一个注册策略', () => {
    registry.registerAll([fakeStrategy('a', 'topic'), fakeStrategy('b', 'topic')]);
    expect(registry.resolve('topic')?.meta.key).toBe('a');
  });

  it('resolve 指定 key 时按 key 精确返回', () => {
    registry.registerAll([fakeStrategy('a', 'topic'), fakeStrategy('b', 'topic')]);
    expect(registry.resolve('topic', 'b')?.meta.key).toBe('b');
  });

  it('resolve 指定不存在的 key 返回 undefined', () => {
    registry.registerAll([fakeStrategy('a', 'topic')]);
    expect(registry.resolve('topic', 'nope')).toBeUndefined();
  });

  it('resolve 对未注册阶段返回 undefined（无论是否给 key）', () => {
    expect(registry.resolve('publish')).toBeUndefined();
    expect(registry.resolve('publish', 'whatever')).toBeUndefined();
  });
});
