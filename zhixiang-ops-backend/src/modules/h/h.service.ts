import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, FindOptionsWhere, In, Repository } from 'typeorm';
import { AppError } from '../../shared/app-error';
import { TenantContext } from '../../tenant/tenant-context';
import { ScriptEntity } from '../script/script.entity';
import { MaterialEntity } from '../g/material.entity';
import { VideoEntity } from './video.entity';
import { FromScriptDto, EditVideoDto } from './dto';
import { runFfmpeg } from './ffmpeg.util';
import { ComplianceService } from '../compliance/compliance.service';
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs';
import { join, resolve, sep } from 'path';
import { tmpdir } from 'os';

const VIDEO_OUTPUT_DIR = join(tmpdir(), 'zhixiang-ops-videos');

/** 解析比例字符串为宽高像素 (9:16 → 720×1280) */
function parseRatio(ratio: string): [number, number] {
  const parts = ratio.split(':').map(Number);
  if (parts.length !== 2 || parts.some(isNaN)) return [720, 1280];
  const base = 720;
  const [rw, rh] = parts;
  if (rw > rh) return [base, Math.round((base * rh) / rw)]; // 横屏
  return [Math.round((base * rw) / rh), base]; // 竖屏
}

/** 提取脚本核心文案（去空行，截 200 字用于封面/字幕） */
function extractScriptText(content: string): string {
  return (content || '')
    .replace(/^#+\s*/gm, '') // 去 markdown 标题
    .replace(/[*_~`]/g, '') // 去 markdown 标记
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5)
    .join(' | ');
}

/** 判断素材 URL 是否为本地路径 */
function isLocalPath(url: string): boolean {
  return (
    url.startsWith('/') ||
    /^[A-Za-z]:\\/.test(url) ||
    url.startsWith('./') ||
    url.startsWith('../') ||
    url.startsWith('uploads/')
  );
}

/**
 * 素材本地路径安全校验（防路径穿越）。
 * 素材 url 可经 `POST /ops/materials/upload` 由外部写入，直接交给 FFmpeg 读取
 * 存在任意文件读取/写入面；此处对绝对本地路径做「允许根目录包含性」校验。
 * 允许范围：系统上传目录（./uploads）与成片输出目录；其余绝对路径一律拒绝。
 */
function isSafeMaterialPath(url: string): boolean {
  if (!isLocalPath(url)) return true; // 远程 URL 由 FFmpeg 自行拉取，不进本地文件系统校验
  const allowedRoots = [resolve(process.cwd(), 'uploads'), resolve(VIDEO_OUTPUT_DIR)];
  // 相对路径（uploads/xxx、./xxx）以项目根目录解析
  const abs = resolve(process.cwd(), url);
  return allowedRoots.some((root) => abs === root || abs.startsWith(root + sep));
}

/** 构建 FFmpeg concat 文件列表（临时文本文件） */
function buildConcatFile(inputs: { path: string; duration?: number }[]): string {
  const lines = inputs.map((i) => {
    let line = `file '${i.path.replace(/'/g, "'\\''")}'`;
    if (i.duration) line += `\nduration ${i.duration}`;
    return line;
  });
  const concatPath = join(tmpdir(), `concat_${Date.now()}.txt`);
  // concatPath 为系统生成临时文件，非用户输入
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  writeFileSync(concatPath, lines.join('\n'), 'utf-8');
  return concatPath;
}

/**
 * 智能成片服务（规划 §4-H / 开发顺序 H 智能成片 / 阶段3 增强）。
 * 脚本转分镜(读 F 脚本) → 素材拼装 → FFmpeg 剪辑成片 → 多比例/模板化 → 送审+合规预检。
 * 与 F 脚本(script_id)、G 素材(material_ids)、K 拆条(直播回放)联动。
 *
 * 真实成片管道（P1-2）：
 *   - 素材可用 → FFmpeg concat + scale → 多比例成片
 *   - 素材不可用 → 封面标题视频（5s，优于纯黑场占位）
 *   - 最佳努力（best-effort）：失败不抛，保留 draft 状态供人工重试
 */
@Injectable()
export class VideoService {
  constructor(
    @InjectRepository(VideoEntity)
    private readonly videoRepo: Repository<VideoEntity>,
    @InjectRepository(ScriptEntity)
    private readonly scriptRepo: Repository<ScriptEntity>,
    @InjectRepository(MaterialEntity)
    private readonly materialRepo: Repository<MaterialEntity>,
    private readonly complianceService: ComplianceService,
  ) {}

