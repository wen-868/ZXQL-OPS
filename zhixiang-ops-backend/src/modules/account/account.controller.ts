import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Public } from '../../auth/public.decorator';
import { AccountService } from './account.service';
import { AccountOAuthService } from './oauth/account-oauth.service';
import { OAuthCallbackQueryDto, OAuthStartDto } from './oauth/dto/oauth.dto';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { AccountQueryDto } from './dto/account-query.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ConfigureAccountEnvDto } from './dto/configure-account-env.dto';
import { CreateAccountGroupDto } from './dto/create-account-group.dto';

/**
 * 账号矩阵控制器（规划 §4-B / B-core）。
 * 路由前缀 ops/accounts（全局前缀 api → /api/ops/accounts）。
 * 租户隔离由服务层 TenantContext.requireTenantId() 强约束；
 * 鉴权守卫（@UseGuards(JwtAuthGuard)）待登录体系（auth 模块）就绪后统一加装。
 *
 * 注意：/health/summary 必须在 /:id 之前声明，避免被 :id 路由捕获。
 */
@Controller('ops/accounts')
export class AccountController {
  constructor(
    private readonly accountService: AccountService,
    private readonly oauthService: AccountOAuthService,
  ) {}

  @Post()
  create(@Body() dto: CreateAccountDto) {
    return this.accountService.create(dto);
  }

  @Get()
  list(@Query() query: AccountQueryDto) {
    return this.accountService.findAll(query);
  }

  @Get('health/summary')
  healthSummary() {
    return this.accountService.healthSummary();
  }

  @Get('risk')
  riskLogs(@Query('accountId') accountId?: string) {
    return this.accountService.getRiskLogs(accountId ? Number(accountId) : undefined);
  }

  @Post('risk/evaluate')
  evaluateAntiAssociate() {
    return this.accountService.evaluateAntiAssociate();
  }

  @Get('matrix/advanced')
  advancedMatrix() {
    return this.accountService.advancedMatrix();
  }

  @Get('matrix')
  matrix() {
    return this.accountService.matrix();
  }

  @Post('account-groups')
  createGroup(@Body() dto: CreateAccountGroupDto) {
    return this.accountService.createGroup(dto);
  }

  @Get('account-groups')
  listGroups() {
    return this.accountService.listGroups();
  }

  @Get('account-groups/:id/accounts')
  listGroupAccounts(@Param('id') id: string) {
    return this.accountService.listGroupAccounts(Number(id));
  }

  @Delete('account-groups/:id')
  removeGroup(@Param('id') id: string) {
    return this.accountService.removeGroup(Number(id));
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.accountService.findOne(Number(id));
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAccountDto) {
    return this.accountService.update(Number(id), dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.accountService.remove(Number(id));
  }

  @Post(':id/refresh-token')
  refreshToken(@Param('id') id: string, @Body() dto: RefreshTokenDto) {
    return this.accountService.refreshToken(Number(id), dto);
  }

  @Post(':id/env')
  configureEnv(@Param('id') id: string, @Body() dto: ConfigureAccountEnvDto) {
    return this.accountService.configureEnv(Number(id), dto);
  }

  @Post('oauth/start')
  oauthStart(@Body() dto: OAuthStartDto) {
    return this.oauthService.start(dto);
  }

  @Get('oauth/callback')
  @Public()
  oauthCallback(@Query() query: OAuthCallbackQueryDto) {
    return this.oauthService.callback(query);
  }
}
