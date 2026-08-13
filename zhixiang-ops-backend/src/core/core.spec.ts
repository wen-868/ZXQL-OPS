import {
  generateAttributionId,
  parseAttributionId,
  isAttributionType,
  AttributionType,
} from './attribution-id';
import {
  HUMANITIES,
  EMOTIONS,
  HUMANITY_EMOTION_MAP,
  isHumanity,
  isEmotion,
} from './humanity-emotion';

describe('attribution_id 全局归因标识', () => {
  it('generateAttributionId 格式为 attr_<tenant>_<type>_<32hex>', () => {
    const id = generateAttributionId('t1', 'content', 'seed');
    expect(id).toMatch(/^attr_t1_content_[0-9a-f]{32}$/);
  });

  it('同输入确定性输出，不同 seed 输出不同', () => {
    const a = generateAttributionId('t1', 'content', 'seed');
    const b = generateAttributionId('t1', 'content', 'seed');
    const c = generateAttributionId('t1', 'content', 'other');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('三种 type 均合法', () => {
    for (const t of ['content', 'live', 'ad'] as AttributionType[]) {
      expect(generateAttributionId('t', t, 's')).toMatch(new RegExp(`^attr_t_${t}_[0-9a-f]{32}$`));
    }
  });

  it('parseAttributionId 正确解析', () => {
    const id = generateAttributionId('tn', 'live', 'xyz');
    const parsed = parseAttributionId(id);
    expect(parsed).not.toBeNull();
    expect(parsed!.tenantId).toBe('tn');
    expect(parsed!.type).toBe('live');
    expect(parsed!.hash).toHaveLength(32);
  });

  it('parseAttributionId 非法串返回 null', () => {
    expect(parseAttributionId('not-an-id')).toBeNull();
    expect(parseAttributionId('attr_tn_bad_' + 'a'.repeat(32))).toBeNull();
    expect(parseAttributionId('attr_tn_content_' + 'z'.repeat(31))).toBeNull();
  });

  it('isAttributionType 校验', () => {
    expect(isAttributionType('content')).toBe(true);
    expect(isAttributionType('ad')).toBe(true);
    expect(isAttributionType('unknown')).toBe(false);
    expect(isAttributionType(123)).toBe(false);
  });
});

describe('7 人性 × 6 情绪 字典', () => {
  it('字典规模与类型正确', () => {
    expect(HUMANITIES).toHaveLength(7);
    expect(EMOTIONS).toHaveLength(6);
  });

  it('isHumanity / isEmotion 校验', () => {
    expect(isHumanity('贪')).toBe(true);
    expect(isHumanity('愤怒不公')).toBe(true);
    expect(isHumanity('不存在')).toBe(false);
    expect(isEmotion('爽感')).toBe(true);
    expect(isEmotion('焦虑')).toBe(true);
    expect(isEmotion('bad')).toBe(false);
    expect(isHumanity(5)).toBe(false);
  });

  it('映射表覆盖全部人性', () => {
    for (const h of HUMANITIES) {
      expect(HUMANITY_EMOTION_MAP[h]).toBeDefined();
      for (const e of HUMANITY_EMOTION_MAP[h]) {
        expect(EMOTIONS).toContain(e);
      }
    }
  });
});
