import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AdService } from './ad.service';
import { CreateAdAccountDto } from './dto/create-ad-account.dto';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { ReportMetricDto } from './dto/report-metric.dto';
import { SmartBidDto } from './dto/smart-bid.dto';
import { ok } from '../../shared/response';

@Controller('ops/ad')
export class AdController {
  constructor(private readonly ad: AdService) {}

  @Post('accounts')
  async createAccount(@Body() dto: CreateAdAccountDto) {
    return ok(await this.ad.createAccount(dto));
  }

  @Post('campaigns')
  async createCampaign(@Body() dto: CreateCampaignDto) {
    return ok(await this.ad.createCampaign(dto));
  }

  @Get('campaigns/:id/metrics')
  async getMetrics(@Param('id') id: string) {
    return ok(await this.ad.getMetrics(Number(id)));
  }

  @Post('campaigns/:id/smart-bid')
  async smartBid(@Param('id') id: string, @Body() dto: SmartBidDto) {
    return ok(await this.ad.smartBid({ ...dto, campaignId: Number(id) }));
  }

  @Get('campaigns/:id/review')
  async review(@Param('id') id: string) {
    return ok(await this.ad.review(Number(id)));
  }

  @Post('campaigns/:id/metrics')
  async reportMetric(@Param('id') id: string, @Body() dto: ReportMetricDto) {
    return ok(await this.ad.reportMetric({ ...dto, campaignId: Number(id) }));
  }
}
