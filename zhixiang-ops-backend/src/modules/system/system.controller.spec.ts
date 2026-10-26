import { SystemController } from './system.controller';

describe('SystemController', () => {
  let controller: SystemController;
  let svc: { [k: string]: jest.Mock };

  beforeEach(() => {
    svc = {
      getStatus: jest.fn(),
      initDeploy: jest.fn(),
      seedData: jest.fn(),
    };
    controller = new SystemController(svc as any);
  });

  it('status 委托 svc.getStatus 并原样返回', async () => {
    svc.getStatus.mockResolvedValue({ initialized: true });
    await expect(controller.status()).resolves.toEqual({ initialized: true });
    expect(svc.getStatus).toHaveBeenCalledWith();
  });

  it('init 委托 svc.initDeploy 并原样返回', async () => {
    const dto = { adminUsername: 'a' } as any;
    svc.initDeploy.mockResolvedValue({ done: true });
    await expect(controller.init(dto)).resolves.toEqual({ done: true });
    expect(svc.initDeploy).toHaveBeenCalledWith(dto);
  });

  it('seed 委托 svc.seedData 并原样返回', async () => {
    const dto = { seedAll: true } as any;
    svc.seedData.mockResolvedValue({ seeded: 5 });
    await expect(controller.seed(dto)).resolves.toEqual({ seeded: 5 });
    expect(svc.seedData).toHaveBeenCalledWith(dto);
  });
});
