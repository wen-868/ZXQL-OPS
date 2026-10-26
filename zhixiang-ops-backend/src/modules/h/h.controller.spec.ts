import { VideoController } from './h.controller';

describe('VideoController', () => {
  let controller: VideoController;
  let videoService: { [k: string]: jest.Mock };

  beforeEach(() => {
    videoService = {
      fromScript: jest.fn(),
      editVideo: jest.fn(),
      reviewVideo: jest.fn(),
      listVideos: jest.fn(),
    };
    controller = new VideoController(videoService as any);
  });

  it('fromScript 委托 videoService.fromScript 并原样返回', async () => {
    const dto = { script: 's' } as any;
    videoService.fromScript.mockResolvedValue({ id: 1 });
    await expect(controller.fromScript(dto)).resolves.toEqual({ id: 1 });
    expect(videoService.fromScript).toHaveBeenCalledWith(dto);
  });

  it('edit 将 id 转换为 Number 并原样返回', async () => {
    const dto = { template: 't' } as any;
    videoService.editVideo.mockResolvedValue({ id: 2 });
    await expect(controller.edit('2', dto)).resolves.toEqual({ id: 2 });
    expect(videoService.editVideo).toHaveBeenCalledWith(2, dto);
  });

  it('review 将 id 转换为 Number 并原样返回', async () => {
    videoService.reviewVideo.mockResolvedValue({ pass: true });
    await expect(controller.review('3')).resolves.toEqual({ pass: true });
    expect(videoService.reviewVideo).toHaveBeenCalledWith(3);
  });

  it('list 委托 videoService.listVideos 并原样返回', async () => {
    videoService.listVideos.mockResolvedValue([{ id: 1 }]);
    await expect(controller.list()).resolves.toEqual([{ id: 1 }]);
    expect(videoService.listVideos).toHaveBeenCalledWith();
  });
});
