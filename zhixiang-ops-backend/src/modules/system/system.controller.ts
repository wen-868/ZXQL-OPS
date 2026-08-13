import { Body, Controller, Get, Post } from '@nestjs/common';
import { Public } from '../../auth/public.decorator';
import { SystemService } from './system.service';
import { InitDeployDto, SeedDataDto } from './system.dto';

/** 系统初始化（设置 → 系统初始化）。路由前缀 api/ops/system */
@Controller('ops/system')
export class SystemController {
  constructor(private readonly svc: SystemService) {}

  /** 系统状态（公开，供登录页在未登录时判断演示模式） */
  @Public()
  @Get('status')
  status() {
    return this.svc.getStatus();
  }

  /** 首次部署引导（幂等） */
  @Post('init')
  init(@Body() dto: InitDeployDto) {
    return this.svc.initDeploy(dto);
  }

  /** 运行期基线数据初始化（幂等，可重复） */
  @Post('seed')
  seed(@Body() dto: SeedDataDto) {
    return this.svc.seedData(dto);
  }
}
