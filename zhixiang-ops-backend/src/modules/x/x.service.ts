import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppError } from '../../shared/app-error';
import { TenantContext } from '../../tenant/tenant-context';
import { AuditService } from '../n/audit.service';
import { SkillGateway } from '../../skill/skill.gateway';
import { VideoEntity } from '../h/video.entity';
import { OverseasPlatformEntity } from './overseas-platform.entity';
import { OverseasVideoEntity } from './overseas-video.entity';
import { TranslationTaskEntity } from './translation-task.entity';
import { OVERSEAS_VIDEO_STATUSES } from './x.types';
import {
  CreateOverseasPlatformDto,
  CreateOverseasVideoDto,
  CreateTranslationTaskDto,
  UpdateOverseasVideoDto,
} from './dto';

/**
 * 内容出海服务（规划 §4-X / 开发顺序 X 内容出海 / 阶段3 增强）。
 * 出海平台(overseas_platforms) + 出海视频(overseas_videos) + 译制任务(translation_tasks)。
 * 译制经 SkillGateway(text-generate) AI 翻译；源视频来自 H 成片。所有查询 where 携带 tenantId 强隔离。
 * 合规边界②：出海内容源自自有成片；译制仅做文案本地化，不采集第三方数据。
 */
@Injectable()
export class OverseasService {
  constructor(
    @InjectRepository(OverseasPlatformEntity)
    private readonly platformRepo: Repository<OverseasPlatformEntity>,
    @InjectRepository(OverseasVideoEntity)
    private readonly videoRepo: Repository<OverseasVideoEntity>,
    @InjectRepository(TranslationTaskEntity)
    private readonly taskRepo: Repository<TranslationTaskEntity>,
    @InjectRepository(VideoEntity)
    private readonly sourceRepo: Repository<VideoEntity>,
    private readonly skill: SkillGateway,
    private readonly audit: AuditService,
  ) {}

  // ---------- 出海平台 ----------

  async createPlatform(dto: CreateOverseasPlatformDto): Promise<OverseasPlatformEntity> {
    const tenantId = TenantContext.requireTenantId();
    const saved = await this.platformRepo.save(
      this.platformRepo.create({
        tenantId,
        code: dto.code,
        name: dto.name,
        region: dto.region,
        baseLang: dto.baseLang,
        meta: dto.meta,
      }),
    );
    await this.audit.record({
      action: 'create',
      module: 'overseas_platform',
      resource: `overseas_platform:${saved.id}`,
    });
    return saved;
  }

  async listPlatforms(): Promise<OverseasPlatformEntity[]> {
    const tenantId = TenantContext.requireTenantId();
    return this.platformRepo.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
  }

  async getPlatform(id: number): Promise<OverseasPlatformEntity> {
    const tenantId = TenantContext.requireTenantId();
    const e = await this.platformRepo.findOne({ where: { id, tenantId } });
    if (!e) throw new AppError('OVERSEAS_PLATFORM_NOT_FOUND');
    return e;
  }

  // ---------- 出海视频 ----------

  async createOverseasVideo(dto: CreateOverseasVideoDto): Promise<OverseasVideoEntity> {
    const tenantId = TenantContext.requireTenantId();
    await this.getPlatform(dto.platformId);
    const source = await this.sourceRepo.findOne({ where: { id: dto.sourceVideoId, tenantId } });
    if (!source) throw new AppError('VIDEO_NOT_FOUND');
    const saved = await this.videoRepo.save(
      this.videoRepo.create({
        tenantId,
        sourceVideoId: dto.sourceVideoId,
        platformId: dto.platformId,
        title: dto.title ?? source.title ?? `出海视频#${dto.sourceVideoId}`,
        targetLang: dto.targetLang,
        status: dto.status ?? 'draft',
        meta: dto.meta,
      }),
    );
    await this.audit.record({
      action: 'create',
      module: 'overseas_video',
      resource: `overseas_video:${saved.id}`,
    });
    return saved;
  }

  async listOverseasVideos(): Promise<OverseasVideoEntity[]> {
    const tenantId = TenantContext.requireTenantId();
    return this.videoRepo.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
  }

  async getOverseasVideo(id: number): Promise<OverseasVideoEntity> {
    const tenantId = TenantContext.requireTenantId();
    const e = await this.videoRepo.findOne({ where: { id, tenantId } });
    if (!e) throw new AppError('OVERSEAS_VIDEO_NOT_FOUND');
    return e;
  }

