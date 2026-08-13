import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ok } from '../../shared/response';
import { CustomerService } from './aa.service';
import {
  CreateSessionDto,
  UserMessageDto,
  TransferDto,
  CreateKnowledgeDto,
  UpdateKnowledgeDto,
  UpsertSettingsDto,
  ListSessionDto,
  ListTicketDto,
} from './dto';
import type { KnowledgeCategory } from './knowledge.entity';

@Controller('ops')
export class CustomerController {
  constructor(private customerService: CustomerService) {}

  /** 创建/复用客服会话（多渠道接入） */
  @Post('cs/sessions')
  async createSession(@Body() dto: CreateSessionDto) {
    return ok(await this.customerService.createSession(dto));
  }

  /** 会话列表（按 channel/status 过滤） */
  @Get('cs/sessions')
  async listSessions(@Query() q: ListSessionDto) {
    return ok(await this.customerService.listSessions(q));
  }

  /** 会话详情（含消息） */
  @Get('cs/sessions/:id')
  async getSession(@Param('id') id: string) {
    return ok(await this.customerService.getSession(Number(id)));
  }

  /** 用户消息 + AI 自动回复 */
  @Post('cs/sessions/:id/messages')
  async sendMessage(@Param('id') id: string, @Body() dto: UserMessageDto) {
    return ok(await this.customerService.sendMessage(Number(id), dto));
  }

  /** 显式转人工 */
  @Post('cs/sessions/:id/transfer')
  async transfer(@Param('id') id: string, @Body() dto: TransferDto) {
    return ok(await this.customerService.transfer(Number(id), dto));
  }

  /** 工单列表（按 status/priority 过滤） */
  @Get('cs/tickets')
  async listTickets(@Query() q: ListTicketDto) {
    return ok(await this.customerService.listTickets(q));
  }

  /** 工单详情 */
  @Get('cs/tickets/:id')
  async getTicket(@Param('id') id: string) {
    return ok(await this.customerService.getTicket(Number(id)));
  }

  /** 解决工单 */
  @Post('cs/tickets/:id/resolve')
  async resolveTicket(@Param('id') id: string) {
    return ok(await this.customerService.resolveTicket(Number(id)));
  }

  /** 新增知识 */
  @Post('cs/knowledge')
  async createKnowledge(@Body() dto: CreateKnowledgeDto) {
    return ok(await this.customerService.createKnowledge(dto));
  }

  /** 知识列表（可选 category 过滤） */
  @Get('cs/knowledge')
  async listKnowledge(@Query('category') category?: string) {
    return ok(await this.customerService.listKnowledge(category as KnowledgeCategory | undefined));
  }

  /** 更新知识 */
  @Put('cs/knowledge/:id')
  async updateKnowledge(@Param('id') id: string, @Body() dto: UpdateKnowledgeDto) {
    return ok(await this.customerService.updateKnowledge(Number(id), dto));
  }

  /** 删除知识 */
  @Delete('cs/knowledge/:id')
  async deleteKnowledge(@Param('id') id: string) {
    return ok(await this.customerService.deleteKnowledge(Number(id)));
  }

  /** 客服设置 */
  @Get('cs/settings')
  async getSettings() {
    return ok(await this.customerService.getSettings());
  }

  /** 更新客服设置 */
  @Put('cs/settings')
  async upsertSettings(@Body() dto: UpsertSettingsDto) {
    return ok(await this.customerService.upsertSettings(dto));
  }

  /** 同步 R 商品 / Y 订单 知识 */
  @Post('cs/knowledge/sync')
  async syncKnowledge() {
    return ok(await this.customerService.syncKnowledgeFromRY());
  }
}
