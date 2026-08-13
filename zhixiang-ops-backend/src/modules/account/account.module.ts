import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountService } from './account.service';
import { AccountOAuthService } from './oauth/account-oauth.service';
import { AccountController } from './account.controller';
import { AccountEntity } from './account.entity';
import { AccountGroupEntity } from './account-group.entity';
import { AccountHealthEventEntity } from './account-health-event.entity';
import { AccountEnvEntity } from './account-env.entity';
import { AccountRiskLogEntity } from './account-risk-log.entity';
import { AccountOAuthStateEntity } from './oauth/oauth-state.entity';
import { SystemConfigModule } from '../system-config/system-config.module';

/**
 * 账号矩阵模块（规划 §4-B / B-core）。
 * 注册实体到 TypeORM，暴露 AccountService 供后续模块（C 采集 / I 发布 等）注入复用。
 * OAuth 凭证经系统配置中心读取（客户自决），未配置自动 Sandbox 演示链路。
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      AccountEntity,
      AccountGroupEntity,
      AccountHealthEventEntity,
      AccountEnvEntity,
      AccountRiskLogEntity,
      AccountOAuthStateEntity,
    ]),
    SystemConfigModule,
  ],
  controllers: [AccountController],
  providers: [AccountService, AccountOAuthService],
  exports: [AccountService],
})
export class AccountModule {}
