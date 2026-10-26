import { HealthController } from './health.controller';
import { HealthChecker } from './health-checker';
import { TenantContext } from '../../tenant/tenant-context';
import { AppError } from '../../shared/app-error';
import { DataSource } from 'typeorm';

describe('HealthController', () => {
  const mockDataSource = {
    query: jest.fn().mockResolvedValue([{ '1': 1 }]),
  } as unknown as DataSource;
  const mockRedis = { client: { ping: jest.fn().mockResolvedValue('PONG') } } as any;
  const mockHealthChecker = new HealthChecker();
  const mockBrowserGateway = {
    getStatus: jest.fn().mockReturnValue({
      ready: true,
      circuitBreakerState: 'closed',
      poolStats: { totalInstances: 0 },
      poolMax: 5,
      tenantId: undefined,
    }),
  } as any;
  const controller = new HealthController(
    mockDataSource,
    mockRedis,
    mockHealthChecker,
    mockBrowserGateway,
  );

  it('check() 探活 DB/Redis 并返回健康结构（无租户上下文）', async () => {
    const r = await TenantContext.run({ traceId: 't-health' }, () => controller.check());
    expect(r.service).toBe('zhixiang-ops');
    expect(r.ok).toBe(true);
    expect(typeof r.timestamp).toBe('string');
    expect(r.tenantId).toBeNull();
    expect(r.sampleAttribution).toBeNull();
    expect((r as any).dependencies.mysql.ok).toBe(true);
    expect((r as any).dependencies.redis.ok).toBe(true);
  });

  it('check() 带租户时生成 sampleAttribution（attribution_id 透传演示）', async () => {
    const r = await TenantContext.run({ traceId: 't2', tenantId: 'tn-demo' }, () =>
      controller.check(),
    );
    expect(r.tenantId).toBe('tn-demo');
    expect(r.sampleAttribution).toMatch(/^attr_tn-demo_content_[0-9a-f]{32}$/);
  });

  it('strict() 无租户抛 TENANT_REQUIRED', () => {
    expect(() => TenantContext.run({ traceId: 't3' }, () => controller.strict())).toThrow(AppError);
  });

  it('strict() 有租户返回 tenantId', () => {
    const r = TenantContext.run({ traceId: 't4', tenantId: 'tn-strict' }, () =>
      controller.strict(),
    );
    expect(r.tenantId).toBe('tn-strict');
  });

  it('deep() 返回全量检查结果（mysql/redis/browser-pool）', async () => {
    const r = await controller.deep();
    expect(r.service).toBe('zhixiang-ops');
    expect(r.status).toBe('healthy');
    const checks = (r as any).checks.map((c: any) => c.name);
    expect(checks).toEqual(expect.arrayContaining(['mysql', 'redis', 'browser-pool']));
    expect(typeof r.uptimeMs).toBe('number');
    expect(typeof r.version).toBe('string');
  });
});
