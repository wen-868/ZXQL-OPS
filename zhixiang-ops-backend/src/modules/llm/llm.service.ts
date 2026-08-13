import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { AppError } from '../../shared/app-error';
import { encryptSecret, decryptSecret } from '../../shared/crypto';
import { buildPage, pageOffset } from '../../shared/pagination';
import { LlmProviderEntity, type LlmProviderType } from './llm-provider.entity';
import { CreateLlmProviderDto, LlmProviderQueryDto, UpdateLlmProviderDto } from './llm.dto';
import { LlmRoutingProvider } from '../../skill/providers/configured.provider';

/** 对外展示对象：apiKey 一律掩码，不暴露明文 */
export interface LlmProviderView {
  id: number;
  name: string;
  type: LlmProviderType;
  baseUrl: string | null;
  defaultModel: string | null;
  enabled: boolean;
  remark: string | null;
  /** '******' 表示已配置，'' 表示未配置 */
  apiKeyMasked: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class LlmProviderService {
  constructor(
    @InjectRepository(LlmProviderEntity)
    private readonly repo: Repository<LlmProviderEntity>,
  ) {}

  private toView(e: LlmProviderEntity): LlmProviderView {
    return {
      id: Number(e.id),
      name: e.name,
      type: e.type,
      baseUrl: e.baseUrl ?? null,
      defaultModel: e.defaultModel ?? null,
      enabled: !!e.enabled,
      remark: e.remark ?? null,
      apiKeyMasked: e.apiKeyEnc ? '******' : '',
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    };
  }

  private async findOne(id: number, tenantId: string): Promise<LlmProviderEntity> {
    const e = await this.repo.findOne({ where: { id, tenantId } });
    if (!e) throw new AppError('LLM_PROVIDER_NOT_FOUND');
    return e;
  }

  async create(dto: CreateLlmProviderDto, tenantId: string): Promise<LlmProviderView> {
    const dup = await this.repo.findOne({ where: { tenantId, name: dto.name } });
    if (dup) throw new AppError('LLM_PROVIDER_NAME_DUP');

    const e = new LlmProviderEntity();
    e.tenantId = tenantId;
    e.name = dto.name;
    e.type = dto.type;
    e.baseUrl = dto.baseUrl ?? null;
    e.apiKeyEnc = dto.apiKey ? encryptSecret(dto.apiKey) : null;
    e.defaultModel = dto.defaultModel ?? null;
    e.enabled = dto.enabled === false ? 0 : 1;
    e.remark = dto.remark ?? null;

    const saved = await this.repo.save(e);
    return this.toView(saved);
  }

  async update(id: number, dto: UpdateLlmProviderDto, tenantId: string): Promise<LlmProviderView> {
    const e = await this.findOne(id, tenantId);

    if (dto.name && dto.name !== e.name) {
      const dup = await this.repo.findOne({ where: { tenantId, name: dto.name } });
      if (dup && Number(dup.id) !== id) throw new AppError('LLM_PROVIDER_NAME_DUP');
      e.name = dto.name;
    }
    if (dto.type) e.type = dto.type;
    if (dto.baseUrl !== undefined) e.baseUrl = dto.baseUrl || null;
    if (dto.apiKey !== undefined && dto.apiKey !== '') e.apiKeyEnc = encryptSecret(dto.apiKey);
    if (dto.defaultModel !== undefined) e.defaultModel = dto.defaultModel || null;
    if (dto.enabled !== undefined) e.enabled = dto.enabled ? 1 : 0;
    if (dto.remark !== undefined) e.remark = dto.remark || null;

    const saved = await this.repo.save(e);
    return this.toView(saved);
  }

  async remove(id: number, tenantId: string): Promise<{ id: number }> {
    const e = await this.findOne(id, tenantId);
    await this.repo.softRemove(e);
    return { id };
  }

  async detail(id: number, tenantId: string): Promise<LlmProviderView> {
    return this.toView(await this.findOne(id, tenantId));
  }

  async list(q: LlmProviderQueryDto, tenantId: string) {
    const { skip, take } = pageOffset(q.page, q.pageSize);
    const where: Record<string, unknown> = { tenantId };
    if (q.type) where.type = q.type;
    if (q.enabled !== undefined) where.enabled = q.enabled;
    if (q.keyword) where.name = Like(`%${q.keyword}%`);

    const [rows, total] = await this.repo.findAndCount({
      where,
      skip,
      take,
      order: { id: 'DESC' },
    });
    return buildPage(
      rows.map((r) => this.toView(r)),
      total,
      q.page,
      q.pageSize,
    );
  }

  /** 连接测试：按类型探测端点；本机未装 Ollama 时 fetch 失败属预期 */
  async testConnection(id: number, tenantId: string): Promise<{ ok: boolean; message: string }> {
    const p = await this.findOne(id, tenantId);
    if (!p.baseUrl) throw new AppError('LLM_PROVIDER_TEST_FAILED', '缺少 baseUrl');

    const base = p.baseUrl.replace(/\/+$/, '');
    const apiKey = p.apiKeyEnc ? decryptSecret(p.apiKeyEnc) : undefined;

    let url: string;
    const headers: Record<string, string> = {};
    if (p.type === 'ollama') {
      url = `${base}/api/tags`;
    } else {
      url = `${base}/models`;
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(url, { signal: ctrl.signal, headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { ok: true, message: '连接成功' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new AppError('LLM_PROVIDER_TEST_FAILED', msg);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * 路由用提供方清单（供 SkillGateway 调用）。
   * 仅返回「启用」且具备 baseUrl+defaultModel 的提供方；按第三方优先排序（openai/azure/custom > ollama），
   * decryptSecret 还原 apiKey。缺失模型或端点的记录会被过滤，避免注定失败的调用。
   */
  async listRoutingProviders(tenantId: string): Promise<LlmRoutingProvider[]> {
    const rows = await this.repo.find({
      where: { tenantId, enabled: 1 },
      order: { id: 'ASC' },
    });
    const priority: Record<string, number> = { openai: 0, azure: 1, custom: 2, ollama: 3 };
    return rows
      .filter((r) => r.baseUrl && r.defaultModel)
      .map((r) => ({
        type: r.type,
        baseUrl: r.baseUrl ?? '',
        apiKey: r.apiKeyEnc ? decryptSecret(r.apiKeyEnc) : undefined,
        model: r.defaultModel as string,
      }))
      .sort((a, b) => (priority[a.type] ?? 9) - (priority[b.type] ?? 9));
  }
}
