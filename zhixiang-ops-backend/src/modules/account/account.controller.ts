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
import { ApiOperation, ApiTags } from '@nestjs/swagger';

/**
 * 账号矩阵控制器（规划 §4-B / B-core）。
 * 路由前缀 ops/accounts（全局前缀 api → /api/ops/accounts）。
 * 租户隔离由服务层 TenantContext.requireTenantId() 强约束；
 * 鉴权守卫（@UseGuards(JwtAuthGuard)）待登录体系（auth 模块）就绪后统一加装。
 *
 * 注意：/health/summary 必须在 /:id 之前声明，避免被 :id 路由捕获。
 */
@ApiTags('accounts')
@Controller('ops/accounts')
export class AccountController {
  constructor(
    private readonly accountService: AccountService,
    private readonly oauthService: AccountOAuthService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'POST create' })
  create(@Body() dto: CreateAccountDto) {
    return this.accountService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'GET list' })
  list(@Query() query: AccountQueryDto) {
    return this.accountService.findAll(query);
  }

  @Get('health/summary')
  @ApiOperation({ summary: 'GET healthSummary' })
  healthSummary() {
    return this.accountService.healthSummary();
  }

  @Get('risk')
  @ApiOperation({ summary: 'GET riskLogs' })
  riskLogs(@Query('accountId') accountId?: string) {
    return this.accountService.getRiskLogs(accountId ? Number(accountId) : undefined);
  }

  @Post('risk/evaluate')
  @ApiOperation({ summary: 'POST evaluateAntiAssociate' })
  evaluateAntiAssociate() {
    return this.accountService.evaluateAntiAssociate();
  }

  @Get('matrix/advanced')
  @ApiOperation({ summary: 'GET advancedMatrix' })
  advancedMatrix() {
    return this.accountService.advancedMatrix();
  }

  @Get('matrix')
  @ApiOperation({ summary: 'GET matrix' })
  matrix() {
    return this.accountService.matrix();
  }

  @Post('account-groups')
  @ApiOperation({ summary: 'POST createGroup' })
  createGroup(@Body() dto: CreateAccountGroupDto) {
    return this.accountService.createGroup(dto);
  }

  @Get('account-groups')
  @ApiOperation({ summary: 'GET listGroups' })
  listGroups() {
    return this.accountService.listGroups();
  }

  @Get('account-groups/:id/accounts')
  @ApiOperation({ summary: 'GET listGroupAccounts' })
  listGroupAccounts(@Param('id') id: string) {
    return this.accountService.listGroupAccounts(Number(id));
  }

  @Delete('account-groups/:id')
  @ApiOperation({ summary: 'DELETE removeGroup' })
  removeGroup(@Param('id') id: string) {
    return this.accountService.removeGroup(Number(id));
  }

  @Get(':id')
  @ApiOperation({ summary: 'GET detail' })
  detail(@Param('id') id: string) {
    return this.accountService.findOne(Number(id));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'PATCH update' })
  update(@Param('id') id: string, @Body() dto: UpdateAccountDto) {
    return this.accountService.update(Number(id), dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'DELETE remove' })
  remove(@Param('id') id: string) {
    return this.accountService.remove(Number(id));
  }

  @Post(':id/refresh-token')
  @ApiOperation({ summary: 'POST refreshToken' })
  refreshToken(@Param('id') id: string, @Body() dto: RefreshTokenDto) {
    return this.accountService.refreshToken(Number(id), dto);
  }

  @Post(':id/env')
  @ApiOperation({ summary: 'POST configureEnv' })
  configureEnv(@Param('id') id: string, @Body() dto: ConfigureAccountEnvDto) {
    return this.accountService.configureEnv(Number(id), dto);
  }

  @Post('oauth/start')
  @ApiOperation({ summary: 'POST oauthStart' })
  oauthStart(@Body() dto: OAuthStartDto) {
    return this.oauthService.start(dto);
  }

  @Get('oauth/callback')
  @ApiOperation({ summary: 'GET 接口' })
  @Public()
  oauthCallback(@Query() query: OAuthCallbackQueryDto) {
    return this.oauthService.callback(query);
  }
}
