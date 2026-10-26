import { Body, Controller, Get, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { TenantContext } from '../../tenant/tenant-context';
import { SkillGateway } from '../../skill/skill.gateway';
import { env } from '../../config/env';
import { ChatDto } from './dto/chat.dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

/**
 * AI 助手对话控制器（浮动 AI 对话框后端）。
 * - POST /api/ops/ai-chat        一次性 JSON 回复
 * - POST /api/ops/ai-chat/stream SSE 分段推送（前端逐字渲染）
 * - GET  /api/ops/ai-chat/models 可选模型清单（白名单，避免误用付费模型）
 * 路由：拼装系统提示词 → SkillGateway 文本生成。
 */
@ApiTags('ai-chat')
@Controller('ops/ai-chat')
export class AiChatController {
  /** 简短系统提示词：智享全链运营系统 AI 助手 */
  private readonly SYSTEM_PROMPT =
    '你是智享全链运营系统的 AI 助手，帮助用户管理短视频/直播/电商全链路运营（账号矩阵、情报、选题、脚本、素材、成片、发布、数据看板、选品、投流、合规等）。回答简洁专业，控制在 300 字以内。若不确定，建议用户查阅对应模块页面。\n可查看页面（要核实结果或展示页面时，在回复末尾单独一行附上 [[查看:页面名]]，系统会截图并把页面摘要带回对话）：运营总览、账号矩阵、市场情报、分析中心、选题中心、脚本中心、素材库、成片库、发布中心、工作流、自动化、回收站、选品、商品、直播、投流、私域、对账、订单、客服、数据看板、个人中心。';

  /** 可选模型白名单：仅免费款，防止误用付费模型产生费用 */
  private readonly ALLOWED_MODELS = ['glm-4-flash', 'glm-4.7-flash'];

  constructor(private readonly skillGateway: SkillGateway) {}

  /** GET /api/ops/ai-chat/models — 可选模型（active 为当前默认） */
  @Get('models')
  @ApiOperation({ summary: '可选模型（active 为当前默认） */' })
  models() {
    const active = env.OPS_OLLAMA_MODEL;
    return {
      active,
      list: this.ALLOWED_MODELS.map((name) => ({
        name,
        desc: name === active ? '当前默认' : '智谱免费',
      })),
    };
  }

  private buildPrompt(dto: ChatDto): string {
    const tenantId = TenantContext.requireTenantId();
    void tenantId;
    // 拼装上下文：系统提示词 + 历史对话 + 新消息
    const historyParts = (dto.history ?? [])
      .map((m) => `${m.role === 'user' ? '用户' : '助手'}: ${m.content}`)
      .join('\n');

    return [
      this.SYSTEM_PROMPT,
      historyParts ? `\n--- 对话历史 ---\n${historyParts}` : '',
      `\n--- 当前问题 ---\n用户: ${dto.message}\n助手:`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  /** model 白名单校验：非白名单一律忽略（回落默认模型） */
  private resolveModel(dto: ChatDto): Record<string, unknown> {
    const params: Record<string, unknown> = { maxTokens: 512 };
    if (dto.model && this.ALLOWED_MODELS.includes(dto.model)) {
      params.model = dto.model;
    }
    return params;
  }

  /** POST /api/ops/ai-chat — 一次性 JSON 回复 */
  @Post()
  @ApiOperation({ summary: '一次性 JSON 回复 */' })
  async chat(@Body() dto: ChatDto) {
    const tenantId = TenantContext.requireTenantId();
    const reply = await this.skillGateway.generateText(
      this.buildPrompt(dto),
      tenantId,
      this.resolveModel(dto),
    );
    return { reply };
  }

  /** POST /api/ops/ai-chat/stream — SSE 分段推送（text/* 事件 + done） */
  @Post('stream')
  @ApiOperation({ summary: 'SSE 分段推送（text/* 事件 + done） */' })
  async stream(@Body() dto: ChatDto, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const send = (obj: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify(obj)}\n\n`);
    };
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    try {
      const tenantId = TenantContext.requireTenantId();
      const reply = await this.skillGateway.generateText(
        this.buildPrompt(dto),
        tenantId,
        this.resolveModel(dto),
      );
      // 分段推送（每段 ~6 字，45ms 间隔）：传输层真实 SSE，逐字渲染体验
      for (let i = 0; i < reply.length; i += 6) {
        send({ type: 'text', content: reply.slice(i, i + 6) });
        await sleep(45);
      }
      send({ type: 'done' });
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      send({
        type: 'error',
        message:
          code === 'SKILL_NOT_ENABLED'
            ? '（AI 技能未启用：请到「AI 中心 / 技能」启用文本生成）'
            : '（AI 助手暂时不可用，请稍后重试）',
      });
    }
    res.end();
  }
}
