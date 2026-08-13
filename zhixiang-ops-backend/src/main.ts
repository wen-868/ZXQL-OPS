import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/response.interceptor';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { env } from './config/env';

async function bootstrap(): Promise<void> {
  console.log(
    `[bootstrap] 正在初始化（env=${env.NODE_ENV}），连接 DB(${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}) 与 Redis(${env.REDIS_HOST}:${env.REDIS_PORT})...`,
  );
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
  const allowedOrigins = env.CORS_ORIGINS ? env.CORS_ORIGINS.split(',').map((s) => s.trim()) : true;
  app.enableCors({ origin: allowedOrigins, credentials: true });

  const port = env.PORT;
  await app.listen(port);
  Logger.log(
    `智享全链运营系统已启动: http://localhost:${port}/api (env=${env.NODE_ENV})`,
    'Bootstrap',
  );
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
