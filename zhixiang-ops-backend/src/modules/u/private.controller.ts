import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PrivateService } from './private.service';
import { UpsertFansDto } from './dto/upsert-fans.dto';
import { TagFansDto } from './dto/tag-fans.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { DistributeDto } from './dto/distribute.dto';
import { RepurchaseDto } from './dto/repurchase.dto';
import { ok } from '../../shared/response';

@Controller('ops')
export class PrivateController {
  constructor(private readonly privateService: PrivateService) {}

  @Post('fans')
  async upsertFans(@Body() dto: UpsertFansDto) {
    return ok(await this.privateService.upsertFans(dto));
  }

  @Get('fans')
  async listFans(@Query('platform') platform?: string) {
    return ok(await this.privateService.listFans(platform));
  }

  @Post('fans/tags')
  async tagFans(@Body() dto: TagFansDto) {
    return ok(await this.privateService.tagFans(dto));
  }

  @Post('private-groups')
  async createGroup(@Body() dto: CreateGroupDto) {
    return ok(await this.privateService.createGroup(dto));
  }

  @Post('private-groups/:id/push')
  async pushGroup(@Param('id') id: string) {
    return ok(await this.privateService.pushGroup(Number(id)));
  }

  @Post('fans/distribute')
  async distribute(@Body() dto: DistributeDto) {
    return ok(await this.privateService.distribute(dto));
  }

  @Post('fans/repurchase')
  async repurchase(@Body() dto: RepurchaseDto) {
    return ok(await this.privateService.repurchase(dto));
  }
}
