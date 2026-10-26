import { DashboardController } from './m.controller';

describe('DashboardController', () => {
  let controller: DashboardController;
  let dashboardService: { [k: string]: jest.Mock };

  beforeEach(() => {
    dashboardService = {
      getOverview: jest.fn(),
      getFunnel: jest.fn(),
      getAccountCompare: jest.fn(),
      getTopicEfficiency: jest.fn(),
      getHumanHook: jest.fn(),
      listDashboards: jest.fn(),
      createDashboard: jest.fn(),
      getDashboard: jest.fn(),
      updateDashboard: jest.fn(),
      deleteDashboard: jest.fn(),
    };
    controller = new DashboardController(dashboardService as any);
  });

  it('getOverview 委托 dashboardService.getOverview 并原样返回', async () => {
    dashboardService.getOverview.mockResolvedValue({ overview: {} });
    await expect(controller.getOverview()).resolves.toEqual({ overview: {} });
    expect(dashboardService.getOverview).toHaveBeenCalledWith();
  });

  it('getFunnel 委托 dashboardService.getFunnel 并原样返回', async () => {
    dashboardService.getFunnel.mockResolvedValue({ funnel: {} });
    await expect(controller.getFunnel()).resolves.toEqual({ funnel: {} });
    expect(dashboardService.getFunnel).toHaveBeenCalledWith();
  });

  it('getAccountCompare 委托 dashboardService.getAccountCompare 并原样返回', async () => {
    dashboardService.getAccountCompare.mockResolvedValue({ rows: [] });
    await expect(controller.getAccountCompare()).resolves.toEqual({ rows: [] });
    expect(dashboardService.getAccountCompare).toHaveBeenCalledWith();
  });

  it('getTopicEfficiency 委托 dashboardService.getTopicEfficiency 并原样返回', async () => {
    dashboardService.getTopicEfficiency.mockResolvedValue({ rows: [] });
    await expect(controller.getTopicEfficiency()).resolves.toEqual({ rows: [] });
    expect(dashboardService.getTopicEfficiency).toHaveBeenCalledWith();
  });

  it('getHumanHook 委托 dashboardService.getHumanHook 并原样返回', async () => {
    dashboardService.getHumanHook.mockResolvedValue({ grid: [] });
    await expect(controller.getHumanHook()).resolves.toEqual({ grid: [] });
    expect(dashboardService.getHumanHook).toHaveBeenCalledWith();
  });

  it('listDashboards 委托 dashboardService.listDashboards 并原样返回', async () => {
    dashboardService.listDashboards.mockResolvedValue([{ id: 1 }]);
    await expect(controller.listDashboards()).resolves.toEqual([{ id: 1 }]);
    expect(dashboardService.listDashboards).toHaveBeenCalledWith();
  });

  it('createDashboard 委托 dashboardService.createDashboard 并原样返回', async () => {
    const dto = { title: 't' } as any;
    dashboardService.createDashboard.mockResolvedValue({ id: 1 });
    await expect(controller.createDashboard(dto)).resolves.toEqual({ id: 1 });
    expect(dashboardService.createDashboard).toHaveBeenCalledWith(dto);
  });

  it('getDashboard 将 id 转换为 Number 并原样返回', async () => {
    dashboardService.getDashboard.mockResolvedValue({ id: 2 });
    await expect(controller.getDashboard('2')).resolves.toEqual({ id: 2 });
    expect(dashboardService.getDashboard).toHaveBeenCalledWith(2);
  });

  it('updateDashboard 将 id 转换为 Number 并原样返回', async () => {
    const dto = { title: 'u' } as any;
    dashboardService.updateDashboard.mockResolvedValue({ id: 3 });
    await expect(controller.updateDashboard('3', dto)).resolves.toEqual({ id: 3 });
    expect(dashboardService.updateDashboard).toHaveBeenCalledWith(3, dto);
  });

  it('deleteDashboard 将 id 转换为 Number 并原样返回', async () => {
    dashboardService.deleteDashboard.mockResolvedValue({ deleted: true });
    await expect(controller.deleteDashboard('4')).resolves.toEqual({ deleted: true });
    expect(dashboardService.deleteDashboard).toHaveBeenCalledWith(4);
  });
});
