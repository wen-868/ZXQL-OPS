import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { CsrfGuard } from './csrf.guard';
import { User } from './user.entity';
import { RoleBind } from '../integration/role-bind.entity';
import { TenantBind } from '../integration/tenant-bind.entity';
import { DemoModule } from '../modules/system/demo.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, RoleBind, TenantBind]), DemoModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAuthGuard,
    /** 全局 JWT 鉴权：所有接口默认需登录（@Public() 可豁免） */
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    /** 全局角色守卫：@Roles(...) 限定角色，未标注仅需登录 */
    { provide: APP_GUARD, useClass: RolesGuard },
    /** 全局 CSRF 守卫：写请求校验 x-csrf-token（@CsrfExempt() 豁免；GET 直放） */
    { provide: APP_GUARD, useClass: CsrfGuard },
  ],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
