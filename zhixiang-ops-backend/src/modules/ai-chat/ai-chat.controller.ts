import { Body, Controller, Post } from '@nestjs/common';
import { TenantContext } from '../../tenant/tenant-context';
import { SkillGateway } from '../../skill/skill.gateway';
import { ChatDto } from './dto/chat.dto';

/**
 * AI 助手对话控制器（浮动 AI 对话框后端）。
 * 接收自然语言查询，拼装系统提示词 → SkillGateway 文本生成。
 * 路由：POST /api/ops/ai-chat
 */
@Controller('ops/ai-chat')
export class AiChatController {
  /** 简短系统提示词：智享全链运营系统 AI 助手 */
  private readonly SYSTEM_PROMPT =
    '你是智享全链运营系统的 AI 助手，帮助用户管理短视频/直播/电商全链路运营（账号矩阵、情报、选题、脚本、素材、成片、发布、数据看板、选品、投流、合规等）。回答简洁专业，控制在 300 字以内。若不确定，建议用户查阅对应模块页面。';

  constructor(private readonly skillGateway: SkillGateway) {}

  @Post()
  async chat(@Body() dto: ChatDto) {
    const tenantId = TenantContext.requireTenantId();

    // 拼装上下文：系统提示词 + 历史对话 + 新消息
    const historyParts = (dto.history ?? [])
      .map((m) => `${m.role === 'user' ? '用户' : '助手'}: ${m.content}`)
      .join('\n');

    const prompt = [
      this.SYSTEM_PROMPT,
      historyParts ? `\n--- 对话历史 ---\n${historyParts}` : '',
      `\n--- 当前问题 ---\n用户: ${dto.message}\n助手:`,
    ]
      .filter(Boolean)
      .join('\n');

    const reply = await this.skillGateway.generateText(prompt, tenantId, {
      maxTokens: 512,
    });

    return { reply };
  }
}
