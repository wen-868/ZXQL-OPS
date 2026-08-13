import { Module } from '@nestjs/common';
import { SkillModule } from '../../skill/skill.module';
import { AiChatController } from './ai-chat.controller';

/**
 * AI 助手对话模块。
 * 依赖 SkillModule（全局模块，提供 SkillGateway 文本生成能力）。
 */
@Module({
  imports: [SkillModule],
  controllers: [AiChatController],
})
export class AiChatModule {}
