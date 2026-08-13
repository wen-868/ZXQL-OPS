import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TenantContext } from '../../tenant/tenant-context';
import { generateAttributionId } from '../../core';
import { RedisService } from '../../cache/redis.service';
import { Public } from '../../auth/public.decorator';

/**
 * 健康检查。返回给前端时由 ResponseInterceptor 自动包成
 * { code:"0", msg:"成功", data:{...}, traceId:"..." }。
 * traceId 与日志、异常过滤器同源，可用于全链路追踪验证。
 *
 * 默认端点真实探测 DB / Redis 依赖并返回各自状态，便于探针与告警区分
 * 「服务起来了但依赖挂了」与「服务本身挂了」。探测失败不抛异常（保持端点可用）。
 */
@Controller('ops/health')
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get()
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
  strict(): Record<string, unknown> {
    const tenantId = TenantContext.requireTenantId();
    return { tenantId };
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
