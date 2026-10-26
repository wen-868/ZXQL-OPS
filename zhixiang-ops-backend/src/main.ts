import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/response.interceptor';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { env } from './config/env';
import { ensureEmbeddedMysql, stopEmbeddedMysql } from './database/embedded-mysql';
import { runSqlMigrations } from './database/run-migrations';

async function bootstrap(): Promise<void> {
  console.log(
    `[bootstrap] 正在初始化（env=${env.NODE_ENV}），连接 DB(${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}) 与 Redis(${env.REDIS_HOST}:${env.REDIS_PORT})...`,
  );

  // 内嵌 MySQL：托管拉起自带数据库（须在 NestFactory.create 之前，TypeORM 于应用初始化期建连）
  await ensureEmbeddedMysql({
    mode: (env.OPS_EMBEDDED_MYSQL as 'auto' | 'true' | 'false') || 'auto',
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    rootDir: process.cwd(),
    home: env.OPS_MYSQL_HOME || undefined,
    dataDir: env.OPS_MYSQL_DATA_DIR || undefined,
    stopOnExit: env.OPS_MYSQL_STOP_ON_EXIT,
  });

  // 启动期迁移：内嵌库/本地打包运行即建表（开启时 database.module 自动关闭 synchronize）
  if (env.OPS_DB_MIGRATIONS_RUN) {
    await runSqlMigrations({
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
    });
  }

  // rawBody: 保留请求原始字节，供管理系统 Webhook 回调 HMAC 签名校验（方案 §18-⑦）
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  // 静态资源：上传文件公开访问（开发环境由 NestJS 直接托管，生产由 Nginx/OSS 反代）
  const uploadDir = env.OPS_UPLOAD_DIR || join(process.cwd(), 'uploads');
  app.useStaticAssets(uploadDir, { prefix: '/uploads' });

  // 全局前缀（与管理系统的 /api 标准对齐）
  app.setGlobalPrefix('api');

  // DTO 校验（class-validator / class-transformer）
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // 统一响应信封 + 全局异常过滤器
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  // 安全头（CSP/HSTS/XSS 防护等）
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  // 跨域（对齐管理系统的 allowedOrigins 逻辑）
  // 安全收敛：CORS_ORIGINS 为空时，开发环境放行（同源 dev server），
  // 生产环境拒绝「origin: true + credentials: true」的组合（等价于对任意站点开放带凭据访问）。
  const origins = env.CORS_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (origins.length > 0) {
    app.enableCors({ origin: origins, credentials: true });
  } else if (env.NODE_ENV === 'production') {
    app.enableCors({ origin: false, credentials: false });
    Logger.warn(
      '[bootstrap] 生产环境未配置 CORS_ORIGINS，已禁用跨域（如需请显式配置）',
      'Bootstrap',
    );
  } else {
    app.enableCors({ origin: true, credentials: true });
  }

  // OpenAPI 文档（A7 基座）：仅开发环境暴露，生产关闭避免接口面泄露
  if (env.NODE_ENV !== 'production') {
    const { SwaggerModule, DocumentBuilder } = await import('@nestjs/swagger');
    const config = new DocumentBuilder()
      .setTitle('智享全链运营系统 API')
      .setDescription('ZXQL-OPS 运营系统公共接口文档（A7 基座；全量标注进行中）')
      .setVersion('0.2.0')
      .addBearerAuth()
      .build();
    const doc = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, doc);
    Logger.log('[bootstrap] OpenAPI 文档: http://localhost:' + env.PORT + '/api/docs');
  }

  const port = env.PORT;
  await app.listen(port);
  Logger.log(
    `智享全链运营系统已启动: http://localhost:${port}/api (env=${env.NODE_ENV})`,
    'Bootstrap',
  );

  // 打包本地运行：随应用退出停止内嵌数据库（OPS_MYSQL_STOP_ON_EXIT=true）
  const shutdown = async (signal: string) => {
    Logger.log(`收到 ${signal}，正在退出...`, 'Bootstrap');
    await stopEmbeddedMysql();
    process.exit(0);
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error('[bootstrap] 启动失败，进程退出：');
  console.error(`  ${message}`);
  console.error(
    '  排查建议：确认 MySQL(MariaDB) 与 Redis 已启动，且 .env 中 DB_*/REDIS_* 配置正确。',
  );
  process.exit(1);
});
