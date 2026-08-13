import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TenantContext } from '../../tenant/tenant-context';

export interface DashboardStats {
  /** 账号�?*/
  accounts: number;
  /** 脚本�?*/
  scripts: number;
  /** 素材�?*/
  materials: number;
  /** 视频成片�?*/
  videos: number;
  /** 发布任务�?*/
  publishes: number;
  /** 选题�?*/
  topics: number;
  /** 情报�?*/
  intels: number;
}

@Injectable()
export class DashboardService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async getStats(): Promise<DashboardStats> {
    const tenantId = TenantContext.requireTenantId();
    const [accounts, scripts, materials, videos, publishes, topics, intels] = await Promise.all([
      this.count('ops_accounts', tenantId),
      this.count('ops_scripts', tenantId),
      this.count('ops_materials', tenantId),
      this.count('ops_videos', tenantId),
      this.count('ops_publish_tasks', tenantId),
      this.count('ops_topics', tenantId),
      this.count('ops_intels', tenantId),
    ]);
    return { accounts, scripts, materials, videos, publishes, topics, intels };
  }

  private async count(table: string, tenantId: string): Promise<number> {
    try {
      const rows = await this.ds.query<Array<{ cnt?: unknown }>>(
        `SELECT COUNT(*) as cnt FROM ${table} WHERE tenant_id = ?`,
        [tenantId],
      );
      return Number(rows[0]?.cnt ?? 0);
    } catch {
      // 表可能不存在（尚未初始化）
      return 0;
    }
  }
}