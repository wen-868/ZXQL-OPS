import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AdService } from './ad.service';
import { CreateAdAccountDto } from './dto/create-ad-account.dto';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { ReportMetricDto } from './dto/report-metric.dto';
import { SmartBidDto } from './dto/smart-bid.dto';
import { ok } from '../../shared/response';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('ad')
@Controller('ops/ad')
export class AdController {
  constructor(private readonly ad: AdService) {}

  @Post('accounts')
  @ApiOperation({ summary: 'POST createAccount' })
  async createAccount(@Body() dto: CreateAdAccountDto) {
    return ok(await this.ad.createAccount(dto));
  }

  @Post('campaigns')
  @ApiOperation({ summary: 'POST createCampaign' })
  async createCampaign(@Body() dto: CreateCampaignDto) {
    return ok(await this.ad.createCampaign(dto));
  }

  @Get('campaigns/:id/metrics')
  @ApiOperation({ summary: 'GET getMetrics' })
  async getMetrics(@Param('id') id: string) {
    return ok(await this.ad.getMetrics(Number(id)));
  }

  @Post('campaigns/:id/smart-bid')
  @ApiOperation({ summary: 'POST smartBid' })
  async smartBid(@Param('id') id: string, @Body() dto: SmartBidDto) {
    return ok(await this.ad.smartBid({ ...dto, campaignId: Number(id) }));
  }

  @Get('campaigns/:id/review')
  @ApiOperation({ summary: 'GET review' })
  async review(@Param('id') id: string) {
    return ok(await this.ad.review(Number(id)));
  }

  @Post('campaigns/:id/metrics')
  @ApiOperation({ summary: 'POST reportMetric' })
  async reportMetric(@Param('id') id: string, @Body() dto: ReportMetricDto) {
    return ok(await this.ad.reportMetric({ ...dto, campaignId: Number(id) }));
  }
}
