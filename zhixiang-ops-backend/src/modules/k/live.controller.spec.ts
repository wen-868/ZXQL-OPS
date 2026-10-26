import { LiveController } from './live.controller';
import { AppError } from '../../shared/app-error';

describe('LiveController', () => {
  let controller: LiveController;
  let live: { [k: string]: jest.Mock };

  beforeEach(() => {
    live = {
      createRoom: jest.fn(),
      startRoom: jest.fn(),
      endRoom: jest.fn(),
      pushStream: jest.fn(),
      getRoom: jest.fn(),
      getStats: jest.fn(),
      reportStat: jest.fn(),
      createDigitalHuman: jest.fn(),
      danmuAiReply: jest.fn(),
    };
    controller = new LiveController(live as any);
  });

  it('createRoom 委托 service 并返回信封', async () => {
    const dto = { title: 'r' };
    live.createRoom.mockResolvedValue({ id: 1 });
    const r = await controller.createRoom(dto as any);
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ id: 1 });
    expect(live.createRoom).toHaveBeenCalledWith(dto);
  });

  it('startRoom 委托 service 并返回信封', async () => {
    live.startRoom.mockResolvedValue({ id: 1, status: 'live' });
    const r = await controller.startRoom('1');
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ id: 1, status: 'live' });
    expect(live.startRoom).toHaveBeenCalledWith(1);
  });

  it('endRoom 委托 service 并返回信封', async () => {
    live.endRoom.mockResolvedValue({ id: 1, status: 'ended' });
    const r = await controller.endRoom('1');
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ id: 1, status: 'ended' });
    expect(live.endRoom).toHaveBeenCalledWith(1);
  });

  it('pushStream rtmpUrl 为空时抛出 LIVE_RTMP_URL_REQUIRED', async () => {
    await expect(controller.pushStream('1', '')).rejects.toThrow(AppError);
    expect(live.pushStream).not.toHaveBeenCalled();
  });

  it('pushStream 委托 service 并返回信封', async () => {
    live.pushStream.mockResolvedValue({ pushed: true });
    const r = await controller.pushStream('1', 'rtmp://cdn');
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ pushed: true });
    expect(live.pushStream).toHaveBeenCalledWith(1, 'rtmp://cdn');
  });

  it('getRoom 委托 service 并返回信封', async () => {
    live.getRoom.mockResolvedValue({ id: 2 });
    const r = await controller.getRoom('2');
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ id: 2 });
    expect(live.getRoom).toHaveBeenCalledWith(2);
  });

  it('getStats 委托 service 并返回信封', async () => {
    live.getStats.mockResolvedValue({ viewers: 100 });
    const r = await controller.getStats('2');
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ viewers: 100 });
    expect(live.getStats).toHaveBeenCalledWith(2);
  });

  it('reportStat 合并 roomId 后委托 service 并返回信封', async () => {
    const dto = { viewers: 5 };
    live.reportStat.mockResolvedValue({ ok: true });
    const r = await controller.reportStat('2', dto as any);
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ ok: true });
    expect(live.reportStat).toHaveBeenCalledWith({ ...dto, roomId: 2 });
  });

  it('createDigitalHuman 委托 service 并返回信封', async () => {
    const dto = { name: 'dh' };
    live.createDigitalHuman.mockResolvedValue({ id: 4 });
    const r = await controller.createDigitalHuman(dto);
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ id: 4 });
    expect(live.createDigitalHuman).toHaveBeenCalledWith(dto);
  });

  it('danmuAiReply 委托 service 并返回信封', async () => {
    const dto = { message: 'hi' };
    live.danmuAiReply.mockResolvedValue({ reply: 'hello' });
    const r = await controller.danmuAiReply(dto as any);
    expect(r.code).toBe('0');
    expect(r.data).toEqual({ reply: 'hello' });
    expect(live.danmuAiReply).toHaveBeenCalledWith(dto);
  });
});