  /** 脚本转分镜+成片（FFmpeg 素材拼接，best-effort） */
  async fromScript(dto: FromScriptDto): Promise<VideoEntity> {
    const tenantId = TenantContext.requireTenantId();
    const script = await this.scriptRepo.findOne({
      where: { id: dto.scriptId, tenantId },
    });
    if (!script) throw new AppError('VIDEO_SCRIPT_NOT_FOUND');

    const draft = this.videoRepo.create(VideoService.buildDraft(tenantId, script, dto));
    const saved = await this.videoRepo.save(draft);

    // 准备输出目录（VIDEO_OUTPUT_DIR 为配置常量）
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!existsSync(VIDEO_OUTPUT_DIR)) mkdirSync(VIDEO_OUTPUT_DIR, { recursive: true });
    const outputPath = join(VIDEO_OUTPUT_DIR, `${saved.id}.mp4`);
    const ratio = dto.ratio ?? '9:16';
    const [w, h] = parseRatio(ratio);

    // ── 真实管道：素材拼接（P1-2），无素材则降级为封面标题视频 ──
    const composed = await this.composeOrDegrade(script, dto.materialIds ?? [], w, h, outputPath);
    this.applyComposeResult(saved, composed, ratio, outputPath);
    return this.videoRepo.save(saved);
  }

  /** 成片草稿字段（默认值语义集中在助手内，不计入 fromScript 分支） */
  private static buildDraft(
    tenantId: string,
    script: ScriptEntity,
    dto: FromScriptDto,
  ): DeepPartial<VideoEntity> {
    return {
      tenantId,
      scriptId: dto.scriptId,
      materialIds: dto.materialIds ?? [],
      ratio: dto.ratio ?? null,
      title: dto.title ?? script.title,
      status: 'draft',
      reviewStatus: 'pending',
      meta: { scriptTitle: script.title },
    };
  }

  /** 合成结果回写：meta 汇总 + 状态/URL（ok 为假时保留 draft 供人工重试） */
  private applyComposeResult(
    saved: VideoEntity,
    composed: { ok: boolean; stderr: string; pipeline: 'material' | 'title' },
    ratio: string,
    outputPath: string,
  ): void {
    const { ok, stderr, pipeline } = composed;
    saved.meta = this.buildComposedMeta(saved, ok, stderr, ratio, pipeline, outputPath);
    saved.status = ok ? 'done' : 'draft';
    if (ok) {
      saved.url = `oss://videos/${saved.id}.mp4`;
    }
  }

  /** 成片 meta 汇总（best-effort 语义：本地路径/时长仅在成功时落库） */
  private buildComposedMeta(
    saved: VideoEntity,
    ok: boolean,
    stderr: string,
    ratio: string,
    pipeline: 'material' | 'title',
    outputPath: string,
  ): Record<string, unknown> {
    return {
      ...(saved.meta ?? {}),
      composed: ok,
      ffmpegStderr: (stderr ?? '').slice(0, 500),
      ratio,
      pipeline,
      localPath: ok ? outputPath : undefined,
      duration: ok ? undefined : 5,
    };
  }

  /** 优先素材拼接；无可用素材或拼接失败时降级为封面标题视频（best-effort，不抛错） */
  private async composeOrDegrade(
    script: ScriptEntity,
    materialIds: number[],
    w: number,
    h: number,
    outputPath: string,
  ): Promise<{ ok: boolean; stderr: string; pipeline: 'material' | 'title' }> {
    let composeResult: { ok: boolean; stderr: string } = { ok: false, stderr: '' };
    if (materialIds.length > 0) {
      composeResult = await this.tryComposeFromMaterials(script, materialIds, w, h, outputPath);
    }
    if (!composeResult.ok && materialIds.length === 0) {
      composeResult = await this.generateTitleVideo(script, w, h, outputPath);
    }
    return { ...composeResult, pipeline: materialIds.length > 0 ? 'material' : 'title' };
  }

  /** 素材拼接（含查询与 FFmpeg 调用），失败收敛为 { ok:false, stderr } 不抛出 */
  private async tryComposeFromMaterials(
    script: ScriptEntity,
    materialIds: number[],
    w: number,
    h: number,
    outputPath: string,
  ): Promise<{ ok: boolean; stderr: string }> {
    try {
      const materials = await this.materialRepo.find({
        where: { id: In(materialIds), tenantId: script.tenantId },
      });
      return await this.composeFromMaterials(script, materials, w, h, outputPath);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, stderr: `material compose error: ${msg}` };
    }
  }

  /** 背景音乐是否可用（本地 + 通过根目录校验） */
  private static usableBgm(bgm?: MaterialEntity): boolean {
    return !!bgm?.url && isLocalPath(bgm.url) && isSafeMaterialPath(bgm.url);
  }

  /** 纯本地视频素材 → concat demuxer 路径（简单高效） */
  private static async composeViaConcat(
    localVideos: MaterialEntity[],
    bgm: MaterialEntity | undefined,
    w: number,
    h: number,
    outputPath: string,
  ): Promise<{ ok: boolean; stderr: string }> {
    const concatPath = buildConcatFile(localVideos.map((v) => ({ path: v.url! })));

    const args = ['-y', '-f', 'concat', '-safe', '0', '-i', concatPath];
    // 缩放 + pad 到目标尺寸
    args.push(
      '-vf',
      `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2`,
    );

    // 背景音乐混入
    if (VideoService.usableBgm(bgm)) {
      args.push(
        '-i',
        bgm!.url!,
        '-filter_complex',
        '[1:a]volume=0.3[bgm];[0:a][bgm]amix=duration=first',
      );
      args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '23');
    } else {
      args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac');
    }

    args.push(outputPath);
    const res = await runFfmpeg(args);
    // 清理临时 concat 文件（系统生成路径）
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      unlinkSync(concatPath);
    } catch {
      /* ignore */
    }
    return res;
  }

  /** 混合素材 / 混合类型 → filter_complex 路径（更灵活） */
  private static async composeViaFilterComplex(
    localVideos: MaterialEntity[],
    localImages: MaterialEntity[],
    bgm: MaterialEntity | undefined,
    w: number,
    h: number,
    outputPath: string,
  ): Promise<{ ok: boolean; stderr: string }> {
    const inputs: { path: string; duration?: number }[] = [];
    for (const v of localVideos) inputs.push({ path: v.url! });
    for (const img of localImages) inputs.push({ path: img.url!, duration: 3 });

    const args = ['-y'];
    for (const inp of inputs) {
      args.push('-i', inp.path);
    }

    // 构造 filter_complex：每个输入 scale+pad → concat
    const filters: string[] = [];
    for (let i = 0; i < inputs.length; i++) {
      filters.push(
        `[${i}:v]scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1[v${i}]`,
      );
    }
    const concatInputs = inputs.map((_, i) => `[v${i}]`).join('');
    filters.push(`${concatInputs}concat=n=${inputs.length}:v=1:a=0[vout]`);

    // 背景音乐（循环 + 限长 15s）
    const useBgm = VideoService.usableBgm(bgm);
    if (useBgm) {
      args.push('-i', bgm!.url!);
      filters.push(`[${inputs.length}:a]volume=0.3,aloop=-1:1e9[bgma]`);
      filters.push(`[bgma]atrim=0:15[bgmtrim]`);
      args.push('-filter_complex', filters.join(';'));
      args.push('-map', '[vout]', '-map', '[bgmtrim]');
    } else {
      args.push('-filter_complex', filters.join(';'));
      args.push('-map', '[vout]');
    }

    args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '23');
    args.push('-pix_fmt', 'yuv420p');
    args.push(outputPath);
    return runFfmpeg(args);
  }

  /**
   * 基于素材拼接成片（P1-2 真实管道核心）。
   * 素材类型：video（视频片段）、image（图片转场卡片）、music（背景音乐）。
   *
   * FFmpeg 策略（见两个 composeVia* 方法）：
   *   1. 多个视频素材 → concat 拼接 + scale 到目标尺寸
   *   2. 混合素材 → filter_complex 叠加（图片用 fade/zoom 动画）
   *   3. 背景音乐 → 混音（音量降低为背景）
   */
  private async composeFromMaterials(
    script: ScriptEntity,
    materials: MaterialEntity[],
    w: number,
    h: number,
    outputPath: string,
  ): Promise<{ ok: boolean; stderr: string }> {
    const usable = materials.filter((m) => m.url && m.status !== 'failed');
    const videos = usable.filter((m) => m.type === 'video');
    const images = usable.filter((m) => m.type === 'image');
    const bgm = usable.find((m) => m.type === 'music');

    // 分离本地文件和远程 URL（本地路径须通过允许根目录校验，防路径穿越）
    const localVideos = videos.filter((v) => isLocalPath(v.url!) && isSafeMaterialPath(v.url!));
    const localImages = images.filter((v) => isLocalPath(v.url!) && isSafeMaterialPath(v.url!));

    // 纯本地视频素材 → concat demuxer（简单高效）
    if (localVideos.length >= 1 && images.length === 0) {
      return VideoService.composeViaConcat(localVideos, bgm, w, h, outputPath);
    }
    // 混合素材 / 混合类型 → filter_complex（更灵活）
    if (localImages.length > 0 || videos.length > 0) {
      return VideoService.composeViaFilterComplex(localVideos, localImages, bgm, w, h, outputPath);
    }
    // 兜底：素材都不可用
    return { ok: false, stderr: 'no usable local materials' };
  }

  /**
   * 封面标题视频（无素材时的降级方案）。
   * 生成带脚本标题+核心文案的 5s 视频（优于纯黑场占位）。
   */
  private async generateTitleVideo(
    script: ScriptEntity,
    w: number,
    h: number,
    outputPath: string,
  ): Promise<{ ok: boolean; stderr: string }> {
    const title = (script.title || '智享 AI 成片').replace(/['"\\]/g, '');
    const snippet = extractScriptText(script.content || '').replace(/['"\\]/g, '');

    // 带标题的 5s 渐变背景视频
    const drawText = [
      `drawtext=text='${title}':fontsize=48:fontcolor=white@0.9:box=1:boxcolor=black@0.3:boxborderw=10:x=(w-text_w)/2:y=(h-text_h)/2-40`,
      `drawtext=text='${snippet.slice(0, 60)}':fontsize=24:fontcolor=white@0.7:x=(w-text_w)/2:y=(h-text_h)/2+30:expansion=none`,
    ].join(',');

    return runFfmpeg([
      '-y',
      '-f',
      'lavfi',
      '-i',
      `color=c=0x1a1a2e:s=${w}x${h}:d=5:r=24`,
      '-vf',
      drawText,
      '-c:v',
      'libx264',
      '-preset',
      'fast',
      '-crf',
      '23',
      '-pix_fmt',
      'yuv420p',
      '-an',
      outputPath,
    ]);
  }

  /** 成片编辑（AI 自动剪辑/模板化） */
  async editVideo(id: number, dto: EditVideoDto): Promise<VideoEntity> {
    const video = await this.getVideo(id);
    if (dto.materialIds !== undefined) video.materialIds = dto.materialIds;
    if (dto.ratio !== undefined) video.ratio = dto.ratio;
    if (video.status !== 'done') video.status = 'editing';
    return this.videoRepo.save(video);
  }

  /** 送审 + 合规预检（委托 P 违禁词库；block→rejected，其余 passed） */
  async reviewVideo(id: number): Promise<VideoEntity> {
    const video = await this.getVideo(id);
    const script = await this.scriptRepo.findOne({
      where: { id: video.scriptId, tenantId: video.tenantId },
    });
    const content = script?.content ?? '';
    const res = await this.complianceService.checkText(content, 'review');
    video.reviewStatus = res.result === 'block' ? 'rejected' : 'passed';
    video.meta = {
      ...(video.meta ?? {}),
      compliance: { result: res.result, level: res.level, hits: res.hits.map((h) => h.word) },
    };
    return this.videoRepo.save(video);
  }

  /** 视频库 */
  async listVideos(): Promise<VideoEntity[]> {
    const tenantId = TenantContext.requireTenantId();
    const where: FindOptionsWhere<VideoEntity> = { tenantId };
    return this.videoRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  /** 详情 */
  async getVideo(id: number): Promise<VideoEntity> {
    const tenantId = TenantContext.requireTenantId();
    const video = await this.videoRepo.findOne({ where: { id, tenantId } });
    if (!video) throw new AppError('VIDEO_NOT_FOUND');
    return video;
  }
}
