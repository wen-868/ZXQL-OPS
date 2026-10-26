import { MODULE_METADATA } from '@nestjs/common/constants';
import { AppModule } from './app.module';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './cache/redis.module';
import { TenantModule } from './tenant/tenant.module';
import { AuthModule } from './auth/auth.module';
import { VideoAutomationModule } from './modules/video-automation/video-automation.module';
import { EcommerceModule } from './modules/ecommerce/ecommerce.module';

/**
 * 应用根模块装配测试（轻量元数据校验）。
 * 仅反射 @Module 元数据，不创建 Nest 容器，避免触达真实 DB / Redis 连接。
 */
describe('AppModule（根模块装配）', () => {
  it('注册全部导入模块（≥40 个）', () => {
    const imports: unknown[] = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule) ?? [];
    expect(imports.length).toBeGreaterThanOrEqual(40);
  });

  it('包含基建与核心业务模块', () => {
    const imports: unknown[] = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule) ?? [];
    expect(imports).toEqual(
      expect.arrayContaining([
        DatabaseModule,
        RedisModule,
        TenantModule,
        AuthModule,
        VideoAutomationModule,
        EcommerceModule,
      ]),
    );
  });
});
