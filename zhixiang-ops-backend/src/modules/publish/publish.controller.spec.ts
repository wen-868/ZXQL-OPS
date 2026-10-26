import { PublishController } from './publish.controller';

describe('PublishController', () => {
  let controller: PublishController;
  let publishService: { [k: string]: jest.Mock };

  beforeEach(() => {
    publishService = {
      publish: jest.fn(),
      batchPublish: jest.fn(),
      getPublish: jest.fn(),
      getFunnel: jest.fn(),
    };
    controller = new PublishController(publishService as any);
  });

  it('publish 委托 publishService.publish 并原样返回', async () => {
    const dto = { platform: 'douyin' } as any;
    publishService.publish.mockResolvedValue({ id: 1 });
    await expect(controller.publish(dto)).resolves.toEqual({ id: 1 });
    expect(publishService.publish).toHaveBeenCalledWith(dto);
  });

  it('batchPublish 委托 publishService.batchPublish 并原样返回', async () => {
    const dto = { ids: [1, 2] } as any;
    publishService.batchPublish.mockResolvedValue({ count: 2 });
    await expect(controller.batchPublish(dto)).resolves.toEqual({ count: 2 });
    expect(publishService.batchPublish).toHaveBeenCalledWith(dto);
  });

  it('getPublish 将 id 转换为 Number 并原样返回', async () => {
    publishService.getPublish.mockResolvedValue({ id: 3 });
    await expect(controller.getPublish('3')).resolves.toEqual({ id: 3 });
    expect(publishService.getPublish).toHaveBeenCalledWith(3);
  });

  it('getFunnel 将 id 转换为 Number 并原样返回', async () => {
    publishService.getFunnel.mockResolvedValue({ funnel: {} });
    await expect(controller.getFunnel('4')).resolves.toEqual({ funnel: {} });
    expect(publishService.getFunnel).toHaveBeenCalledWith(4);
  });
});
