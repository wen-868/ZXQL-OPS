import { MaterialService } from './g.service';
import { TenantContext } from '../../tenant/tenant-context';
import type { Repository } from 'typeorm';

function makeRepo() {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((d: any) => ({ ...d })),
    save: jest.fn(async (e: any) => e),
    softRemove: jest.fn(async (e: any) => e),
    count: jest.fn().mockResolvedValue(0),
  } as unknown as Repository<any>;
}

const TENANT = 't-g-1';

describe('MaterialService（G 素材中心 / 验收点 G-01~06）', () => {
  let service: MaterialService;
  let materialRepo: any;
  let skillGateway: any;
  let store: any[];
  let idSeq = 0;

  beforeEach(() => {
    idSeq = 0;
    store = [];
    materialRepo = makeRepo();
    materialRepo.find = jest.fn(async (opt: any) => {
      let list = store;
      const t = opt?.where?.type;
      if (t) list = list.filter((d) => d.type === t);
      return list;
    });
    materialRepo.findOne = jest.fn(
      async (opt: any) =>
        store.find((d) => d.id === opt.where.id && d.tenantId === opt.where.tenantId) ?? null,
    );
    materialRepo.create = jest.fn((d: any) => ({ ...d }));
    materialRepo.save = jest.fn(async (e: any) => {
      if (e.id === undefined) e.id = ++idSeq;
      const i = store.findIndex((d) => d.id === e.id);
      if (i >= 0) store[i] = e;
      else store.push(e);
      return e;
    });

    skillGateway = {
      // AI 画面生成经 Skill Gateway（当前 text-generate 占位，源透明）
      generateText: jest.fn(async (prompt: string) => `[gen] ${prompt}`),
    };

    const fileStorage = { save: jest.fn(), delete: jest.fn(), getFullPath: jest.fn() } as any;
    service = new MaterialService(materialRepo, skillGateway, fileStorage);
  });

  /** G-01 AI 画面生成（经 Skill Gateway，源透明）跑通 */
  it('generateMaterial 调用网关并落库 generated 状态 + meta 源透明', async () => {
    const r = await TenantContext.run({ tenantId: TENANT, traceId: 'x' }, () =>
      service.generateMaterial({ type: 'image', prompt: '一只猫', provider: 'jimeng' } as any),
    );
    expect(skillGateway.generateText).toHaveBeenCalledWith('一只猫', TENANT, { type: 'image' });
    expect(r.source).toBe('jimeng');
    expect(r.status).toBe('generated');
    expect(r.tenantId).toBe(TENANT);
    expect(r.meta).toMatchObject({
      prompt: '一只猫',
      provider: 'jimeng',
      generatedText: '[gen] 一只猫',
    });
  });

  /** G-02 实拍上传 */
  it('uploadMaterial 落库 upload 状态', async () => {
    const r = await TenantContext.run({ tenantId: TENANT, traceId: 'x' }, () =>
      service.uploadMaterial({
        type: 'video',
        url: 'minio://x.mp4',
        tags: ['live'],
        relatedScriptId: 7,
      } as any),
    );
    expect(r.source).toBe('upload');
    expect(r.status).toBe('uploaded');
    expect(r.url).toBe('minio://x.mp4');
    expect(r.tags).toEqual(['live']);
    expect(r.relatedScriptId).toBe(7);
  });

  /** G-03 素材库检索（全部 / 类型 / 标签） */
  it('listMaterials 支持类型与标签过滤', async () => {
    await TenantContext.run({ tenantId: TENANT, traceId: 'x' }, async () => {
      await service.generateMaterial({ type: 'image', prompt: 'a' });
      await service.uploadMaterial({ type: 'video', url: 'u', tags: ['hot'] });
    });
    const all = await TenantContext.run({ tenantId: TENANT, traceId: 'x' }, () =>
      service.listMaterials({}),
    );
    expect(all.length).toBe(2);
    const images = await TenantContext.run({ tenantId: TENANT, traceId: 'x' }, () =>
      service.listMaterials({ type: 'image' }),
    );
    expect(images.length).toBe(1);
    const hot = await TenantContext.run({ tenantId: TENANT, traceId: 'x' }, () =>
      service.listMaterials({ tag: 'hot' }),
    );
    expect(hot.length).toBe(1);
    expect(hot[0].type).toBe('video');
  });

  /** G-04 追加标签（去重） */
  it('addTag 追加并去重标签', async () => {
    const created = await TenantContext.run({ tenantId: TENANT, traceId: 'x' }, () =>
      service.uploadMaterial({ type: 'image', url: 'u', tags: ['a'] } as any),
    );
    const tagged = await TenantContext.run({ tenantId: TENANT, traceId: 'x' }, () =>
      service.addTag(created.id, ['a', 'b']),
    );
    expect(tagged.tags).toEqual(['a', 'b']);
  });

  /** G-05 不存在素材抛 MATERIAL_NOT_FOUND */
  it('getMaterial 不存在抛 MATERIAL_NOT_FOUND', async () => {
    await expect(
      TenantContext.run({ tenantId: TENANT, traceId: 'x' }, () => service.getMaterial(9999)),
    ).rejects.toMatchObject({ code: 'MATERIAL_NOT_FOUND' });
  });

  /** G-06 跨租户隔离：查询 where 携带 tenantId */
  it('listMaterials / getMaterial 查询携带 tenantId', async () => {
    await TenantContext.run({ tenantId: TENANT, traceId: 'x' }, () => service.listMaterials({}));
    expect(materialRepo.find).toHaveBeenCalledWith({
      where: { tenantId: TENANT },
      order: { createdAt: 'DESC' },
    });
    await TenantContext.run({ tenantId: TENANT, traceId: 'x' }, () =>
      service.getMaterial(1).catch(() => {}),
    );
    expect(materialRepo.findOne).toHaveBeenCalledWith({ where: { id: 1, tenantId: TENANT } });
  });
});
