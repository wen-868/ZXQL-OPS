import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { TypeOrmModule, InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { env } from '../config/env';
import { TenantSubscriber } from '../tenant/tenant.subscriber';

/**
 * 数据库模块（对齐管理系统 ai-base 的 TypeOrmModule 用法）。
 * MySQL + TypeORM；autoLoadEntities=true，业务模块用 TypeOrmModule.forFeature 注册实体。
 * 开发环境自动 synchronize（生产请关闭，改用迁移）。
 * 连池参数取自 env（DB_CONNECTION_LIMIT 等），与健康检查/超时一致。
 *
 * 稳健性（生产级）：
 * - 启动期连接重试 + 退避（retryAttempts / retryDelay），容忍 DB 晚于应用就绪（如 docker-compose）。
 * - 初次握手超时收紧为 DB_CONNECT_TIMEOUT（默认 5s），缺库时按退避重试后快速失败，
 *   不再出现 60s 静默挂起、端口不监听、日志为空的情况。
 * - onModuleInit 显式探针（SELECT 1）并输出明确日志；连不上时抛错交由 bootstrap 快速退出。
 */
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: env.DB_HOST,
      port: env.DB_PORT,
      username: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
      charset: 'utf8mb4',
      timezone: 'local',
      synchronize: env.NODE_ENV !== 'production',
      autoLoadEntities: true,
      logging: false,
      // 启动期连接重试与退避
      retryAttempts: env.DB_RETRY_ATTEMPTS,
      retryDelay: env.DB_RETRY_DELAY,
      // mysql2 连接池配置（对齐管理系统的连接治理）
      extra: {
        connectionLimit: env.DB_CONNECTION_LIMIT,
        maxIdle: env.DB_MAX_IDLE,
        idleTimeout: env.DB_IDLE_TIMEOUT,
        queueLimit: env.DB_QUEUE_LIMIT,
        // 获取连接的最长等待时间，避免长时间阻塞请求线程
        waitForConnections: true,
        // 初次握手超时（短）：与启动期快速失败配合，避免 60s 静默挂起
        connectTimeout: env.DB_CONNECT_TIMEOUT,
        charset: 'utf8mb4',
      },
      // 租户强隔离订阅器（写入期自动注入 tenantId + 禁止跨租户更新）
      subscribers: [TenantSubscriber],
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule implements OnModuleInit {
  private readonly logger = new Logger(DatabaseModule.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.dataSource.query('SELECT 1');
      this.logger.log(
        `数据库已连接: ${env.DB_NAME} @ ${env.DB_HOST}:${env.DB_PORT} (user=${env.DB_USER})`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `数据库启动探测失败: ${env.DB_NAME} @ ${env.DB_HOST}:${env.DB_PORT} — ${message}`,
      );
      throw err;
    }
  }
}
