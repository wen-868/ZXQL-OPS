import { EventEmitter } from 'events';
import { VideoService } from './h.service';
import { TenantContext } from '../../tenant/tenant-context';
import type { Repository } from 'typeorm';

jest.mock('child_process');

const { spawn } = require('child_process');

function makeRepo() {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((d: any) => ({ ...d })),
    save: jest.fn(async (e: any) => e),
    count: jest.fn().mockResolvedValue(0),
  } as unknown as Repository<any>;
}

const TENANT = 't-h-1';

function mockSpawnOk() {
  (spawn as jest.Mock).mockImplementation(() => {
    const child: any = new EventEmitter();
    child.stderr = new EventEmitter();
    void Promise.resolve().then(() => child.emit('close', 0));
    return child;
  });
}

describe('VideoService（H 智能成片 / 验收点 H-01~08）', () => {
  let service: VideoService;
  let videoRepo: any;
  let scriptRepo: any;
  let materialRepo: any;
  let mockCompliance: any;
  let vStore: any[];
  let sStore: any[];
  let idSeq = 0;

  const scriptOf = (id: number, content: string) => ({
    id,
    tenantId: TENANT,
    title: `脚本${id}`,
    content,
  });

  beforeEach(() => {
    idSeq = 0;
    vStore = [];
    sStore = [scriptOf(1, '正常口播内容无违禁词'), scriptOf(2, '本产品是全国最顶级唯一选择')];
    videoRepo = makeRepo();
    videoRepo.find = jest.fn(async () => vStore);
    videoRepo.findOne = jest.fn(
      async (opt: any) =>
        vStore.find((d) => d.id === opt.where.id && d.tenantId === opt.where.tenantId) ?? null,
    );
    videoRepo.create = jest.fn((d: any) => ({ ...d }));
    videoRepo.save = jest.fn(async (e: any) => {
      if (e.id === undefined) e.id = ++idSeq;
      const i = vStore.findIndex((d) => d.id === e.id);
      if (i >= 0) vStore[i] = e;
      else vStore.push(e);
      return e;
    });

    scriptRepo = makeRepo();
    scriptRepo.findOne = jest.fn(
      async (opt: any) =>
        sStore.find((d) => d.id === opt.where.id && d.tenantId === opt.where.tenantId) ?? null,
    );

    materialRepo = makeRepo();

    mockSpawnOk();
    mockCompliance = {
      checkText: jest.fn(async (text: string) => {
        const hit = ['最', '顶级', '唯一', '绝对', '国家级', '100%', '第一', '万能'].some((w) =>
          (text ?? '').includes(w),
        );
        return {
          hits: hit ? [{ word: '最', position: 0, level: 'high' as const }] : [],
          level: hit ? ('high' as const) : ('none' as const),
          score: hit ? 100 : 0,
          result: hit ? ('block' as const) : ('pass' as const),
          checkedAt: new Date().toISOString(),
        };
      }),
    };
    service = new VideoService(videoRepo, scriptRepo, materialRepo, mockCompliance);
  });

  /** H-02 FFmpeg 剪辑跑通（mock spawn close 0 → status done + url 回写） */
  it('fromScript 成片 FFmpeg 成功 → status=done 且回写 url', async () => {
    const r = await TenantContext.run({ tenantId: TENANT, traceId: 'x' }, () =>
      service.fromScript({ scriptId: 1, ratio: '9:16' } as any),
    );
    expect(r.scriptId).toBe(1);
    expect(r.status).toBe('done');
    expect(r.url).toContain('oss://videos/');
    expect((r.meta as any)?.composed).toBe(true);
  });

  /** H-03 关联脚本不存在 → VIDEO_SCRIPT_NOT_FOUND */
  it('fromScript 脚本不存在抛 VIDEO_SCRIPT_NOT_FOUND', async () => {
    await expect(
      TenantContext.run({ tenantId: TENANT, traceId: 'x' }, () =>
        service.fromScript({ scriptId: 999 } as any),
      ),
    ).rejects.toMatchObject({ code: 'VIDEO_SCRIPT_NOT_FOUND' });
  });

  /** H-04 成片编辑更新素材/比例 */
  it('editVideo 更新 materialIds 与 ratio', async () => {
    const v = await TenantContext.run({ tenantId: TENANT, traceId: 'x' }, () =>
      service.fromScript({ scriptId: 1 } as any),
    );
    const edited = await TenantContext.run({ tenantId: TENANT, traceId: 'x' }, () =>
      service.editVideo(v.id, { materialIds: [10, 20], ratio: '1:1' }),
    );
    expect(edited.materialIds).toEqual([10, 20]);
    expect(edited.ratio).toBe('1:1');
  });

  /** H-05 送审 + 合规预检：含违禁词 → rejected；无 → passed */
  it('reviewVideo 合规预检按违禁词判定', async () => {
    const v = await TenantContext.run({ tenantId: TENANT, traceId: 'x' }, () =>
      service.fromScript({ scriptId: 1 } as any),
    );
    const passed = await TenantContext.run({ tenantId: TENANT, traceId: 'x' }, () =>
      service.reviewVideo(v.id),
    );
    expect(passed.reviewStatus).toBe('passed');

    const v2 = await TenantContext.run({ tenantId: TENANT, traceId: 'x' }, () =>
      service.fromScript({ scriptId: 2 } as any),
    );
    const rejected = await TenantContext.run({ tenantId: TENANT, traceId: 'x' }, () =>
      service.reviewVideo(v2.id),
    );
    expect(rejected.reviewStatus).toBe('rejected');
    expect((rejected.meta as any)?.compliance?.result).toBe('block');
  });

  /** H-06 视频库列表 */
  it('listVideos 返回成片库', async () => {
    await TenantContext.run({ tenantId: TENANT, traceId: 'x' }, () =>
      service.fromScript({ scriptId: 1 } as any),
    );
    const list = await TenantContext.run({ tenantId: TENANT, traceId: 'x' }, () =>
      service.listVideos(),
    );
    expect(list.length).toBe(1);
  });

  /** H-07 成片不存在 → VIDEO_NOT_FOUND */
  it('getVideo 不存在抛 VIDEO_NOT_FOUND', async () => {
    await expect(
      TenantContext.run({ tenantId: TENANT, traceId: 'x' }, () => service.getVideo(9999)),
    ).rejects.toMatchObject({ code: 'VIDEO_NOT_FOUND' });
  });

  /** H-08 跨租户隔离：查询 where 携带 tenantId */
  it('listVideos / getVideo 查询携带 tenantId', async () => {
    await TenantContext.run({ tenantId: TENANT, traceId: 'x' }, () => service.listVideos());
    expect(videoRepo.find).toHaveBeenCalledWith({
      where: { tenantId: TENANT },
      order: { createdAt: 'DESC' },
    });
    await TenantContext.run({ tenantId: TENANT, traceId: 'x' }, () =>
      service.getVideo(1).catch(() => {}),
    );
    expect(videoRepo.findOne).toHaveBeenCalledWith({ where: { id: 1, tenantId: TENANT } });
  });
});
