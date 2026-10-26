/**
 * 健康检查端点
 * 提供系统运行状况的实时接口，用于负载均衡器探活和监控系统
 */

import { errMessage } from '../../playwright/err-msg';
import { readFileSync } from 'fs';
import { join } from 'path';

export enum HealthStatus {
  Healthy = 'healthy',
  Degraded = 'degraded', // 功能受损，但仍可运行
  Unhealthy = 'unhealthy', // 不可用
  Starting = 'starting', // 启动中
}

export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: number;
  version: string;
  checks: HealthCheck[];
  overallResponseTime: number;
}

export interface HealthCheck {
  name: string;
  status: HealthStatus;
  message?: string;
  details?: unknown;
  duration: number;
}

export class HealthChecker {
  private checks: Map<string, () => Promise<HealthCheck>> = new Map();
  private startTime = Date.now();
  private version: string;

  constructor() {
    // 版本号与 package.json 对齐（监控/告警展示用）
    try {
      const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8')) as {
        version?: string;
      };
      this.version = pkg.version || '1.0.0';
    } catch {
      this.version = '1.0.0';
    }
  }

  /**
   * 注册健康检查
   */
  registerCheck(name: string, check: () => Promise<HealthCheck>): void {
    this.checks.set(name, check);
  }

  /**
   * 移除健康检查
   */
  unregisterCheck(name: string): void {
    this.checks.delete(name);
  }

  /**
   * 执行全部健康检查
   */
  async checkAll(): Promise<HealthCheckResult> {
    const checkStartTime = Date.now();
    const results: HealthCheck[] = [];

    for (const [name, check] of this.checks) {
      const singleStartTime = Date.now();
      try {
        const result = await check();
        // 单检查耗时应反映本检查自身开销，而非累计到该检查时的整体耗时
        result.duration = result.duration || Date.now() - singleStartTime;
        results.push(result);
      } catch (error: unknown) {
        results.push({
          name,
          status: HealthStatus.Unhealthy,
          message: errMessage(error),
          duration: Date.now() - singleStartTime,
        });
      }
    }

    // 确定整体状态
    const anyUnhealthy = results.some((check) => check.status === HealthStatus.Unhealthy);

    let status: HealthStatus;
    if (anyUnhealthy) {
      status = HealthStatus.Unhealthy;
    } else if (results.some((check) => check.status === HealthStatus.Degraded)) {
      status = HealthStatus.Degraded;
    } else {
      status = HealthStatus.Healthy;
    }

    return {
      status,
      timestamp: Date.now(),
      version: this.version,
      checks: results,
      overallResponseTime: Date.now() - checkStartTime,
    };
  }

  /**
   * 获取系统启动时长
   */
  getUptime(): number {
    return Date.now() - this.startTime;
  }
}
