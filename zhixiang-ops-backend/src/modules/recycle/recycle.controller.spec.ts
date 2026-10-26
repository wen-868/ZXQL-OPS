import { RecycleController } from './recycle.controller';

describe('RecycleController', () => {
  let controller: RecycleController;
  let recycleService: { [k: string]: jest.Mock };

  beforeEach(() => {
    recycleService = {
      createRecycle: jest.fn(),
      getRecycle: jest.fn(),
      getFeedback: jest.fn(),
      rerunAnalysis: jest.fn(),
    };
    controller = new RecycleController(recycleService as any);
  });

  it('createRecycle 委托 recycleService.createRecycle 并原样返回', async () => {
    const dto = { publishId: 1 } as any;
    recycleService.createRecycle.mockResolvedValue({ id: 1 });
    await expect(controller.createRecycle(dto)).resolves.toEqual({ id: 1 });
    expect(recycleService.createRecycle).toHaveBeenCalledWith(dto);
  });

  it('getRecycle 将 id 转换为 Number 并原样返回', async () => {
    recycleService.getRecycle.mockResolvedValue({ id: 2 });
    await expect(controller.getRecycle('2')).resolves.toEqual({ id: 2 });
    expect(recycleService.getRecycle).toHaveBeenCalledWith(2);
  });

  it('getFeedback 将 videoId 转换为 Number 并原样返回', async () => {
    recycleService.getFeedback.mockResolvedValue({ videoId: 3 });
    await expect(controller.getFeedback('3')).resolves.toEqual({ videoId: 3 });
    expect(recycleService.getFeedback).toHaveBeenCalledWith(3);
  });

  it('rerunAnalysis 委托 recycleService.rerunAnalysis 并原样返回', async () => {
    recycleService.rerunAnalysis.mockResolvedValue({ rerun: true });
    await expect(controller.rerunAnalysis()).resolves.toEqual({ rerun: true });
    expect(recycleService.rerunAnalysis).toHaveBeenCalledWith();
  });
});
