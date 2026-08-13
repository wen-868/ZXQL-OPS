/**
 * 7 人性 × 6 情绪 字典（规划核心资产）。
 * 选题 / 脚本 / 卖点 / 话术 / 直播须保持同一套口径。
 */

export const HUMANITIES = ['贪', '懒', '怕', '虚荣', '窥探', '孤独爱', '愤怒不公'] as const;
export type Humanity = (typeof HUMANITIES)[number];

export const EMOTIONS = ['愤怒', '共鸣', '好奇', '感动', '焦虑', '爽感'] as const;
export type Emotion = (typeof EMOTIONS)[number];

/** 人性 → 常用情绪映射（参考，非穷举） */
export const HUMANITY_EMOTION_MAP: Record<Humanity, Emotion[]> = {
  贪: ['好奇', '爽感'],
  懒: ['爽感', '好奇'],
  怕: ['焦虑', '共鸣'],
  虚荣: ['爽感', '感动'],
  窥探: ['好奇', '共鸣'],
  孤独爱: ['共鸣', '感动'],
  愤怒不公: ['愤怒', '爽感'],
};

export function isHumanity(v: unknown): v is Humanity {
  return typeof v === 'string' && (HUMANITIES as readonly string[]).includes(v);
}

export function isEmotion(v: unknown): v is Emotion {
  return typeof v === 'string' && (EMOTIONS as readonly string[]).includes(v);
}
