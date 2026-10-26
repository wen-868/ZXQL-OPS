import { Logger } from '@nestjs/common';
import { env } from '../../config/env';
import { DemoService } from './demo.service';

/**
 * DemoService 演示数据种子/清除单测。
 * 覆盖：onModuleInit（demoMode 开关/成功/失败）、ensureDemoUser（复用/创建）、
 * seedDemo（已存在跳过/全量种子）、clearDemoData（affected 汇总）、hasDemoData。
 * 通过 mock 五个 Repository + 临时改写 env.demoMode 实现分支覆盖。
 */

function makeRepo() {
  return {
    create: jest.fn((e: unknown) => e),
    save: jest.fn((e: unknown) =>
      Promise.resolve(
        Array.isArray(e) ? e.map((x, i) => ({ ...x, id: i + 1 })) : { ...(e as object), id: 1 },
      ),
    ),
    findOne: jest.fn(),
    delete: jest.fn(),
  };
}

interface Repos {
  user: ReturnType<typeof makeRepo>;
  account: ReturnType<typeof makeRepo>;
  topic: ReturnType<typeof makeRepo>;
  script: ReturnType<typeof makeRepo>;
  publish: ReturnType<typeof makeRepo>;
}

function makeService(): { service: DemoService; repos: Repos } {
  const repos = {
    user: makeRepo(),
    account: makeRepo(),
    topic: makeRepo(),
    script: makeRepo(),
    publish: makeRepo(),
  };
  const service = new DemoService(
    repos.user as never,
    repos.account as never,
    repos.topic as never,
    repos.script as never,
    repos.publish as never,
  );
  return { service, repos };
}

const ORIGINAL_DEMO_MODE = (env as { demoMode: boolean }).demoMode;

describe('DemoService', () => {
  const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

  afterEach(() => {
    logSpy.mockClear();
    errorSpy.mockClear();
    (env as { demoMode: boolean }).demoMode = ORIGINAL_DEMO_MODE;
  });

  describe('onModuleInit', () => {
    it('demoMode 关闭：直接返回，不触发种子', async () => {
      (env as { demoMode: boolean }).demoMode = false;
      const { service, repos } = makeService();
      await service.onModuleInit();
      expect(repos.account.findOne).not.toHaveBeenCalled();
    });

    it('demoMode 开启：执行种子并记录就绪日志', async () => {
      (env as { demoMode: boolean }).demoMode = true;
      const { service, repos } = makeService();
      repos.user.findOne.mockResolvedValue({ id: 1, username: 'demo' });
      repos.account.findOne.mockResolvedValue({ id: 1 });
      await service.onModuleInit();
      expect(repos.user.findOne).toHaveBeenCalled();
      expect(repos.account.findOne).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith('[demo] 演示数据已就绪');
    });

    it('种子失败：记录错误日志不中断', async () => {
      (env as { demoMode: boolean }).demoMode = true;
      const { service, repos } = makeService();
      repos.account.findOne.mockRejectedValue(new Error('db down'));
      await service.onModuleInit();
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('ensureDemoUser', () => {
    it('已有演示帐号：重置密码并保存', async () => {
      const { service, repos } = makeService();
      const existing = { id: 1, username: 'demo', tenantId: env.demoTenant, status: 1 };
      repos.user.findOne.mockResolvedValue(existing);
      const saved = await service.ensureDemoUser();
      expect(saved.username).toBe('demo');
      expect(repos.user.save).toHaveBeenCalled();
    });

    it('无演示帐号：创建固定用户名并保存', async () => {
      const { service, repos } = makeService();
      repos.user.findOne.mockResolvedValue(null);
      const saved = await service.ensureDemoUser();
      expect(saved).toEqual(
        expect.objectContaining({
          username: env.demoUsername,
          role: 'admin',
          tenantId: env.demoTenant,
        }),
      );
      expect(repos.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          username: env.demoUsername,
          role: 'admin',
          tenantId: env.demoTenant,
        }),
      );
      expect(repos.user.save).toHaveBeenCalledWith(
        expect.objectContaining({
          username: env.demoUsername,
          role: 'admin',
          tenantId: env.demoTenant,
        }),
      );
    });
  });

  describe('seedDemo', () => {
    it('演示账号已存在：仍确保用户但跳过业务种子', async () => {
      const { service, repos } = makeService();
      repos.user.findOne.mockResolvedValue({ id: 1, username: 'demo' });
      repos.account.findOne.mockResolvedValue({ id: 1 });
      await service.seedDemo();
      expect(repos.user.save).toHaveBeenCalled();
      expect(repos.account.save).not.toHaveBeenCalled();
      expect(repos.publish.save).not.toHaveBeenCalled();
    });

    it('全量种子：账号 5 / 选题 8 / 脚本 6 / 发布 8', async () => {
      const { service, repos } = makeService();
      repos.user.findOne.mockResolvedValue(null);
      repos.account.findOne.mockResolvedValue(null);
      await service.seedDemo();

      expect(repos.account.create).toHaveBeenCalled();
      const accounts = repos.account.save.mock.calls[0][0] as Array<{ platform: string }>;
      expect(accounts).toHaveLength(5);
      expect(accounts.map((a) => a.platform)).toEqual(
        expect.arrayContaining([
          'douyin',
          'kuaishou',
          'xiaohongshu',
          'bilibili',
          'wechat-channels',
        ]),
      );

      expect(repos.topic.save.mock.calls[0][0]).toHaveLength(8);
      expect(repos.script.save.mock.calls[0][0]).toHaveLength(6);
      expect(repos.publish.save.mock.calls[0][0]).toHaveLength(8);

      // 发布任务覆盖各状态与挂车转化漏斗字段
      const publishes = repos.publish.save.mock.calls[0][0] as Array<Record<string, unknown>>;
      expect(publishes.map((p) => p.status)).toEqual(
        expect.arrayContaining(['published', 'running', 'queued', 'failed', 'retry']),
      );
      const published = publishes.filter((p) => p.status === 'published');
      expect(published.every((p) => p.extPostId && p.cartProductId)).toBe(true);
    });
  });

  describe('clearDemoData', () => {
    it('汇总各表 affected 并返回总数', async () => {
      const { service, repos } = makeService();
      repos.publish.delete.mockResolvedValue({ affected: 3 });
      repos.script.delete.mockResolvedValue({ affected: 2 });
      repos.topic.delete.mockResolvedValue({ affected: 1 });
      repos.account.delete.mockResolvedValue({ affected: 0 });
      await expect(service.clearDemoData()).resolves.toBe(6);
      expect(logSpy).toHaveBeenCalledWith('[demo] 已清除演示数据 6 行（租户=t_demo）');
    });

    it('delete 返回 undefined 时按 0 计', async () => {
      const { service, repos } = makeService();
      repos.publish.delete.mockResolvedValue({ affected: undefined });
      repos.script.delete.mockResolvedValue({ affected: undefined });
      repos.topic.delete.mockResolvedValue({ affected: undefined });
      repos.account.delete.mockResolvedValue({ affected: undefined });
      await expect(service.clearDemoData()).resolves.toBe(0);
    });
  });

  describe('hasDemoData', () => {
    it('存在演示账号返回 true', async () => {
      const { service, repos } = makeService();
      repos.account.findOne.mockResolvedValue({ id: 1 });
      await expect(service.hasDemoData()).resolves.toBe(true);
    });

    it('不存在返回 false', async () => {
      const { service, repos } = makeService();
      repos.account.findOne.mockResolvedValue(null);
      await expect(service.hasDemoData()).resolves.toBe(false);
    });
  });
});
