import { IntelController } from './intel.controller';

describe('IntelController', () => {
  let controller: IntelController;
  let intelService: { [k: string]: jest.Mock };

  beforeEach(() => {
    intelService = {
      createSource: jest.fn(),
      listSources: jest.fn(),
      updateSource: jest.fn(),
      removeSource: jest.fn(),
      collectFromSource: jest.fn(),
      createCompetitor: jest.fn(),
      listCompetitors: jest.fn(),
      findOneCompetitor: jest.fn(),
      updateCompetitor: jest.fn(),
      removeCompetitor: jest.fn(),
      toggleMonitor: jest.fn(),
      createCollectTask: jest.fn(),
      getCollectTask: jest.fn(),
      listCollectTasks: jest.fn(),
      controlCollectTask: jest.fn(),
      findCleanComments: jest.fn(),
      reviewComment: jest.fn(),
      reviewCommentsBatch: jest.fn(),
      mineKeywords: jest.fn(),
      getHot: jest.fn(),
    };
    controller = new IntelController(intelService as any);
  });

  it('createSource 委托 intelService.createSource 并原样返回', async () => {
    const dto = { name: 'x' } as any;
    intelService.createSource.mockResolvedValue({ id: 1 });
    await expect(controller.createSource(dto)).resolves.toEqual({ id: 1 });
    expect(intelService.createSource).toHaveBeenCalledWith(dto);
  });

  it('listSources 委托 intelService.listSources 并原样返回', async () => {
    intelService.listSources.mockResolvedValue([{ id: 1 }]);
    await expect(controller.listSources()).resolves.toEqual([{ id: 1 }]);
    expect(intelService.listSources).toHaveBeenCalledWith();
  });

  it('updateSource 将 id 转换为 Number 并原样返回', async () => {
    const dto = { name: 'y' } as any;
    intelService.updateSource.mockResolvedValue({ id: 2 });
    await expect(controller.updateSource('2', dto)).resolves.toEqual({ id: 2 });
    expect(intelService.updateSource).toHaveBeenCalledWith(2, dto);
  });

  it('removeSource 将 id 转换为 Number 并原样返回', async () => {
    intelService.removeSource.mockResolvedValue({ removed: true });
    await expect(controller.removeSource('3')).resolves.toEqual({ removed: true });
    expect(intelService.removeSource).toHaveBeenCalledWith(3);
  });

  it('collectFromSource 将 id 转换为 Number 并原样返回', async () => {
    intelService.collectFromSource.mockResolvedValue({ collected: 5 });
    await expect(controller.collectFromSource('4')).resolves.toEqual({ collected: 5 });
    expect(intelService.collectFromSource).toHaveBeenCalledWith(4);
  });

  it('createCompetitor 委托 intelService.createCompetitor 并原样返回', async () => {
    const dto = { name: 'c' } as any;
    intelService.createCompetitor.mockResolvedValue({ id: 1 });
    await expect(controller.createCompetitor(dto)).resolves.toEqual({ id: 1 });
    expect(intelService.createCompetitor).toHaveBeenCalledWith(dto);
  });

  it('listCompetitors 委托 intelService.listCompetitors 并原样返回', async () => {
    intelService.listCompetitors.mockResolvedValue([{ id: 1 }]);
    await expect(controller.listCompetitors()).resolves.toEqual([{ id: 1 }]);
    expect(intelService.listCompetitors).toHaveBeenCalledWith();
  });

  it('getCompetitor 将 id 转换为 Number 并原样返回', async () => {
    intelService.findOneCompetitor.mockResolvedValue({ id: 6 });
    await expect(controller.getCompetitor('6')).resolves.toEqual({ id: 6 });
    expect(intelService.findOneCompetitor).toHaveBeenCalledWith(6);
  });

  it('updateCompetitor 将 id 转换为 Number 并原样返回', async () => {
    const dto = { name: 'c2' } as any;
    intelService.updateCompetitor.mockResolvedValue({ id: 7 });
    await expect(controller.updateCompetitor('7', dto)).resolves.toEqual({ id: 7 });
    expect(intelService.updateCompetitor).toHaveBeenCalledWith(7, dto);
  });

  it('removeCompetitor 将 id 转换为 Number 并原样返回', async () => {
    intelService.removeCompetitor.mockResolvedValue({ removed: true });
    await expect(controller.removeCompetitor('8')).resolves.toEqual({ removed: true });
    expect(intelService.removeCompetitor).toHaveBeenCalledWith(8);
  });

  it('toggleMonitor 将 id 转换为 Number 并原样返回', async () => {
    intelService.toggleMonitor.mockResolvedValue({ monitoring: true });
    await expect(controller.toggleMonitor('9')).resolves.toEqual({ monitoring: true });
    expect(intelService.toggleMonitor).toHaveBeenCalledWith(9);
  });

  it('createCollectTask 委托 intelService.createCollectTask 并原样返回', async () => {
    const dto = { sourceId: 1 } as any;
    intelService.createCollectTask.mockResolvedValue({ id: 1 });
    await expect(controller.createCollectTask(dto)).resolves.toEqual({ id: 1 });
    expect(intelService.createCollectTask).toHaveBeenCalledWith(dto);
  });

  it('getCollectTask 将 id 转换为 Number 并原样返回', async () => {
    intelService.getCollectTask.mockResolvedValue({ id: 3 });
    await expect(controller.getCollectTask('3')).resolves.toEqual({ id: 3 });
    expect(intelService.getCollectTask).toHaveBeenCalledWith(3);
  });

  it('listCollectTasks 将分页参数转换为数字并传默认值', async () => {
    intelService.listCollectTasks.mockResolvedValue({ items: [] });
    await expect(controller.listCollectTasks('3', '50')).resolves.toEqual({ items: [] });
    expect(intelService.listCollectTasks).toHaveBeenCalledWith(3, 50);
  });

  it('listCollectTasks 无参数时用默认分页', async () => {
    intelService.listCollectTasks.mockResolvedValue({ items: [] });
    await expect(controller.listCollectTasks()).resolves.toEqual({ items: [] });
    expect(intelService.listCollectTasks).toHaveBeenCalledWith(1, 20);
  });

  it('controlCollectTask 将 id 转换为 Number 并透传 action', async () => {
    const dto = { action: 'pause' } as any;
    intelService.controlCollectTask.mockResolvedValue({ paused: true });
    await expect(controller.controlCollectTask('4', dto)).resolves.toEqual({ paused: true });
    expect(intelService.controlCollectTask).toHaveBeenCalledWith(4, 'pause');
  });

  it('listComments 委托 intelService.findCleanComments 并原样返回', async () => {
    const query = { status: 'pending' } as any;
    intelService.findCleanComments.mockResolvedValue({ items: [] });
    await expect(controller.listComments(query)).resolves.toEqual({ items: [] });
    expect(intelService.findCleanComments).toHaveBeenCalledWith(query);
  });

  it('reviewComment 将 id 转换为 Number 并透传 status', async () => {
    const dto = { status: 'approved' } as any;
    intelService.reviewComment.mockResolvedValue({ ok: true });
    await expect(controller.reviewComment('5', dto)).resolves.toEqual({ ok: true });
    expect(intelService.reviewComment).toHaveBeenCalledWith(5, 'approved');
  });

  it('reviewCommentsBatch 解构 ids 与 status 并原样返回', async () => {
    const dto = { ids: [1, 2], status: 'approved' } as any;
    intelService.reviewCommentsBatch.mockResolvedValue({ count: 2 });
    await expect(controller.reviewCommentsBatch(dto)).resolves.toEqual({ count: 2 });
    expect(intelService.reviewCommentsBatch).toHaveBeenCalledWith([1, 2], 'approved');
  });

  it('mineKeywords 委托 intelService.mineKeywords 并原样返回', async () => {
    const dto = { seed: 'x' } as any;
    intelService.mineKeywords.mockResolvedValue({ keywords: [] });
    await expect(controller.mineKeywords(dto)).resolves.toEqual({ keywords: [] });
    expect(intelService.mineKeywords).toHaveBeenCalledWith(dto);
  });

  it('getHot 透传 platform 与 hotType 并原样返回', async () => {
    intelService.getHot.mockResolvedValue({ items: [] });
    await expect(controller.getHot('douyin', 'trend')).resolves.toEqual({ items: [] });
    expect(intelService.getHot).toHaveBeenCalledWith('douyin', 'trend');
  });
});
