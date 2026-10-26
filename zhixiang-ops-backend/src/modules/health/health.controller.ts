import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TenantContext } from '../../tenant/tenant-context';
import { generateAttributionId } from '../../core';
import { RedisService } from '../../cache/redis.service';
import { errMessage } from '../../playwright/err-msg';
import { Public } from '../../auth/public.decorator';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthChecker, HealthCheck, HealthStatus } from './health-checker';
import { BrowserGateway } from '../../playwright/BrowserGateway';

/**
 * 健康检查。返回给前端时由 ResponseInterceptor 自动包成
 * { code:"0", msg:"成功", data:{...}, traceId:"..." }。
 * traceId 与日志、异常过滤器同源，可用于全链路追踪验证。
 *
 * 默认端点真实探测 DB / Redis 依赖并返回各自状态，便于探针与告警区分
 * 「服务起来了但依赖挂了」与「服务本身挂了」。探测失败不抛异常（保持端点可用）。
 * /deep 端点走 HealthChecker 注册式全量检查（含浏览器池/熔断状态），供监控系统调用。
 */
@ApiTags('health')
@Controller('ops/health')
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly redis: RedisService,
    private readonly healthChecker: HealthChecker,
    private readonly browserGateway: BrowserGateway,
  ) {
    // 注册深度检查项（controller 为单例，仅注册一次）
    this.healthChecker.registerCheck('mysql', () =>
      this.probeAsCheck('mysql', async () => {
        await this.dataSource.query('SELECT 1');
      }),
    );
    this.healthChecker.registerCheck('redis', () =>
      this.probeAsCheck('redis', async () => {
        const pong = await this.redis.client.ping();
        if (pong !== 'PONG') throw new Error('redis ping failed');
      }),
    );
    this.healthChecker.registerCheck('browser-pool', () =>
      this.probeAsCheck('browser-pool', async () => {
        const gw = this.browserGateway.getStatus();
        // 熔断打开视为降级（在 probeAsCheck 中标记），此处仅暴露关键字段
        if (gw.circuitBreakerState === 'open') {
          // degraded 标记供 probeAsCheck 区分「降级」与「不可用」
          const err = new Error('browser circuit breaker open') as Error & { degraded?: boolean };
          err.degraded = true;
          throw err;
        }
      }),
    );
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'GET check' })
  async check(): Promise<Record<string, unknown>> {
    const [mysql, redisState] = await Promise.all([this.probeMysql(), this.probeRedis()]);
    const tenantId = TenantContext.getTenantId();
    return {
      service: 'zhixiang-ops',
      ok: mysql.ok && redisState.ok,
      timestamp: new Date().toISOString(),
      traceId: TenantContext.getTraceId() ?? null,
      tenantId: tenantId ?? null,
      sampleAttribution: tenantId ? generateAttributionId(tenantId, 'content', 'demo-seed') : null,
      dependencies: { mysql, redis: redisState },
    };
  }

  /** 演示租户强制读取：未带租户标识时抛 TENANT_REQUIRED（由全局过滤器包成信封） */
  @Get('strict')
  @ApiOperation({
    summary: '演示租户强制读取：未带租户标识时抛 TENANT_REQUIRED（由全局过滤器包成信封） */',
  })
  strict(): Record<string, unknown> {
    const tenantId = TenantContext.requireTenantId();
    return { tenantId };
  }

  /** 深度健康检查：注册式全量检查（MySQL/Redis/浏览器池），含版本与启动时长 */
  @Public()
  @Get('deep')
  @ApiOperation({ summary: '深度健康检查（MySQL/Redis/浏览器池全量探测）' })
  async deep(): Promise<Record<string, unknown>> {
    const result = await this.healthChecker.checkAll();
    return {
      service: 'zhixiang-ops',
      ...result,
      uptimeMs: this.healthChecker.getUptime(),
      traceId: TenantContext.getTraceId() ?? null,
    };
  }

  /** 把探针函数包装为 HealthCheck 结果（异常不外抛） */
  private async probeAsCheck(name: string, probe: () => Promise<void>): Promise<HealthCheck> {
    const start = Date.now();
    try {
      await probe();
      return {
        name,
        status: HealthStatus.Healthy,
        duration: Date.now() - start,
      };
    } catch (err: unknown) {
      return {
        name,
        status: (err as Error & { degraded?: boolean })?.degraded
          ? HealthStatus.Degraded
          : HealthStatus.Unhealthy,
        message: errMessage(err),
        duration: Date.now() - start,
      };
    }
  }

  private async probeMysql(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
    const start = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
      return { ok: true, latencyMs: Date.now() - start };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private async probeRedis(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
    const start = Date.now();
    try {
      const pong = await this.redis.client.ping();
      return { ok: pong === 'PONG', latencyMs: Date.now() - start };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
