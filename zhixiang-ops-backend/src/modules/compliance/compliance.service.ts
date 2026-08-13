import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppError } from '../../shared/app-error';
import { TenantContext } from '../../tenant/tenant-context';
import { buildPage, pageOffset } from '../../shared/pagination';
import { ComplianceWordEntity } from './compliance-word.entity';
import { ComplianceLogEntity } from './compliance-log.entity';
import {
  BANNED_WORDS,
  ComplianceCheckResult,
  ComplianceHit,
  ComplianceLevel,
  ComplianceResult,
  maxLevel,
} from './compliance.types';
import { AddComplianceWordDto, UpdateComplianceWordDto } from './dto/add-word.dto';
import { QueryWordsDto } from './dto/query-words.dto';
import { QueryLogsDto } from './dto/query-logs.dto';

/**
 * 合规预检服务（规划 §4-P / 合规风控核心域）。
 * 统一违禁词预检入口 checkText，被 F 脚本 / H 成片 / I 发布 / K 直播 / AA 客服 依赖；
 * 提供租户级违禁词库 CRUD 与预检日志查询。词库为空时 lazy 种子（保留阶段1 BANNED_WORDS 语义）。
 */
@Injectable()
export class ComplianceService {
  constructor(
    @InjectRepository(ComplianceWordEntity)
    private readonly wordRepo: Repository<ComplianceWordEntity>,
    @InjectRepository(ComplianceLogEntity)
    private readonly logRepo: Repository<ComplianceLogEntity>,
  ) {}

  /** 统一预检入口：扫描本租户启用词库，命中返回 hits/level/score/result 并落日志 */
  async checkText(
    text: string,
    scene = 'script',
  ): Promise<ComplianceCheckResult & { checkedAt: string }> {
    const tenantId = TenantContext.requireTenantId();
    const words = await this.ensureWords(tenantId);

    const hits: ComplianceHit[] = [];
    for (const w of words) {
      let idx = text.indexOf(w.word);
      while (idx >= 0) {
        hits.push({ word: w.word, position: idx, level: w.level });
        idx = text.indexOf(w.word, idx + w.word.length);
      }
    }

    const level = hits.reduce<ComplianceLevel>((acc, h) => maxLevel(acc, h.level), 'none');
    const score = level === 'high' ? 100 : level === 'medium' ? 60 : level === 'low' ? 20 : 0;
    const result: ComplianceResult =
      level === 'high' ? 'block' : level === 'medium' ? 'warn' : 'pass';
    const checkedAt = new Date().toISOString();

    await this.logRepo.save(
      this.logRepo.create({
        tenantId,
        scene,
        sourceId: null,
        text: text.length > 500 ? text.slice(0, 500) : text,
        hits,
        level,
        score,
        result,
      }),
    );

    return { hits, level, score, result, checkedAt };
  }

  /** 词库为空时 lazy 种子（保留阶段1 内嵌 BANNED_WORDS 语义，避免首次预检全 miss） */
  private async ensureWords(tenantId: string): Promise<ComplianceWordEntity[]> {
    const existing = await this.wordRepo.find({ where: { tenantId } });
    if (existing.length) return existing;
    const seeds = BANNED_WORDS.map((b) =>
      this.wordRepo.create({
        tenantId,
        word: b.word,
        category: b.category ?? 'default',
        level: b.level,
        action: b.level === 'high' ? 'block' : 'warn',
        enabled: true,
      }),
    );
    await this.wordRepo.save(seeds);
    return seeds;
  }

  /** 新增违禁词（同租户同词去重） */
  async addWord(dto: AddComplianceWordDto): Promise<ComplianceWordEntity> {
    const tenantId = TenantContext.requireTenantId();
    const exists = await this.wordRepo.findOne({ where: { tenantId, word: dto.word } });
    if (exists) throw new AppError('COMPLIANCE_WORD_EXISTS');
    const entity = this.wordRepo.create({
      tenantId,
      word: dto.word,
      category: dto.category ?? 'default',
      level: dto.level ?? 'high',
      action: dto.action ?? 'block',
      enabled: dto.enabled ?? true,
    });
    return this.wordRepo.save(entity);
  }

  /** 违禁词库查询（分页 + level/category 过滤） */
  async listWords(query: QueryWordsDto): Promise<{
    list: ComplianceWordEntity[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const tenantId = TenantContext.requireTenantId();
    const { skip, take } = pageOffset(query.page, query.pageSize);
    const qb = this.wordRepo.createQueryBuilder('w').where('w.tenant_id = :tenantId', { tenantId });
    if (query.level) qb.andWhere('w.level = :level', { level: query.level });
    if (query.category) qb.andWhere('w.category = :category', { category: query.category });
    qb.orderBy('w.created_at', 'DESC').skip(skip).take(take);
    const [list, total] = await qb.getManyAndCount();
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, query.pageSize ?? 20));
    return buildPage(list, total, page, pageSize);
  }

  /** 更新违禁词（局部字段） */
  async updateWord(id: number, dto: UpdateComplianceWordDto): Promise<ComplianceWordEntity> {
    const tenantId = TenantContext.requireTenantId();
    const word = await this.wordRepo.findOne({ where: { id, tenantId } });
    if (!word) throw new AppError('COMPLIANCE_WORD_NOT_FOUND');
    if (dto.word !== undefined) word.word = dto.word;
    if (dto.category !== undefined) word.category = dto.category;
    if (dto.level !== undefined) word.level = dto.level;
    if (dto.action !== undefined) word.action = dto.action;
    if (dto.enabled !== undefined) word.enabled = dto.enabled;
    return this.wordRepo.save(word);
  }

  /** 删除违禁词（软删） */
  async removeWord(id: number): Promise<{ id: number }> {
    const tenantId = TenantContext.requireTenantId();
    const word = await this.wordRepo.findOne({ where: { id, tenantId } });
    if (!word) throw new AppError('COMPLIANCE_WORD_NOT_FOUND');
    await this.wordRepo.softDelete({ id, tenantId });
    return { id };
  }

  /** 预检日志查询（分页 + scene/result 过滤） */
  async getLogs(query: QueryLogsDto): Promise<{
    list: ComplianceLogEntity[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const tenantId = TenantContext.requireTenantId();
    const { skip, take } = pageOffset(query.page, query.pageSize);
    const qb = this.logRepo.createQueryBuilder('l').where('l.tenant_id = :tenantId', { tenantId });
    if (query.scene) qb.andWhere('l.scene = :scene', { scene: query.scene });
    if (query.result) qb.andWhere('l.result = :result', { result: query.result });
    qb.orderBy('l.created_at', 'DESC').skip(skip).take(take);
    const [list, total] = await qb.getManyAndCount();
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, query.pageSize ?? 20));
    return buildPage(list, total, page, pageSize);
  }
}
