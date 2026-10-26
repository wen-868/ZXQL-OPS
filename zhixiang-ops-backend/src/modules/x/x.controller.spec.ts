import { OverseasController } from './x.controller';

describe('OverseasController', () => {
  let controller: OverseasController;
  let svc: { [k: string]: jest.Mock };

  beforeEach(() => {
    svc = {
      createPlatform: jest.fn(),
      listPlatforms: jest.fn(),
      getPlatform: jest.fn(),
      createOverseasVideo: jest.fn(),
      listOverseasVideos: jest.fn(),
      getOverseasVideo: jest.fn(),
      updateOverseasVideo: jest.fn(),
      publishOverseasVideo: jest.fn(),
      createTranslationTask: jest.fn(),
      listTranslationTasks: jest.fn(),
      summary: jest.fn(),
    };
    controller = new OverseasController(svc as any);
  });

  it('createPlatform 委托 service 并返回信封', async () => {
    const dto = { name: 'tiktok' };
    svc.createPlatform.mockResolvedValue({ id: 1 });
    const r = await controller.createPlatform(dto as any);
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ id: 1 });
    expect(svc.createPlatform).toHaveBeenCalledWith(dto);
  });

  it('listPlatforms 委托 service 并返回信封', async () => {
    svc.listPlatforms.mockResolvedValue([{ id: 1 }]);
    const r = await controller.listPlatforms();
    expect(r.code).toBe('0');
    expect(r.data).toEqual([{ id: 1 }]);
    expect(svc.listPlatforms).toHaveBeenCalledTimes(1);
  });

  it('getPlatform 委托 service 并返回信封', async () => {
    svc.getPlatform.mockResolvedValue({ id: 1 });
    const r = await controller.getPlatform(1);
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ id: 1 });
    expect(svc.getPlatform).toHaveBeenCalledWith(1);
  });

  it('createOverseasVideo 委托 service 并返回信封', async () => {
    const dto = { platformId: 1, title: 'v' };
    svc.createOverseasVideo.mockResolvedValue({ id: 2 });
    const r = await controller.createOverseasVideo(dto as any);
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ id: 2 });
    expect(svc.createOverseasVideo).toHaveBeenCalledWith(dto);
  });

  it('listOverseasVideos 委托 service 并返回信封', async () => {
    svc.listOverseasVideos.mockResolvedValue([{ id: 2 }]);
    const r = await controller.listOverseasVideos();
    expect(r.code).toBe('0');
    expect(r.data).toEqual([{ id: 2 }]);
    expect(svc.listOverseasVideos).toHaveBeenCalledTimes(1);
  });

  it('getOverseasVideo 委托 service 并返回信封', async () => {
    svc.getOverseasVideo.mockResolvedValue({ id: 2 });
    const r = await controller.getOverseasVideo(2);
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ id: 2 });
    expect(svc.getOverseasVideo).toHaveBeenCalledWith(2);
  });

  it('updateOverseasVideo 委托 service 并返回信封', async () => {
    const dto = { title: 'v2' };
    svc.updateOverseasVideo.mockResolvedValue({ id: 2, title: 'v2' });
    const r = await controller.updateOverseasVideo(2, dto);
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ id: 2, title: 'v2' });
    expect(svc.updateOverseasVideo).toHaveBeenCalledWith(2, dto);
  });

  it('publishOverseasVideo 委托 service 并返回信封', async () => {
    svc.publishOverseasVideo.mockResolvedValue({ published: true });
    const r = await controller.publishOverseasVideo(2, 'https://tiktok.com/x');
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ published: true });
    expect(svc.publishOverseasVideo).toHaveBeenCalledWith(2, 'https://tiktok.com/x');
  });

  it('createTranslationTask 委托 service 并返回信封', async () => {
    const dto = { videoId: 2, langs: ['en'] };
    svc.createTranslationTask.mockResolvedValue({ id: 3 });
    const r = await controller.createTranslationTask(dto as any);
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ id: 3 });
    expect(svc.createTranslationTask).toHaveBeenCalledWith(dto);
  });

  it('listTranslationTasks 委托 service 并返回信封', async () => {
    svc.listTranslationTasks.mockResolvedValue([{ id: 3 }]);
    const r = await controller.listTranslationTasks();
    expect(r.code).toBe('0');
    expect(r.data).toEqual([{ id: 3 }]);
    expect(svc.listTranslationTasks).toHaveBeenCalledTimes(1);
  });

  it('summary 委托 service 并返回信封', async () => {
    svc.summary.mockResolvedValue({ platforms: 1, videos: 2 });
    const r = await controller.summary();
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ platforms: 1, videos: 2 });
    expect(svc.summary).toHaveBeenCalledTimes(1);
  });
});
