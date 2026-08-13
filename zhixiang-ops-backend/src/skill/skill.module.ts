import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SkillGateway } from './skill.gateway';
import { OllamaProvider } from './providers/ollama.provider';
import { GatewayProvider } from './providers/gateway.provider';
import { SkillProviderEntity } from './skill-provider.entity';
import { SkillUsageLog } from './skill-usage-log.entity';
import { SkillCenterModule } from '../modules/skill-center/skill-center.module';
import { LlmModule } from '../modules/llm/llm.module';

/**
 * 能力网关模块（规划 §4-O / §14）。
 * 全局模块：任意业务模块（D 人性分析 / F 脚本 / 等）注入 SkillGateway 调用能力。
 * 联动 Z 技能中心：网关 invoke 前经 SkillCenterService 校验租户启用（门禁），
 * Z 决定"装什么/用哪个源"，网关负责路由+降级+源透明。
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([SkillProviderEntity, SkillUsageLog]),
    SkillCenterModule,
    LlmModule,
  ],
  providers: [OllamaProvider, GatewayProvider, SkillGateway],
  exports: [SkillGateway],
})
export class SkillModule {}
