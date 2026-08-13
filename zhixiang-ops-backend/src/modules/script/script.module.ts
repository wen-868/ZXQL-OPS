import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScriptService } from './script.service';
import { ScriptController } from './script.controller';
import { ScriptEntity } from './script.entity';
import { TopicEntity } from '../topic/topic.entity';
import { ComplianceModule } from '../compliance/compliance.module';

/**
 * 脚本工坊模块（规划 §4-F）。
 * 消费 E 选题（TopicEntity 通过 forFeature 复用），能力网关 SkillGateway 为全局模块自动可用；
 * 合规预检复用 P 域 ComplianceModule（替代阶段1 内嵌 BANNED_WORDS）。
 */
@Module({
  imports: [TypeOrmModule.forFeature([ScriptEntity, TopicEntity]), ComplianceModule],
  controllers: [ScriptController],
  providers: [ScriptService],
  exports: [ScriptService],
})
export class ScriptModule {}
