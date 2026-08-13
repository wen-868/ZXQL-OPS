import { TenantContext } from '../../tenant/tenant-context';
import { OverseasService } from './x.service';

const ctx = { tenantId: '1', traceId: 't' };
const run = <T>(cb: () => T): T => TenantContext.run(ctx, cb);

/** 直接实例化 service（不走 Nest DI），隔离验证 X 内容出海业务逻辑。 */
describe('OverseasService (X 内容出海)', () => {
  let svc: OverseasService;
  let platformRepo: any;
  let videoRepo: any;
  let taskRepo: any;
  let sourceRepo: any;
  let skill: any;
  let audit: any;

  beforeEach(() => {
    const mk = () => ({
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation(async (e: any) => ({ ...e, id: e.id ?? 11 })),
      softDelete: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockImplementation((e: any) => e),
    });
    platformRepo = mk();
    videoRepo = mk();
    taskRepo = mk();
    sourceRepo = mk();
    skill = { generateText: jest.fn().mockResolvedValue('Translated script.') };
    audit = { record: jest.fn().mockResolvedValue({}) };
    svc = new OverseasService(platformRepo, videoRepo, taskRepo, sourceRepo, skill, audit);
  });

  it('createPlatform 落库 + 写审计', async () => {
    const r = await run(() => svc.createPlatform({ code: 'tiktok', name: 'TikTok' } as any));
    expect(r.id).toBe(11);
    expect(r.tenantId).toBe('1');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'create', module: 'overseas_platform' }),
    );
  });

  it('createOverseasVideo 校验源视频存在 + 平台存在', async () => {
    platformRepo.findOne.mockResolvedValueOnce({ id: 2, tenantId: '1', code: 'tiktok' });
    sourceRepo.findOne.mockResolvedValueOnce({ id: 9, tenantId: '1', title: '原片' });
    const r = await run(() =>
      svc.createOverseasVideo({ sourceVideoId: 9, platformId: 2, targetLang: 'en' } as any),
    );
    expect(r.sourceVideoId).toBe(9);
    expect(r.title).toBe('原片');
  });

  it('createOverseasVideo 源视频不存在 → VIDEO_NOT_FOUND', async () => {
    platformRepo.findOne.mockResolvedValueOnce({ id: 2, tenantId: '1' });
    sourceRepo.findOne.mockResolvedValueOnce(null);
    await expect(
      run(() =>
        svc.createOverseasVideo({ sourceVideoId: 999, platformId: 2, targetLang: 'en' } as any),
      ),
    ).rejects.toMatchObject({ code: 'VIDEO_NOT_FOUND' });
  });

  it('createTranslationTask 调用 SkillGateway 译制 + 落任务 + 视频转译制态', async () => {
    videoRepo.findOne.mockResolvedValueOnce({
      id: 5,
      tenantId: '1',
      title: '中文文案',
      status: 'draft',
      meta: {},
    });
    const r = await run(() => svc.createTranslationTask({ videoId: 5, targetLang: 'en' }));
    expect(skill.generateText).toHaveBeenCalledTimes(1);
    expect(r.status).toBe('done');
    expect(r.translatedScript).toBe('Translated script.');
    // 视频被标记为译制态
    expect(videoRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 5, status: 'translating' }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'done', module: 'translation_task' }),
    );
  });

  it('createTranslationTask 能力网关异常 → SKILL_UNAVAILABLE + 落失败任务', async () => {
    videoRepo.findOne.mockResolvedValueOnce({
      id: 5,
      tenantId: '1',
      title: '中文文案',
      status: 'draft',
      meta: {},
    });
    skill.generateText.mockRejectedValueOnce(new Error('ollama down'));
    await expect(
      run(() => svc.createTranslationTask({ videoId: 5, targetLang: 'en' })),
    ).rejects.toMatchObject({ code: 'SKILL_UNAVAILABLE' });
    expect(taskRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
  });

  it('publishOverseasVideo 置 published + 默认外链', async () => {
    videoRepo.findOne.mockResolvedValueOnce({
      id: 5,
      tenantId: '1',
      status: 'translating',
    });
    const r = await run(() => svc.publishOverseasVideo(5));
    expect(r.status).toBe('published');
    expect(r.url).toContain('cdn.zhixiang.ops');
  });
});