  async updateOverseasVideo(id: number, dto: UpdateOverseasVideoDto): Promise<OverseasVideoEntity> {
    const e = await this.getOverseasVideo(id);
    if (dto.title !== undefined) e.title = dto.title;
    if (dto.status !== undefined) e.status = dto.status;
    if (dto.url !== undefined) e.url = dto.url;
    if (dto.meta !== undefined) e.meta = dto.meta;
    const saved = await this.videoRepo.save(e);
    await this.audit.record({
      action: 'update',
      module: 'overseas_video',
      resource: `overseas_video:${saved.id}`,
    });
    return saved;
  }

  /** 发布出海视频（best-effort：登记外链；真实场景对接各平台 Open API） */
  async publishOverseasVideo(id: number, url?: string): Promise<OverseasVideoEntity> {
    const e = await this.getOverseasVideo(id);
    e.status = 'published';
    e.url = url ?? `https://cdn.zhixiang.ops/overseas/${e.id}.mp4`;
    const saved = await this.videoRepo.save(e);
    await this.audit.record({
      action: 'publish',
      module: 'overseas_video',
      resource: `overseas_video:${saved.id}`,
    });
    return saved;
  }

  // ---------- 译制任务 ----------

  async createTranslationTask(dto: CreateTranslationTaskDto): Promise<TranslationTaskEntity> {
    const tenantId = TenantContext.requireTenantId();
    const video = await this.getOverseasVideo(dto.videoId);
    const sourceText = dto.sourceText ?? video.title;
    const sourceLang = dto.sourceLang ?? 'zh';

    const prompt =
      `你是一名专业的短视频本地化译制专家。请将以下${sourceLang}语短视频文案翻译为${dto.targetLang}语言，` +
      `保留网感与口语化表达，不要增删核心信息：\n\n${sourceText}`;

    let translatedScript: string;
    try {
      translatedScript = await this.skill.generateText(prompt, tenantId);
    } catch (err) {
      const failed = await this.taskRepo.save(
        this.taskRepo.create({
          tenantId,
          videoId: video.id,
          sourceLang,
          targetLang: dto.targetLang,
          sourceText,
          status: 'failed',
          meta: { error: String(err) },
        }),
      );
      await this.audit.record({
        action: 'fail',
        module: 'translation_task',
        resource: `translation_task:${failed.id}`,
      });
      throw new AppError('SKILL_UNAVAILABLE');
    }

    const task = await this.taskRepo.save(
      this.taskRepo.create({
        tenantId,
        videoId: video.id,
        sourceLang,
        targetLang: dto.targetLang,
        sourceText,
        translatedScript,
        status: 'done',
      }),
    );
    // 译制完成 → 视频进入译制态（待人工发布）
    video.status = 'translating';
    video.meta = {
      ...(video.meta ?? {}),
      lastTranslated: { lang: dto.targetLang, taskId: task.id },
    };
    await this.videoRepo.save(video);
    await this.audit.record({
      action: 'done',
      module: 'translation_task',
      resource: `translation_task:${task.id}`,
    });
    return task;
  }

  async listTranslationTasks(): Promise<TranslationTaskEntity[]> {
    const tenantId = TenantContext.requireTenantId();
    return this.taskRepo.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
  }

  // ---------- 概览（看板用） ----------

  async summary(): Promise<{
    platformCount: number;
    videoCount: number;
    publishedCount: number;
    taskCount: number;
    byStatus: Record<string, number>;
  }> {
    const tenantId = TenantContext.requireTenantId();
    const [platforms, videos, tasks] = await Promise.all([
      this.platformRepo.find({ where: { tenantId } }),
      this.videoRepo.find({ where: { tenantId } }),
      this.taskRepo.find({ where: { tenantId } }),
    ]);
    const byStatus: Record<string, number> = {};
    for (const s of OVERSEAS_VIDEO_STATUSES) byStatus[s] = 0;
    for (const v of videos) byStatus[v.status] = (byStatus[v.status] ?? 0) + 1;
    return {
      platformCount: platforms.length,
      videoCount: videos.length,
      publishedCount: videos.filter((v) => v.status === 'published').length,
      taskCount: tasks.length,
      byStatus,
    };
  }
}
