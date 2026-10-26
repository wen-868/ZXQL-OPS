import { AdController } from './ad.controller';

describe('AdController', () => {
  let controller: AdController;
  let ad: { [k: string]: jest.Mock };

  beforeEach(() => {
    ad = {
      createAccount: jest.fn(),
      createCampaign: jest.fn(),
      getMetrics: jest.fn(),
      smartBid: jest.fn(),
      review: jest.fn(),
      reportMetric: jest.fn(),
    };
    controller = new AdController(ad as any);
  });

  it('createAccount 委托 service 并返回信封', async () => {
    const dto = { name: 'acc' };
    ad.createAccount.mockResolvedValue({ id: 1 });
    const r = await controller.createAccount(dto as any);
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ id: 1 });
    expect(ad.createAccount).toHaveBeenCalledWith(dto);
  });

  it('createCampaign 委托 service 并返回信封', async () => {
    const dto = { name: 'camp' };
    ad.createCampaign.mockResolvedValue({ id: 2 });
    const r = await controller.createCampaign(dto as any);
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ id: 2 });
    expect(ad.createCampaign).toHaveBeenCalledWith(dto);
  });

  it('getMetrics 委托 service 并返回信封', async () => {
    ad.getMetrics.mockResolvedValue({ cost: 10 });
    const r = await controller.getMetrics('3');
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ cost: 10 });
    expect(ad.getMetrics).toHaveBeenCalledWith(3);
  });

  it('smartBid 合并 campaignId 后委托 service 并返回信封', async () => {
    const dto = { bid: 5 };
    ad.smartBid.mockResolvedValue({ applied: true });
    const r = await controller.smartBid('3', dto as any);
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ applied: true });
    expect(ad.smartBid).toHaveBeenCalledWith({ ...dto, campaignId: 3 });
  });

  it('review 委托 service 并返回信封', async () => {
    ad.review.mockResolvedValue({ passed: true });
    const r = await controller.review('3');
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ passed: true });
    expect(ad.review).toHaveBeenCalledWith(3);
  });

  it('reportMetric 合并 campaignId 后委托 service 并返回信封', async () => {
    const dto = { spend: 100 };
    ad.reportMetric.mockResolvedValue({ ok: true });
    const r = await controller.reportMetric('3', dto as any);
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ ok: true });
    expect(ad.reportMetric).toHaveBeenCalledWith({ ...dto, campaignId: 3 });
  });
});
