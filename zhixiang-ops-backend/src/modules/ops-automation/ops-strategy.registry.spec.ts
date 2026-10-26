import { Logger } from '@nestjs/common';
import { OpsStrategyRegistry } from './ops-strategy.registry';
import { OpsStage } from './ops-automation.types';

/**
 * OpsStrategyRegistry 注册表单测。
 * 覆盖：重复注册告警、批量注册、get/listByStage/listMetas/metasByStage、
 * resolve（preferred 命中/阶段不匹配回退/无策略抛错）、countByStage。
 */

function strategy(key: string, stage: OpsStage) {
  return {
    meta: {
      key,
      stage,
      name: key,
      tech: 't',
      impl: 'rule' as const,
      scenarios: ['hotspot'],
      enabledByDefault: true,
      desc: 'd',
    },
    run: jest.fn().mockResolvedValue({ strategy: key }),
  };
}

describe('OpsStrategyRegistry', () => {
  const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  afterEach(() => warnSpy.mockClear());

  it('register + get：按 key 取回策略', () => {
    const reg = new OpsStrategyRegistry();
    const s = strategy('retrieve_a', 'retrieve');
    reg.register(s);
    expect(reg.get('retrieve_a')).toBe(s);
    expect(reg.get('nope')).toBeUndefined();
  });

  it('重复 key 注册：告警并覆盖', () => {
    const reg = new OpsStrategyRegistry();
    const a = strategy('k', 'retrieve');
    const b = strategy('k', 'screen');
    reg.register(a);
    reg.register(b);
    expect(warnSpy).toHaveBeenCalledWith('策略重复注册，覆盖：k');
    expect(reg.get('k')).toBe(b);
  });

  it('registerAll 批量注册', () => {
    const reg = new OpsStrategyRegistry();
    reg.registerAll([strategy('r1', 'retrieve'), strategy('r2', 'retrieve')]);
    expect(reg.countByStage('retrieve')).toBe(2);
  });

  it('listByStage / listMetas / metasByStage', () => {
    const reg = new OpsStrategyRegistry();
    reg.register(strategy('v1', 'verify'));
    reg.register(strategy('v2', 'verify'));
    expect(reg.listByStage('verify').map((s) => s.meta.key)).toEqual(['v1', 'v2']);
    expect(reg.listMetas()).toHaveLength(2);
    expect(reg.metasByStage('verify')).toHaveLength(2);
    expect(reg.listByStage('screen')).toEqual([]);
  });

  it('resolve：preferred 命中同阶段返回之', () => {
    const reg = new OpsStrategyRegistry();
    const a = strategy('a', 'retrieve');
    const b = strategy('b', 'retrieve');
    reg.register(a);
    reg.register(b);
    expect(reg.resolve('retrieve', 'b')).toBe(b);
  });

  it('resolve：preferred 阶段不匹配回退阶段首个', () => {
    const reg = new OpsStrategyRegistry();
    const a = strategy('a', 'retrieve');
    const b = strategy('b', 'screen');
    reg.register(a);
    reg.register(b);
    expect(reg.resolve('retrieve', 'b')).toBe(a);
  });

  it('resolve：无 preferred 取阶段首个；阶段无策略抛错', () => {
    const reg = new OpsStrategyRegistry();
    const a = strategy('a', 'retrieve');
    reg.register(a);
    expect(reg.resolve('retrieve')).toBe(a);
    expect(() => reg.resolve('deliver')).toThrowError('阶段 deliver 无可注册策略');
  });
});
