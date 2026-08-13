/** X 内容出海 类型与错误码（规划 §4-X / 阶段3 增强）。 */
import type { OverseasVideoEntity, OverseasVideoStatus } from './overseas-video.entity';
import type { OverseasPlatformEntity } from './overseas-platform.entity';
import type { TranslationTaskEntity, TranslationTaskStatus } from './translation-task.entity';

export type {
  OverseasVideoEntity,
  OverseasVideoStatus,
  OverseasPlatformEntity,
  TranslationTaskEntity,
  TranslationTaskStatus,
};

export const OVERSEAS_VIDEO_STATUSES: OverseasVideoStatus[] = [
  'draft',
  'translating',
  'published',
  'failed',
];
export const TRANSLATION_TASK_STATUSES: TranslationTaskStatus[] = [
  'queued',
  'translating',
  'done',
  'failed',
];

/** 常见目标语言白名单（译制用） */
export const SUPPORTED_LANGS = ['en', 'ja', 'ko', 'es', 'fr', 'pt', 'id', 'th', 'vi'];

export class XError extends Error {}
