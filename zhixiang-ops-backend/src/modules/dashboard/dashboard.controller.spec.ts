import { DashboardController } from './dashboard.controller';

describe('DashboardController', () => {
  let controller: DashboardController;
  let dashboardService: { [k: string]: jest.Mock };

  beforeEach(() => {
    dashboardService = { getStats: jest.fn() };
    controller = new DashboardController(dashboardService as any);
  });

  it('stats 直接返回 dashboardService.getStats()', async () => {
    dashboardService.getStats.mockResolvedValue({ orders: 10, revenue: 100 });
    const r = await controller.stats();
    expect(r).toEqual({ orders: 10, revenue: 100 });
    expect(dashboardService.getStats).toHaveBeenCalledTimes(1);
  });
});
