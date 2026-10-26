import { Controller, Post, Get, Body, UseGuards, Headers, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Public } from './public.decorator';
import { CsrfExempt } from './csrf-exempt.decorator';
import { CurrentUser } from './current-user.decorator';
import { AuthUser } from './auth-user';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('auth')
@Controller('ops/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** 登录：获取 JWT token + CSRF 令牌 */
  @Public()
  @CsrfExempt() // 预认证端点：签发令牌前无法携带 CSRF，直接豁免
  @Post('login')
  @ApiOperation({ summary: '登录：获取 JWT token + CSRF 令牌 */' })
  login(@Req() req: Request, @Body() dto: LoginDto) {
    return this.authService.login(dto, req.ip);
  }

  /** 注册：创建账号（独立模式开放注册） */
  @Public()
  @CsrfExempt()
  @Post('register')
  @ApiOperation({ summary: '注册：创建账号（独立模式开放注册） */' })
  register(@Req() req: Request, @Body() dto: RegisterDto) {
    return this.authService.register(dto, req.ip);
  }

  /** SSO：用管理系统 JWT 换取运营 JWT（对接方案 §4.2，仅接受 zhixiang-system 签发） */
  @Public()
  @CsrfExempt()
  @Post('sso')
  @ApiOperation({
    summary: 'SSO：用管理系统 JWT 换取运营 JWT（对接方案 §4.2，仅接受 zhixiang-system 签发） */',
  })
  sso(
    @Req() req: Request,
    @Headers('authorization') authorization?: string,
    @Headers('x-tenant-id') tenantHeader?: string,
  ) {
    return this.authService.sso(authorization, tenantHeader, req.ip);
  }

  /** 演示登录：免密进入演示环境（仅 OPS_DEMO_MODE=true 时可用） */
  @Public()
  @CsrfExempt()
  @Post('demo-login')
  @ApiOperation({ summary: '演示登录：免密进入演示环境（仅 OPS_DEMO_MODE=true 时可用） */' })
  demoLogin(@Req() req: Request) {
    return this.authService.demoLogin(req.ip);
  }

  /** 获取当前登录用户信息 */
  @Get('me')
  @ApiOperation({ summary: '获取当前登录用户信息 */' })
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.authService.getProfile(user.id);
  }

  /** 为已登录用户签发/刷新 CSRF 令牌（覆盖门户 SSO 透传登录等无登录响应的场景） */
  @Get('csrf-token')
  @ApiOperation({
    summary: '为已登录用户签发/刷新 CSRF 令牌（覆盖门户 SSO 透传登录等无登录响应的场景） */',
  })
  @UseGuards(JwtAuthGuard)
  csrfToken(@CurrentUser() user: AuthUser) {
    return { csrfToken: this.authService.issueCsrf(user.id, user.tenantId) };
  }
}
