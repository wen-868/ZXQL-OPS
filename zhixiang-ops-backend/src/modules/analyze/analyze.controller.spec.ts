import { AnalyzeController } from './analyze.controller';

describe('AnalyzeController', () => {
  let controller: AnalyzeController;
  let analyzeService: { [k: string]: jest.Mock };

  beforeEach(() => {
    analyzeService = {
      createAnalysisTask: jest.fn(),
      getReport: jest.fn(),
      getAnalysisTask: jest.fn(),
      listInsights: jest.fn(),
      createInsight: jest.fn(),
    };
    controller = new AnalyzeController(analyzeService as any);
  });

  it('createAnalysisTask 委托 analyzeService.createAnalysisTask 并原样返回', async () => {
    const dto = { videoId: 1 } as any;
    analyzeService.createAnalysisTask.mockResolvedValue({ id: 1 });
    await expect(controller.createAnalysisTask(dto)).resolves.toEqual({ id: 1 });
    expect(analyzeService.createAnalysisTask).toHaveBeenCalledWith(dto);
  });

  it('getReport 委托 analyzeService.getReport 并原样返回', async () => {
    analyzeService.getReport.mockResolvedValue({ report: 'r' });
    await expect(controller.getReport()).resolves.toEqual({ report: 'r' });
    expect(analyzeService.getReport).toHaveBeenCalledWith();
  });

  it('getAnalysisTask 将 id 转换为 Number 并原样返回', async () => {
    analyzeService.getAnalysisTask.mockResolvedValue({ id: 9 });
    await expect(controller.getAnalysisTask('9')).resolves.toEqual({ id: 9 });
    expect(analyzeService.getAnalysisTask).toHaveBeenCalledWith(9);
  });

  it('listInsights 委托 analyzeService.listInsights 并原样返回', async () => {
    const query = { page: 1 } as any;
    analyzeService.listInsights.mockResolvedValue({ items: [] });
    await expect(controller.listInsights(query)).resolves.toEqual({ items: [] });
    expect(analyzeService.listInsights).toHaveBeenCalledWith(query);
  });

  it('createInsight 委托 analyzeService.createInsight 并原样返回', async () => {
    const dto = { insight: 'x' } as any;
    analyzeService.createInsight.mockResolvedValue({ id: 2 });
    await expect(controller.createInsight(dto)).resolves.toEqual({ id: 2 });
    expect(analyzeService.createInsight).toHaveBeenCalledWith(dto);
  });
});
