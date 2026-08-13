import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { AppError } from '../../shared/app-error';
import { TenantContext } from '../../tenant/tenant-context';
import { SkillGateway } from '../../skill/skill.gateway';
import { FileStorageService } from '../../shared/file-storage.service';
import { MaterialEntity, MaterialSource } from './material.entity';
import { ListMaterialFilter } from './g.types';
import { GenerateMaterialDto, UploadMaterialDto } from './dto';

/**
 * 素材中心服务（规划 §4-G / 开发顺序 G 素材中心 / 阶段3 增强）。
 * AI 画面/视频生成经 Skill Gateway（源透明，当前默认 local text-generate 占位，
 * 真实 Media Provider 即梦/可灵集成留阶段3 增强）；实拍上传；标签检索；
 * 与 F 脚本(related_script_id)、H 成片联动。所有查询 where 携带 tenantId 强隔离。
 * 合规边界②：不采集隐私；AI 来源对 UX 透明。
 */
@Injectable()
export class MaterialService {
  constructor(
    @InjectRepository(MaterialEntity)
    private readonly materialRepo: Repository<MaterialEntity>,
    private readonly skillGateway: SkillGateway,
    private readonly fileStorage: FileStorageService,
  ) {}

  /** AI 画面/视频生成（经 Skill Gateway，源透明） */
  async generateMaterial(dto: GenerateMaterialDto): Promise<MaterialEntity> {
    const tenantId = TenantContext.requireTenantId();
    const provider = (dto.provider ?? 'local') as MaterialSource;
    const generatedText = await this.skillGateway.generateText(dto.prompt, tenantId, {
      type: dto.type,
    });
    const entity = this.materialRepo.create({
      tenantId,
      type: dto.type as MaterialEntity['type'],
      source: provider,
      status: 'generated',
      ratio: dto.ratio ?? null,
      relatedScriptId: dto.relatedScriptId ?? null,
      tags: [],
      meta: { prompt: dto.prompt, generatedText, provider },
    });
    return this.materialRepo.save(entity);
  }

  /** 实拍上传：支持文件流（multipart）或 URL 两种模式 */
  async uploadMaterial(
    dto: UploadMaterialDto,
    file?: Express.Multer.File,
  ): Promise<MaterialEntity> {
    const tenantId = TenantContext.requireTenantId();
    let url = dto.url;
    let filePath: string | undefined;

    // 文件流模式：落本地磁盘，生成 URL
    if (file && file.size > 0) {
      const result = await this.fileStorage.save(file, tenantId);
      url = result.url;
      filePath = result.path;
    }

    // URL 模式：直接记录外部链接
    if (!url) {
      throw new AppError('INVALID_PARAM');
    }

    const entity = this.materialRepo.create({
      tenantId,
      type: dto.type as MaterialEntity['type'],
      source: 'upload',
      url,
      ratio: dto.ratio ?? null,
      tags: dto.tags ?? [],
      relatedScriptId: dto.relatedScriptId ?? null,
      status: 'uploaded',
      meta: filePath ? { filePath, size: file!.size, mime: file!.mimetype } : null,
    });
    return this.materialRepo.save(entity);
  }

  /** 素材库（标签/类型检索） */
  async listMaterials(filter: ListMaterialFilter): Promise<MaterialEntity[]> {
    const tenantId = TenantContext.requireTenantId();
    const where: FindOptionsWhere<MaterialEntity> = { tenantId };
    if (filter.type) where.type = filter.type as MaterialEntity['type'];
    const all = await this.materialRepo.find({ where, order: { createdAt: 'DESC' } });
    if (filter.tag) return all.filter((m) => (m.tags ?? []).includes(filter.tag as string));
    return all;
  }

  /** 追加标签 */
  async addTag(id: number, tags: string[]): Promise<MaterialEntity> {
    const entity = await this.getMaterial(id);
    const set = new Set<string>([...(entity.tags ?? []), ...tags]);
    entity.tags = Array.from(set);
    return this.materialRepo.save(entity);
  }

  /** 详情 */
  async getMaterial(id: number): Promise<MaterialEntity> {
    const tenantId = TenantContext.requireTenantId();
    const entity = await this.materialRepo.findOne({ where: { id, tenantId } });
    if (!entity) throw new AppError('MATERIAL_NOT_FOUND');
    return entity;
  }
}
