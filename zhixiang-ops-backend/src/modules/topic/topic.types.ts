/**
 * 选题引擎类型与状态机（规划 §4-E / 开发顺序设计.md 第4步）。
 * 状态流转：idea → todo → written → shot → published，外加终态 dead。
 */

export enum TopicStatus {
  Idea = 'idea',
  Todo = 'todo',
  Written = 'written',
  Shot = 'shot',
  Published = 'published',
  Dead = 'dead',
}

export const TOPIC_STATUSES: TopicStatus[] = [
  TopicStatus.Idea,
  TopicStatus.Todo,
  TopicStatus.Written,
  TopicStatus.Shot,
  TopicStatus.Published,
  TopicStatus.Dead,
];

/** 允许的单向状态流转（dead / published 为终态，不可再流转） */
export const TOPIC_TRANSITIONS: Record<TopicStatus, TopicStatus[]> = {
  [TopicStatus.Idea]: [TopicStatus.Todo, TopicStatus.Dead],
  [TopicStatus.Todo]: [TopicStatus.Written, TopicStatus.Dead],
  [TopicStatus.Written]: [TopicStatus.Shot, TopicStatus.Dead],
  [TopicStatus.Shot]: [TopicStatus.Published, TopicStatus.Dead],
  [TopicStatus.Published]: [],
  [TopicStatus.Dead]: [],
};

/** 校验状态流转是否合法（不允许原地流转） */
export function canTransition(from: TopicStatus, to: TopicStatus): boolean {
  if (from === to) return false;
  return TOPIC_TRANSITIONS[from]?.includes(to) ?? false;
}
